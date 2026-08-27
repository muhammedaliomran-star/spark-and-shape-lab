drop function if exists public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid);

create or replace function public.submit_store_order(
  p_storefront_id uuid, p_customer_name text, p_customer_phone text, p_delivery_address text,
  p_delivery_area text, p_notes text, p_order_type public.store_order_type, p_items jsonb,
  p_shipping_zone_id uuid default null, p_coupon_code text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.store_orders; v_item jsonb; v_product public.storefront_products; v_stock public.stock_items;
  v_coupon public.storefront_coupons; v_qty integer; v_subtotal numeric := 0; v_shipping_fee numeric := 0;
  v_discount numeric := 0; v_owner uuid; v_minimum numeric := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'السلة فارغة'; end if;
  select owner_id, minimum_order into v_owner, v_minimum from public.storefronts where id = p_storefront_id and is_published;
  if not found then raise exception 'المتجر غير متاح'; end if;
  if p_shipping_zone_id is not null then
    select z.delivery_cost into v_shipping_fee from public.shipping_zones z join public.shipping_carriers c on c.id = z.carrier_id and c.active where z.id = p_shipping_zone_id and z.user_id = v_owner;
    if not found then raise exception 'منطقة التوصيل غير متاحة'; end if;
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select p.* into v_product from public.storefront_products p where p.id = (v_item->>'product_id')::uuid and p.storefront_id = p_storefront_id and p.is_published for share;
    if not found or v_qty is null or v_qty < 1 then raise exception 'منتج غير متاح بالكمية المطلوبة'; end if;
    select si.* into v_stock from public.stock_items si where si.id = v_product.stock_item_id for share;
    if not found or v_stock.quantity < v_qty then raise exception 'منتج غير متاح بالكمية المطلوبة'; end if;
    v_subtotal := v_subtotal + v_product.display_price * v_qty;
  end loop;
  if v_minimum > 0 and v_subtotal < v_minimum then raise exception 'الحد الأدنى للطلب هو %', v_minimum; end if;
  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select * into v_coupon from public.storefront_coupons where storefront_id = p_storefront_id and upper(code) = upper(trim(p_coupon_code)) and active and now() >= starts_at and (ends_at is null or now() <= ends_at) and v_subtotal >= minimum_order and (max_uses is null or used_count < max_uses) for update;
    if not found then raise exception 'الكوبون غير صالح أو انتهت مرات استخدامه'; end if;
    v_discount := least(v_subtotal, case when v_coupon.discount_type = 'percentage' then round(v_subtotal * v_coupon.discount_value / 100, 2) else v_coupon.discount_value end);
  end if;
  insert into public.store_orders (storefront_id, customer_name, customer_phone, delivery_address, delivery_area, notes, order_type, shipping_fee, subtotal, total, coupon_id, discount_amount)
    values (p_storefront_id, trim(p_customer_name), trim(p_customer_phone), trim(p_delivery_address), nullif(trim(coalesce(p_delivery_area, '')), ''), nullif(trim(coalesce(p_notes, '')), ''), p_order_type, v_shipping_fee, v_subtotal, greatest(0, v_subtotal + v_shipping_fee - v_discount), case when v_coupon.id is null then null else v_coupon.id end, v_discount) returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select p.* into v_product from public.storefront_products p where p.id = (v_item->>'product_id')::uuid and p.storefront_id = p_storefront_id and p.is_published for share;
    insert into public.store_order_items (order_id, storefront_product_id, stock_item_id, product_title, unit_price, quantity, line_total, product_snapshot)
      values (v_order.id, v_product.id, v_product.stock_item_id, v_product.title, v_product.display_price, v_qty, v_product.display_price * v_qty, jsonb_build_object('title', v_product.title, 'slug', v_product.slug, 'images', v_product.images, 'display_price', v_product.display_price));
  end loop;
  if v_coupon.id is not null then update public.storefront_coupons set used_count = used_count + 1 where id = v_coupon.id; end if;
  insert into public.store_order_events (order_id, event_type, payload) values (v_order.id, 'submitted', jsonb_build_object('source', 'public_storefront', 'shipping_zone_id', p_shipping_zone_id, 'shipping_fee', v_shipping_fee, 'coupon_id', v_coupon.id, 'discount_amount', v_discount));
  return jsonb_build_object('id', v_order.id, 'public_number', v_order.public_number, 'status', v_order.status, 'shipping_fee', v_shipping_fee, 'discount_amount', v_discount, 'total', greatest(0, v_subtotal + v_shipping_fee - v_discount));
end;
$$;

grant execute on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid, text) to anon, authenticated;
