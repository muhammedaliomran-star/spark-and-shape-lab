-- Phase 2 prerequisite: shipping configuration belongs to one merchant.

alter table public.shipping_carriers
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.shipping_zones
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop policy if exists "Allow authenticated full access to shipping_carriers" on public.shipping_carriers;
drop policy if exists "Allow authenticated full access to shipping_zones" on public.shipping_zones;
drop policy if exists "Storefront owners manage shipments" on public.shipments;

create policy "Users manage own shipping carriers" on public.shipping_carriers
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own shipping zones" on public.shipping_zones
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own shipments" on public.shipments
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists shipping_carriers_user_idx on public.shipping_carriers (user_id, active);
create index if not exists shipping_zones_user_idx on public.shipping_zones (user_id, name);