-- Storefront phase 2: calculate and snapshot delivery fees on the server.

create or replace function public.get_public_storefront(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'storefront', jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'phone', s.phone, 'whatsapp_phone', s.whatsapp_phone, 'logo_url', s.logo_url, 'description', s.description, 'shipping_policy', s.shipping_policy),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'sort_order', c.sort_order) order by c.sort_order, c.name) from public.storefront_categories c where c.storefront_id = s.id), '[]'::jsonb),
    'shipping_options', coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'delivery_cost', z.delivery_cost, 'estimated_days', z.estimated_days, 'carrier_name', c.name) order by z.name) from public.shipping_zones z join public.shipping_carriers c on c.id = z.carrier_id and c.active where z.user_id = s.owner_id), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'title', p.title, 'description', p.description, 'images', p.images, 'display_price', p.display_price, 'show_installments', p.show_installments, 'down_payment_from', p.down_payment_from, 'monthly_payment_from', p.monthly_payment_from, 'category_id', p.category_id, 'available_quantity', greatest(si.quantity - coalesce((select sum(r.quantity) from public.stock_reservations r where r.stock_item_id = si.id and r.status = 'active' and r.expires_at > now()), 0), 0)) order by p.sort_order, p.title) from public.storefront_products p join public.stock_items si on si.id = p.stock_item_id where p.storefront_id = s.id and p.is_published and (si.quantity - coalesce((select sum(r.quantity) from public.stock_reservations r where r.stock_item_id = si.id and r.status = 'active' and r.expires_at > now()), 0)) > 0), '[]'::jsonb)
  ) from public.storefronts s where s.slug = lower(p_slug) and s.is_published;
$$;

drop function if exists public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb);

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
  insert into public.store_orders (storefront_id, customer_name, customer_phone, delivery_address, delivery_area, notes, order_type, shipping_fee, subtotal, total)
  values (p_storefront_id, trim(p_customer_name), trim(p_customer_phone), trim(p_delivery_address), nullif(trim(coalesce(p_delivery_area, '')), ''), nullif(trim(coalesce(p_notes, '')), ''), p_order_type, v_shipping_fee, 0, v_shipping_fee)
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

revoke all on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid) from public;
grant execute on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid) to anon, authenticated;