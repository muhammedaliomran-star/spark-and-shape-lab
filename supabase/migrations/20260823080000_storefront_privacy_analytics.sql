-- Phase 9: conversion events without customer PII.

create table if not exists public.storefront_analytics_events (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  event_name text not null check (event_name in ('store_view', 'product_view', 'cart_add', 'checkout_start', 'order_submitted')),
  product_id uuid references public.storefront_products(id) on delete set null,
  source text check (source is null or source in ('direct', 'whatsapp', 'facebook', 'instagram', 'other')),
  occurred_at timestamptz not null default now()
);

alter table public.storefront_analytics_events enable row level security;
create policy "Owners read storefront analytics" on public.storefront_analytics_events for select to authenticated using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));

create or replace function public.record_storefront_event(p_storefront_id uuid, p_event_name text, p_product_id uuid default null, p_source text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_event_name not in ('store_view', 'product_view', 'cart_add', 'checkout_start', 'order_submitted') then raise exception 'حدث غير مسموح'; end if;
  if not exists (select 1 from public.storefronts where id = p_storefront_id and is_published) then return; end if;
  if p_product_id is not null and not exists (select 1 from public.storefront_products where id = p_product_id and storefront_id = p_storefront_id) then return; end if;
  insert into public.storefront_analytics_events (storefront_id, event_name, product_id, source) values (p_storefront_id, p_event_name, p_product_id, nullif(p_source, ''));
end;
$$;

revoke all on function public.record_storefront_event(uuid, text, uuid, text) from public;
grant execute on function public.record_storefront_event(uuid, text, uuid, text) to anon, authenticated;

create or replace function public.get_storefront_analytics_summary(p_storefront_id uuid, p_from timestamptz default now() - interval '30 days')
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'store_view', count(*) filter (where event_name = 'store_view'),
    'product_view', count(*) filter (where event_name = 'product_view'),
    'cart_add', count(*) filter (where event_name = 'cart_add'),
    'checkout_start', count(*) filter (where event_name = 'checkout_start'),
    'order_submitted', count(*) filter (where event_name = 'order_submitted')
  ) from public.storefront_analytics_events e
  join public.storefronts s on s.id = e.storefront_id
  where e.storefront_id = p_storefront_id and s.owner_id = auth.uid() and e.occurred_at >= p_from;
$$;

revoke all on function public.get_storefront_analytics_summary(uuid, timestamptz) from public;
grant execute on function public.get_storefront_analytics_summary(uuid, timestamptz) to authenticated;