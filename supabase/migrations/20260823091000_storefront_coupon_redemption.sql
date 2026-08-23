-- Phase 10: consume coupons atomically after an order is created.

alter table public.store_orders
  add column if not exists coupon_id uuid references public.storefront_coupons(id) on delete set null,
  add column if not exists discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0);

create or replace function public.redeem_storefront_coupon(p_order_id uuid, p_coupon_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_coupon public.storefront_coupons; v_order public.store_orders; v_discount numeric;
begin
  select o.* into v_order from public.store_orders o join public.storefronts s on s.id = o.storefront_id where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if v_order.coupon_id is not null then return v_order.discount_amount; end if;
  select * into v_coupon from public.storefront_coupons where id = p_coupon_id and storefront_id = v_order.storefront_id for update;
  if not found or not v_coupon.active or now() < v_coupon.starts_at or (v_coupon.ends_at is not null and now() > v_coupon.ends_at) or v_order.subtotal < v_coupon.minimum_order or (v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses) then raise exception 'الكوبون غير صالح أو انتهت مرات استخدامه'; end if;
  v_discount := least(v_order.subtotal, case when v_coupon.discount_type = 'percentage' then round(v_order.subtotal * v_coupon.discount_value / 100, 2) else v_coupon.discount_value end);
  update public.storefront_coupons set used_count = used_count + 1 where id = v_coupon.id;
  update public.store_orders set coupon_id = v_coupon.id, discount_amount = v_discount, total = greatest(0, total - v_discount), updated_at = now() where id = v_order.id;
  insert into public.store_order_events (order_id, event_type, payload) values (v_order.id, 'coupon_redeemed', jsonb_build_object('coupon_id', v_coupon.id, 'discount_amount', v_discount));
  return v_discount;
end;
$$;

revoke all on function public.redeem_storefront_coupon(uuid, uuid) from public;
grant execute on function public.redeem_storefront_coupon(uuid, uuid) to authenticated;