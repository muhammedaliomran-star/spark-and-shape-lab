alter table public.storefronts
  add column if not exists banner_url text,
  add column if not exists theme_key text not null default 'emerald',
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists minimum_order numeric(12,2) not null default 0,
  add column if not exists opening_hours jsonb not null default '{}'::jsonb;

alter table public.store_orders
  add column if not exists return_id uuid references public.return_records(id) on delete set null;

create index if not exists store_orders_return_idx on public.store_orders (return_id);
