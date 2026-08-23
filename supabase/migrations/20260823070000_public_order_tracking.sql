-- Phase 8: limited public order tracking by order number and phone.

create or replace function public.get_public_order_status(p_public_number text, p_customer_phone text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'public_number', o.public_number,
    'status', o.status,
    'order_type', o.order_type,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'total', o.total,
    'shipping_fee', o.shipping_fee,
    'items', coalesce((select jsonb_agg(jsonb_build_object('title', i.product_title, 'quantity', i.quantity)) from public.store_order_items i where i.order_id = o.id), '[]'::jsonb)
  ) from public.store_orders o
  where upper(o.public_number) = upper(trim(p_public_number))
    and regexp_replace(o.customer_phone, '[^0-9]+', '', 'g') = regexp_replace(trim(p_customer_phone), '[^0-9]+', '', 'g');
$$;

revoke all on function public.get_public_order_status(text, text) from public;
grant execute on function public.get_public_order_status(text, text) to anon, authenticated;