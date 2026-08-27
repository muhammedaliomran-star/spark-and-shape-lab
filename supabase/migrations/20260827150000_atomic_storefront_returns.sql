create or replace function public.create_storefront_sale_return(
  p_order_id uuid, p_reason text, p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_order public.store_orders; v_owner uuid; v_return_id uuid; v_item jsonb; v_order_item public.store_order_items;
  v_sold integer; v_returned integer; v_qty integer; v_total numeric := 0; v_stock public.stock_items; v_invoice public.invoices; v_returned_total numeric;
begin
  select o.* into v_order from public.store_orders o join public.storefronts s on s.id = o.storefront_id
    where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if v_order.invoice_id is null then raise exception 'لا يمكن تسجيل مرتجع قبل إنشاء الفاتورة'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'سبب المرتجع مطلوب'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'اختر صنفًا واحدًا على الأقل'; end if;
  select * into v_invoice from public.invoices where id = v_order.invoice_id and user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;

  insert into public.return_records (user_id, invoice_id, type, total_amount, reason, notes)
    values (auth.uid(), v_order.invoice_id, 'sale', 0, trim(p_reason), concat('مرتجع طلب متجر #', v_order.public_number)) returning id into v_return_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_order_item from public.store_order_items where order_id = v_order.id and stock_item_id = (v_item->>'stock_item_id')::uuid;
    if not found or v_qty is null or v_qty <= 0 then raise exception 'بيانات المرتجع غير صحيحة'; end if;
    select quantity into v_sold from public.store_order_items where id = v_order_item.id;
    select coalesce(sum(ri.quantity), 0) into v_returned from public.return_items ri join public.return_records rr on rr.id = ri.return_id where rr.invoice_id = v_order.invoice_id and rr.type = 'sale' and ri.name = v_order_item.product_title;
    if v_qty > v_sold - v_returned then raise exception 'الكمية المرتجعة أكبر من الكمية المباعة: %', v_order_item.product_title; end if;
    insert into public.return_items (user_id, return_id, name, unit_price, quantity) values (auth.uid(), v_return_id, v_order_item.product_title, v_order_item.unit_price, v_qty);
    v_total := v_total + v_order_item.unit_price * v_qty;
    select * into v_stock from public.stock_items where id = v_order_item.stock_item_id and user_id = auth.uid() for update;
    if not found then raise exception 'صنف المخزون غير موجود: %', v_order_item.product_title; end if;
    update public.stock_items set quantity = quantity + v_qty, updated_at = now() where id = v_stock.id;
  end loop;
  update public.return_records set total_amount = v_total where id = v_return_id;
  select coalesce(sum(rr.total_amount), 0) into v_returned_total from public.return_records rr where rr.invoice_id = v_order.invoice_id and rr.type = 'sale';
  update public.invoices set total = greatest(0, total - v_total), paid = least(greatest(0, total - v_total), down_payment + coalesce((select sum(p.amount) from public.payments p where p.invoice_id = v_invoice.id), 0)), status = case when v_returned_total >= v_order.subtotal then 'cancelled' when paid >= greatest(0, total - v_total) then 'paid' else 'pending' end where id = v_invoice.id;
  update public.store_orders set return_id = v_return_id, status = case when v_returned_total >= v_order.subtotal then 'cancelled' else status end, updated_at = now() where id = v_order.id;
  update public.shipments set status = 'returned' where invoice_id = v_order.invoice_id and v_returned_total >= v_order.subtotal;
  insert into public.store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), 'returned', jsonb_build_object('return_id', v_return_id, 'amount', v_total, 'full_return', v_returned_total >= v_order.subtotal));
  return v_return_id;
end;
$$;

grant execute on function public.create_storefront_sale_return(uuid, text, jsonb) to authenticated;

create or replace function public.reverse_storefront_sale_return(p_return_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_return public.return_records; v_item record; v_stock public.stock_items; v_order public.store_orders;
begin
  select rr.* into v_return from public.return_records rr where rr.id = p_return_id and rr.user_id = auth.uid() and rr.type = 'sale' for update;
  if not found then raise exception 'المرتجع غير موجود أو غير مسموح'; end if;
  for v_item in select * from public.return_items where return_id = p_return_id loop
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_item.name for update;
    if not found or v_stock.quantity < v_item.quantity then raise exception 'المخزون لا يسمح بعكس المرتجع: %', v_item.name; end if;
    update public.stock_items set quantity = quantity - v_item.quantity, updated_at = now() where id = v_stock.id;
  end loop;
  update public.invoices set total = total + v_return.total_amount, paid = least(total + v_return.total_amount, paid), status = case when paid >= total + v_return.total_amount then 'paid' else 'pending' end where id = v_return.invoice_id and user_id = auth.uid();
  select * into v_order from public.store_orders where return_id = p_return_id and storefront_id in (select id from public.storefronts where owner_id = auth.uid()) for update;
  if found then
    update public.store_orders set return_id = null, status = 'invoiced', updated_at = now() where id = v_order.id;
    perform set_config('app.allow_shipment_reversal', 'on', true);
    update public.shipments set status = 'pending' where invoice_id = v_return.invoice_id and user_id = auth.uid();
    insert into public.store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), 'return_reversed', jsonb_build_object('return_id', p_return_id));
  end if;
  delete from public.return_records where id = p_return_id;
end;
$$;

grant execute on function public.reverse_storefront_sale_return(uuid) to authenticated;
