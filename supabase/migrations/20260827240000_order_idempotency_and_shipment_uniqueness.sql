alter table public.store_orders add column if not exists idempotency_key text;
create unique index if not exists store_orders_idempotency_key_idx on public.store_orders(storefront_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists shipments_invoice_unique_idx on public.shipments(invoice_id) where invoice_id is not null;

create or replace function public.submit_store_order(
  p_storefront_id uuid, p_customer_name text, p_customer_phone text, p_delivery_address text,
  p_delivery_area text, p_notes text, p_order_type public.store_order_type, p_items jsonb,
  p_shipping_zone_id uuid default null, p_coupon_code text default null, p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_existing public.store_orders; v_result jsonb; v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if v_key is null then raise exception 'مفتاح الطلب مطلوب'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_storefront_id::text || ':' || v_key, 0));
  select * into v_existing from public.store_orders where storefront_id = p_storefront_id and idempotency_key = v_key for update;
  if found then return jsonb_build_object('id', v_existing.id, 'public_number', v_existing.public_number, 'status', v_existing.status, 'shipping_fee', v_existing.shipping_fee, 'discount_amount', v_existing.discount_amount, 'total', v_existing.total, 'already_submitted', true); end if;
  v_result := public.submit_store_order(p_storefront_id, p_customer_name, p_customer_phone, p_delivery_address, p_delivery_area, p_notes, p_order_type, p_items, p_shipping_zone_id, p_coupon_code);
  update public.store_orders set idempotency_key = v_key where id = (v_result->>'id')::uuid;
  return v_result || jsonb_build_object('already_submitted', false);
end;
$$;

revoke all on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid, text, text) from public;
grant execute on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid, text, text) to anon, authenticated;
