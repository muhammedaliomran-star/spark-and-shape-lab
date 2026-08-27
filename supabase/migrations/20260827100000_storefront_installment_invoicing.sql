-- Allow an accepted storefront installment request to become a real installment invoice.
create or replace function public.invoice_store_order_installment(
  p_order_id uuid,
  p_down_payment numeric,
  p_monthly_installment numeric,
  p_first_due_date date
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.store_orders; v_owner uuid; v_customer_id uuid; v_invoice_id uuid;
  v_item public.store_order_items; v_stock public.stock_items; v_reservation public.stock_reservations;
begin
  perform public.expire_storefront_reservations();
  select o.* into v_order from public.store_orders o join public.storefronts s on s.id = o.storefront_id
    where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if v_order.invoice_id is not null then return jsonb_build_object('invoice_id', v_order.invoice_id, 'already_invoiced', true); end if;
  if v_order.status <> 'accepted' or v_order.reservation_expires_at <= now() then raise exception 'انتهت مهلة الحجز أو الطلب غير مقبول'; end if;
  if v_order.order_type <> 'installment_request' then raise exception 'الطلب ليس طلب تقسيط'; end if;
  if p_down_payment is null or p_down_payment < 0 or p_down_payment > v_order.total then raise exception 'المقدم غير صحيح'; end if;
  if p_monthly_installment is null or p_monthly_installment <= 0 then raise exception 'القسط الشهري يجب أن يكون أكبر من صفر'; end if;
  if p_first_due_date is null then raise exception 'تاريخ أول استحقاق مطلوب'; end if;

  select owner_id into v_owner from public.storefronts where id = v_order.storefront_id;
  select id into v_customer_id from public.customers where user_id = v_owner and phone = v_order.customer_phone order by created_at asc limit 1;
  if v_customer_id is null then
    insert into public.customers (user_id, name, phone, address, customer_type)
      values (v_owner, v_order.customer_name, v_order.customer_phone, v_order.delivery_address, 'installment') returning id into v_customer_id;
  end if;
  insert into public.invoices (user_id, customer_id, total, down_payment, monthly_installment, first_due_date, paid, notes, status)
    values (v_owner, v_customer_id, v_order.total, p_down_payment, p_monthly_installment, p_first_due_date, p_down_payment, concat('طلب متجر تقسيط #', v_order.public_number), 'pending') returning id into v_invoice_id;
  for v_item in select * from public.store_order_items where order_id = v_order.id loop
    select * into v_reservation from public.stock_reservations where order_id = v_order.id and stock_item_id = v_item.stock_item_id and status = 'active' and expires_at > now() for update;
    if not found then raise exception 'انتهى حجز المنتج: %', v_item.product_title; end if;
    select * into v_stock from public.stock_items where id = v_item.stock_item_id for update;
    if not found or v_stock.quantity < v_item.quantity then raise exception 'المخزون غير كافٍ لإتمام الفاتورة: %', v_item.product_title; end if;
    insert into public.invoice_items (user_id, invoice_id, name, cost, price)
      select v_owner, v_invoice_id, v_item.product_title, v_stock.last_unit_cost, v_item.unit_price from generate_series(1, v_item.quantity);
    update public.stock_items set quantity = quantity - v_item.quantity, updated_at = now() where id = v_stock.id;
    update public.stock_reservations set status = 'consumed', released_at = now() where id = v_reservation.id;
  end loop;
  insert into public.shipments (user_id, invoice_id, status, recipient_name, recipient_phone, delivery_address, notes)
    values (v_owner, v_invoice_id, 'pending', v_order.customer_name, v_order.customer_phone, v_order.delivery_address, concat('طلب متجر #', v_order.public_number));
  update public.store_orders set invoice_id = v_invoice_id, status = 'invoiced', status_reason = null, updated_at = now() where id = v_order.id;
  insert into public.store_order_events (order_id, actor_user_id, event_type, payload)
    values (v_order.id, auth.uid(), 'invoiced', jsonb_build_object('invoice_id', v_invoice_id, 'order_type', 'installment_request', 'down_payment', p_down_payment, 'monthly_installment', p_monthly_installment, 'first_due_date', p_first_due_date));
  return jsonb_build_object('invoice_id', v_invoice_id, 'already_invoiced', false);
end;
$$;

revoke all on function public.invoice_store_order_installment(uuid, numeric, numeric, date) from public;
grant execute on function public.invoice_store_order_installment(uuid, numeric, numeric, date) to authenticated;
