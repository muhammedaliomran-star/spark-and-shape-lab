-- Phase 10: custom domain lifecycle foundation.

create table if not exists public.storefront_domains (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  domain text not null unique check (domain = lower(domain) and domain !~ '[^a-z0-9.-]'),
  status text not null default 'pending_dns' check (status in ('pending_dns', 'pending_ssl', 'active', 'disabled')),
  verification_token text not null default encode(gen_random_bytes(18), 'hex'),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.storefront_domains enable row level security;
create policy "Owners manage storefront domains" on public.storefront_domains for all to authenticated using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid())) with check (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));

create index if not exists storefront_domains_store_idx on public.storefront_domains (storefront_id, status);