create or replace function public.create_sale_return(
  p_invoice_id uuid, p_reason text, p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_invoice public.invoices; v_return_id uuid; v_item jsonb; v_stock public.stock_items;
  v_name text; v_qty integer; v_price numeric; v_sold integer; v_returned integer; v_total numeric := 0;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id and user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'سبب المرتجع مطلوب'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'اختر صنفًا واحدًا على الأقل'; end if;
  insert into public.return_records (user_id, invoice_id, type, total_amount, reason)
    values (auth.uid(), p_invoice_id, 'sale', 0, trim(p_reason)) returning id into v_return_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name'); v_qty := (v_item->>'quantity')::integer; v_price := (v_item->>'unit_price')::numeric;
    if v_name = '' or v_qty is null or v_qty <= 0 or v_price is null or v_price < 0 then raise exception 'بيانات المرتجع غير صحيحة'; end if;
    select coalesce(sum(quantity), 0) into v_sold from public.invoice_items where invoice_id = p_invoice_id and name = v_name;
    select coalesce(sum(ri.quantity), 0) into v_returned from public.return_items ri join public.return_records rr on rr.id = ri.return_id where rr.invoice_id = p_invoice_id and rr.type = 'sale' and ri.name = v_name;
    if v_qty > v_sold - v_returned then raise exception 'الكمية المرتجعة أكبر من الكمية المباعة: %', v_name; end if;
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_name for update;
    if not found then raise exception 'صنف المخزون غير موجود: %', v_name; end if;
    insert into public.return_items (user_id, return_id, name, unit_price, quantity)
      values (auth.uid(), v_return_id, v_name, round(v_price, 2), v_qty);
    update public.stock_items set quantity = quantity + v_qty, updated_at = now() where id = v_stock.id;
    v_total := v_total + round(v_price, 2) * v_qty;
  end loop;
  update public.return_records set total_amount = round(v_total, 2) where id = v_return_id;
  update public.invoices i
  set total = greatest(0, i.total - round(v_total, 2)),
      paid = least(greatest(0, i.total - round(v_total, 2)), i.down_payment + coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0)),
      status = case when i.down_payment + coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0) >= greatest(0, i.total - round(v_total, 2)) then 'paid' else 'pending' end
  where i.id = p_invoice_id;
  return v_return_id;
end;
$$;

revoke all on function public.create_sale_return(uuid, text, jsonb) from public;
grant execute on function public.create_sale_return(uuid, text, jsonb) to authenticated;