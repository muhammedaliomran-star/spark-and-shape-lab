-- Phase 10: auditable, merchant-scoped storefront coupons.

create table if not exists public.storefront_coupons (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  code text not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_order numeric(12,2) not null default 0 check (minimum_order >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (storefront_id, code),
  check (ends_at is null or ends_at > starts_at),
  check (discount_type <> 'percentage' or discount_value <= 100)
);

alter table public.storefront_coupons enable row level security;
create policy "Owners manage storefront coupons" on public.storefront_coupons for all to authenticated using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid())) with check (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));

create or replace function public.validate_storefront_coupon(p_storefront_id uuid, p_code text, p_subtotal numeric)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('valid', true, 'coupon_id', c.id, 'discount_type', c.discount_type, 'discount_value', c.discount_value,
    'discount_amount', least(p_subtotal, case when c.discount_type = 'percentage' then round(p_subtotal * c.discount_value / 100, 2) else c.discount_value end))
  from public.storefront_coupons c
  where c.storefront_id = p_storefront_id and upper(c.code) = upper(trim(p_code)) and c.active and now() >= c.starts_at and (c.ends_at is null or now() <= c.ends_at) and p_subtotal >= c.minimum_order and (c.max_uses is null or c.used_count < c.max_uses);
$$;

revoke all on function public.validate_storefront_coupon(uuid, text, numeric) from public;
grant execute on function public.validate_storefront_coupon(uuid, text, numeric) to anon, authenticated;