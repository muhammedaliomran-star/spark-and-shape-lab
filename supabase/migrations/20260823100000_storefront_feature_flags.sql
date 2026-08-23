-- Phase 10: controlled rollout switches per storefront.

create table if not exists public.storefront_feature_flags (
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  flag text not null check (flag in ('coupons', 'online_payment', 'custom_domain', 'branch_catalog')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (storefront_id, flag)
);

alter table public.storefront_feature_flags enable row level security;
create policy "Owners manage storefront feature flags" on public.storefront_feature_flags for all to authenticated using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid())) with check (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));

create or replace function public.get_storefront_feature_flag(p_storefront_id uuid, p_flag text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.storefront_feature_flags where storefront_id = p_storefront_id and flag = p_flag), false);
$$;

revoke all on function public.get_storefront_feature_flag(uuid, text) from public;
grant execute on function public.get_storefront_feature_flag(uuid, text) to anon, authenticated;