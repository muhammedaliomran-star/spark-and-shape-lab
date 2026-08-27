-- Persist shipping zone on store orders and link shipments on invoicing.

alter table public.store_orders
  add column if not exists shipping_zone_id uuid references public.shipping_zones(id) on delete set null;

create index if not exists store_orders_shipping_zone_idx on public.store_orders (shipping_zone_id);

-- Backfill from submitted event payload where available
update public.store_orders o
set shipping_zone_id = (e.payload->>'shipping_zone_id')::uuid
from public.store_order_events e
where e.order_id = o.id
  and e.event_type = 'submitted'
  and o.shipping_zone_id is null
  and (e.payload->>'shipping_zone_id') is not null
  and (e.payload->>'shipping_zone_id') ~* '^[0-9a-f-]{36}$';

create or replace function public.submit_store_order(
  p_storefront_id uuid, p_customer_name text, p_customer_phone text, p_delivery_address text,
  p_delivery_area text, p_notes text, p_order_type public.store_order_type, p_items jsonb,
  p_shipping_zone_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.store_orders; v_item jsonb; v_product public.storefront_products; v_stock public.stock_items;
  v_qty integer; v_subtotal numeric := 0; v_shipping_fee numeric := 0; v_owner uuid;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'السلة فارغة'; end if;
  select owner_id into v_owner from public.storefronts where id = p_storefront_id and is_published;
  if not found then raise exception 'المتجر غير متاح'; end if;
  if p_shipping_zone_id is not null then
    select z.delivery_cost into v_shipping_fee
    from public.shipping_zones z join public.shipping_carriers c on c.id = z.carrier_id and c.active
    where z.id = p_shipping_zone_id and z.user_id = v_owner;
    if not found then raise exception 'منطقة التوصيل غير متاحة'; end if;
  end if;
  insert into public.store_orders (
    storefront_id, customer_name, customer_phone, delivery_address, delivery_area, notes,
    order_type, shipping_fee, shipping_zone_id, subtotal, total
  )
  values (
    p_storefront_id, trim(p_customer_name), trim(p_customer_phone), trim(p_delivery_address),
    nullif(trim(coalesce(p_delivery_area, '')), ''), nullif(trim(coalesce(p_notes, '')), ''),
    p_order_type, v_shipping_fee, p_shipping_zone_id, 0, v_shipping_fee
  )
  returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select p.* into v_product from public.storefront_products p where p.id = (v_item->>'product_id')::uuid and p.storefront_id = p_storefront_id and p.is_published for share;
    if not found or v_qty is null or v_qty < 1 then raise exception 'منتج غير متاح بالكمية المطلوبة'; end if;
    select si.* into v_stock from public.stock_items si where si.id = v_product.stock_item_id for share;
    if not found or v_stock.quantity < v_qty then raise exception 'منتج غير متاح بالكمية المطلوبة'; end if;
    insert into public.store_order_items (order_id, storefront_product_id, stock_item_id, product_title, unit_price, quantity, line_total, product_snapshot)
    values (v_order.id, v_product.id, v_product.stock_item_id, v_product.title, v_product.display_price, v_qty, v_product.display_price * v_qty, jsonb_build_object('title', v_product.title, 'slug', v_product.slug, 'images', v_product.images, 'display_price', v_product.display_price));
    v_subtotal := v_subtotal + v_product.display_price * v_qty;
  end loop;
  update public.store_orders set subtotal = v_subtotal, total = v_subtotal + v_shipping_fee, updated_at = now() where id = v_order.id;
  insert into public.store_order_events (order_id, event_type, payload) values (v_order.id, 'submitted', jsonb_build_object('source', 'public_storefront', 'shipping_zone_id', p_shipping_zone_id, 'shipping_fee', v_shipping_fee));
  return jsonb_build_object('id', v_order.id, 'public_number', v_order.public_number, 'status', v_order.status, 'shipping_fee', v_shipping_fee, 'total', v_subtotal + v_shipping_fee);
end;
$$;

create or replace function public.invoice_store_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.store_orders; v_owner uuid; v_customer_id uuid; v_invoice_id uuid;
  v_item public.store_order_items; v_stock public.stock_items; v_reservation public.stock_reservations;
  v_carrier_id uuid; v_zone_id uuid;
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
  v_zone_id := v_order.shipping_zone_id;
  if v_zone_id is not null then
    select z.carrier_id into v_carrier_id from public.shipping_zones z where z.id = v_zone_id;
  end if;
  insert into public.shipments (user_id, invoice_id, carrier_id, zone_id, status, recipient_name, recipient_phone, delivery_address, notes)
    values (v_owner, v_invoice_id, v_carrier_id, v_zone_id, 'pending', v_order.customer_name, v_order.customer_phone, v_order.delivery_address, concat('طلب متجر #', v_order.public_number));
  update public.store_orders set invoice_id = v_invoice_id, status = 'invoiced', status_reason = null, updated_at = now() where id = v_order.id;
  insert into public.store_order_events (order_id, actor_user_id, event_type, payload)
    values (v_order.id, auth.uid(), 'invoiced', jsonb_build_object('invoice_id', v_invoice_id, 'shipping_zone_id', v_zone_id));
  return jsonb_build_object('invoice_id', v_invoice_id, 'already_invoiced', false);
end;
$$;
