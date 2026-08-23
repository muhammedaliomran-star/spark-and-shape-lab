-- Storefront phase 1: secure reservations, cancellation, expiry and idempotent conversion.

alter table public.store_orders
  add column if not exists status_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists expires_at timestamptz;

-- SECURITY DEFINER functions must opt out of PostgreSQL's default PUBLIC execute grant.
revoke all on function public.get_public_storefront(text) from public;
revoke all on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb) from public;
revoke all on function public.accept_store_order(uuid) from public;
revoke all on function public.invoice_store_order(uuid) from public;
grant execute on function public.get_public_storefront(text) to anon, authenticated;
grant execute on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb) to anon, authenticated;
grant execute on function public.accept_store_order(uuid) to authenticated;
grant execute on function public.invoice_store_order(uuid) to authenticated;

create or replace function public.expire_storefront_reservations()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  with expired_orders as (
    update public.store_orders o
    set status = 'expired', status_reason = 'انتهت مهلة حجز المخزون', updated_at = now(), expires_at = now()
    where o.status = 'accepted' and o.reservation_expires_at <= now()
    returning o.id
  ), released as (
    update public.stock_reservations r set status = 'expired', released_at = now()
    where r.status = 'active' and (r.expires_at <= now() or r.order_id in (select id from expired_orders))
    returning r.order_id
  ) select count(distinct order_id) into v_count from released;
  insert into public.store_order_events (order_id, event_type, payload)
    select id, 'reservation_expired', jsonb_build_object('at', now()) from expired_orders;
  return coalesce(v_count, 0);
end;
$$;

create or replace function public.cancel_store_order(p_order_id uuid, p_reason text default null)
returns public.store_orders language plpgsql security definer set search_path = public as $$
declare v_order public.store_orders;
begin
  select o.* into v_order
  from public.store_orders o join public.storefronts s on s.id = o.storefront_id
  where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if v_order.status in ('invoiced', 'shipped', 'delivered') then raise exception 'لا يمكن إلغاء طلب تم تحويله أو شحنه'; end if;
  if v_order.status in ('cancelled', 'rejected', 'expired') then return v_order; end if;
  update public.stock_reservations set status = 'released', released_at = now()
    where order_id = v_order.id and status = 'active';
  update public.store_orders set status = 'cancelled', status_reason = nullif(trim(coalesce(p_reason, '')), ''), cancelled_at = now(), updated_at = now()
    where id = v_order.id returning * into v_order;
  insert into public.store_order_events (order_id, actor_user_id, event_type, payload)
    values (v_order.id, auth.uid(), 'cancelled', jsonb_build_object('reason', v_order.status_reason));
  return v_order;
end;
$$;

create or replace function public.accept_store_order(p_order_id uuid)
returns public.store_orders language plpgsql security definer set search_path = public as $$
declare v_order public.store_orders; v_item public.store_order_items; v_stock public.stock_items; v_reserved integer;
begin
  perform public.expire_storefront_reservations();
  select o.* into v_order from public.store_orders o join public.storefronts s on s.id = o.storefront_id
    where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if v_order.status not in ('submitted', 'under_review', 'needs_info') then raise exception 'لا يمكن قبول الطلب في حالته الحالية'; end if;
  for v_item in select * from public.store_order_items where order_id = v_order.id loop
    select * into v_stock from public.stock_items where id = v_item.stock_item_id for update;
    select coalesce(sum(quantity), 0) into v_reserved from public.stock_reservations
      where stock_item_id = v_item.stock_item_id and status = 'active' and expires_at > now();
    if not found or v_stock.quantity - v_reserved < v_item.quantity then
      raise exception 'المخزون لم يعد كافيًا للمنتج: %', v_item.product_title;
    end if;
    insert into public.stock_reservations (stock_item_id, order_id, quantity, status, expires_at)
      values (v_item.stock_item_id, v_order.id, v_item.quantity, 'active', now() + interval '24 hours')
      on conflict (order_id, stock_item_id) do update set quantity = excluded.quantity, status = 'active', expires_at = excluded.expires_at, released_at = null;
  end loop;
  update public.store_orders set status = 'accepted', status_reason = null, reservation_expires_at = now() + interval '24 hours', expires_at = null, updated_at = now()
    where id = v_order.id returning * into v_order;
  insert into public.store_order_events (order_id, actor_user_id, event_type, payload)
    values (v_order.id, auth.uid(), 'accepted', jsonb_build_object('reservation_expires_at', v_order.reservation_expires_at));
  return v_order;
end;
$$;

create or replace function public.invoice_store_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order public.store_orders; v_owner uuid; v_customer_id uuid; v_invoice_id uuid; v_item public.store_order_items; v_stock public.stock_items; v_reservation public.stock_reservations;
begin
  perform public.expire_storefront_reservations();
  select o.* into v_order from public.store_orders o join public.storefronts s on s.id = o.storefront_id
    where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if v_order.invoice_id is not null then return jsonb_build_object('invoice_id', v_order.invoice_id, 'already_invoiced', true); end if;
  if v_order.status <> 'accepted' or v_order.reservation_expires_at <= now() then raise exception 'انتهت مهلة الحجز أو الطلب غير مقبول'; end if;
  if v_order.order_type <> 'cash_on_delivery' then raise exception 'طلب التقسيط يحتاج شروط اتفاق قبل إنشاء الفاتورة'; end if;
  select owner_id into v_owner from public.storefronts where id = v_order.storefront_id;
  select id into v_customer_id from public.customers where user_id = v_owner and phone = v_order.customer_phone order by created_at asc limit 1;
  if v_customer_id is null then
    insert into public.customers (user_id, name, phone, address) values (v_owner, v_order.customer_name, v_order.customer_phone, v_order.delivery_address) returning id into v_customer_id;
  end if;
  insert into public.invoices (user_id, customer_id, total, down_payment, monthly_installment, first_due_date, paid, notes, status)
    values (v_owner, v_customer_id, v_order.total, 0, 0, current_date, 0, concat('طلب متجر #', v_order.public_number), 'pending') returning id into v_invoice_id;
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
    values (v_order.id, auth.uid(), 'invoiced', jsonb_build_object('invoice_id', v_invoice_id));
  return jsonb_build_object('invoice_id', v_invoice_id, 'already_invoiced', false);
end;
$$;

revoke all on function public.expire_storefront_reservations() from public;
revoke all on function public.cancel_store_order(uuid, text) from public;
grant execute on function public.expire_storefront_reservations() to authenticated;
grant execute on function public.cancel_store_order(uuid, text) to authenticated;
