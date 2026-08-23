-- Storefront MVP: public catalogue + reviewed orders, isolated from internal accounting data.

-- This migration may be applied to projects where the earlier shipping migration
-- was not run, so every shipping dependency is created defensively here.
do $$ begin
  create type public.store_order_status as enum ('submitted', 'under_review', 'needs_info', 'accepted', 'invoiced', 'shipped', 'delivered', 'rejected', 'cancelled', 'expired');
exception when duplicate_object then null; end $$;
do $$ begin create type public.store_order_type as enum ('cash_on_delivery', 'installment_request'); exception when duplicate_object then null; end $$;
do $$ begin create type public.stock_reservation_status as enum ('active', 'released', 'consumed', 'expired'); exception when duplicate_object then null; end $$;
do $$ begin create type public.shipment_status as enum ('pending', 'processing', 'shipped', 'delivered', 'returned', 'cancelled'); exception when duplicate_object then null; end $$;

create table if not exists public.shipping_carriers (
  id uuid primary key default gen_random_uuid(), name text not null, contact_person text, phone text, email text,
  base_cost numeric(12,2) default 0, active boolean default true, created_at timestamptz default now()
);
create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(), name text not null,
  carrier_id uuid references public.shipping_carriers(id) on delete cascade,
  delivery_cost numeric(12,2) default 0, estimated_days integer default 2, created_at timestamptz default now()
);
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  carrier_id uuid references public.shipping_carriers(id), zone_id uuid references public.shipping_zones(id),
  tracking_number text unique, status public.shipment_status default 'pending', recipient_name text, recipient_phone text,
  delivery_address text, actual_delivery_date timestamptz, notes text, created_at timestamptz default now()
);
alter table public.shipments add column if not exists user_id uuid references auth.users(id) on delete cascade;
grant select, insert, update, delete on public.shipments to authenticated;
grant all on public.shipments to service_role;
alter table public.shipments enable row level security;
do $$ begin
  create policy "Storefront owners manage shipments" on public.shipments for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

create table if not exists public.storefronts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  branch_id uuid,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,48}$'),
  name text not null check (char_length(name) between 2 and 100),
  phone text,
  whatsapp_phone text,
  logo_url text,
  description text,
  shipping_policy text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.storefront_categories (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  slug text not null check (slug ~ '^[a-z0-9-]{2,48}$'),
  sort_order integer not null default 0,
  unique (storefront_id, slug)
);

create table if not exists public.storefront_products (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  stock_item_id uuid not null references public.stock_items(id) on delete restrict,
  category_id uuid references public.storefront_categories(id) on delete set null,
  slug text not null check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null check (char_length(title) between 2 and 160),
  description text,
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  display_price numeric(12,2) not null check (display_price >= 0),
  show_installments boolean not null default false,
  down_payment_from numeric(12,2),
  monthly_payment_from numeric(12,2),
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storefront_id, slug),
  unique (storefront_id, stock_item_id),
  check (
    (not show_installments) or
    (down_payment_from is not null and monthly_payment_from is not null and down_payment_from >= 0 and monthly_payment_from > 0)
  )
);

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  public_number text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  storefront_id uuid not null references public.storefronts(id) on delete restrict,
  status public.store_order_status not null default 'submitted',
  order_type public.store_order_type not null,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_phone text not null check (char_length(customer_phone) between 8 and 24),
  delivery_address text not null check (char_length(delivery_address) between 8 and 500),
  delivery_area text,
  notes text,
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  total numeric(12,2) not null check (total >= 0),
  invoice_id uuid unique references public.invoices(id) on delete set null,
  reservation_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  storefront_product_id uuid references public.storefront_products(id) on delete set null,
  stock_item_id uuid references public.stock_items(id) on delete set null,
  product_title text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  product_snapshot jsonb not null default '{}'::jsonb
);

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.stock_items(id) on delete restrict,
  order_id uuid not null references public.store_orders(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status public.stock_reservation_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  unique (order_id, stock_item_id)
);

create table if not exists public.store_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists storefront_products_public_idx on public.storefront_products (storefront_id, is_published, sort_order);
create index if not exists store_orders_storefront_status_idx on public.store_orders (storefront_id, status, created_at desc);
create index if not exists stock_reservations_active_idx on public.stock_reservations (stock_item_id, status, expires_at);

alter table public.storefronts enable row level security;
alter table public.storefront_categories enable row level security;
alter table public.storefront_products enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.store_order_events enable row level security;

drop policy if exists "Owners manage storefronts" on public.storefronts;
create policy "Owners manage storefronts" on public.storefronts for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Owners manage storefront categories" on public.storefront_categories;
create policy "Owners manage storefront categories" on public.storefront_categories for all to authenticated
  using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));
drop policy if exists "Owners manage storefront products" on public.storefront_products;
create policy "Owners manage storefront products" on public.storefront_products for all to authenticated
  using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));
drop policy if exists "Owners manage storefront orders" on public.store_orders;
create policy "Owners manage storefront orders" on public.store_orders for all to authenticated
  using (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.storefronts s where s.id = storefront_id and s.owner_id = auth.uid()));
drop policy if exists "Owners read storefront order items" on public.store_order_items;
create policy "Owners read storefront order items" on public.store_order_items for select to authenticated
  using (exists (select 1 from public.store_orders o join public.storefronts s on s.id = o.storefront_id where o.id = order_id and s.owner_id = auth.uid()));
drop policy if exists "Owners read storefront reservations" on public.stock_reservations;
create policy "Owners read storefront reservations" on public.stock_reservations for select to authenticated
  using (exists (select 1 from public.store_orders o join public.storefronts s on s.id = o.storefront_id where o.id = order_id and s.owner_id = auth.uid()));
drop policy if exists "Owners read storefront events" on public.store_order_events;
create policy "Owners read storefront events" on public.store_order_events for select to authenticated
  using (exists (select 1 from public.store_orders o join public.storefronts s on s.id = o.storefront_id where o.id = order_id and s.owner_id = auth.uid()));

create or replace function public.get_public_storefront(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'storefront', jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'phone', s.phone, 'whatsapp_phone', s.whatsapp_phone, 'logo_url', s.logo_url, 'description', s.description, 'shipping_policy', s.shipping_policy),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'sort_order', c.sort_order) order by c.sort_order, c.name) from storefront_categories c where c.storefront_id = s.id), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'title', p.title, 'description', p.description, 'images', p.images, 'display_price', p.display_price, 'show_installments', p.show_installments, 'down_payment_from', p.down_payment_from, 'monthly_payment_from', p.monthly_payment_from, 'category_id', p.category_id, 'available_quantity', greatest(si.quantity - coalesce((select sum(r.quantity) from stock_reservations r where r.stock_item_id = si.id and r.status = 'active' and r.expires_at > now()), 0), 0)) order by p.sort_order, p.title) from storefront_products p join stock_items si on si.id = p.stock_item_id where p.storefront_id = s.id and p.is_published and (si.quantity - coalesce((select sum(r.quantity) from stock_reservations r where r.stock_item_id = si.id and r.status = 'active' and r.expires_at > now()), 0)) > 0), '[]'::jsonb)
  ) from storefronts s where s.slug = lower(p_slug) and s.is_published;
$$;

create or replace function public.submit_store_order(
  p_storefront_id uuid, p_customer_name text, p_customer_phone text, p_delivery_address text,
  p_delivery_area text, p_notes text, p_order_type public.store_order_type, p_items jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order store_orders; v_item jsonb; v_product storefront_products; v_stock stock_items; v_qty integer; v_subtotal numeric := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'السلة فارغة'; end if;
  if not exists (select 1 from storefronts where id = p_storefront_id and is_published) then raise exception 'المتجر غير متاح'; end if;
  insert into store_orders (storefront_id, customer_name, customer_phone, delivery_address, delivery_area, notes, order_type, subtotal, total)
  values (p_storefront_id, trim(p_customer_name), trim(p_customer_phone), trim(p_delivery_address), nullif(trim(coalesce(p_delivery_area, '')), ''), nullif(trim(coalesce(p_notes, '')), ''), p_order_type, 0, 0) returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select p.* into v_product from storefront_products p
      where p.id = (v_item->>'product_id')::uuid and p.storefront_id = p_storefront_id and p.is_published for share;
    if not found or v_qty is null or v_qty < 1 then raise exception 'منتج غير متاح بالكمية المطلوبة'; end if;
    select si.* into v_stock from stock_items si where si.id = v_product.stock_item_id for share;
    if not found or v_stock.quantity < v_qty then raise exception 'منتج غير متاح بالكمية المطلوبة'; end if;
    insert into store_order_items (order_id, storefront_product_id, stock_item_id, product_title, unit_price, quantity, line_total, product_snapshot)
      values (v_order.id, v_product.id, v_product.stock_item_id, v_product.title, v_product.display_price, v_qty, v_product.display_price * v_qty,
        jsonb_build_object('title', v_product.title, 'slug', v_product.slug, 'images', v_product.images, 'display_price', v_product.display_price));
    v_subtotal := v_subtotal + (v_product.display_price * v_qty);
  end loop;
  update store_orders set subtotal = v_subtotal, total = v_subtotal, updated_at = now() where id = v_order.id returning * into v_order;
  insert into store_order_events (order_id, event_type, payload) values (v_order.id, 'submitted', jsonb_build_object('source', 'public_storefront'));
  return jsonb_build_object('id', v_order.id, 'public_number', v_order.public_number, 'status', v_order.status);
end;
$$;

create or replace function public.accept_store_order(p_order_id uuid)
returns public.store_orders language plpgsql security definer set search_path = public as $$
declare v_order store_orders; v_item store_order_items; v_stock stock_items; v_reserved integer;
begin
  select o.* into v_order from store_orders o join storefronts s on s.id = o.storefront_id
    where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if v_order.status not in ('submitted', 'under_review', 'needs_info') then raise exception 'لا يمكن قبول الطلب في حالته الحالية'; end if;
  update stock_reservations set status = 'expired', released_at = now() where status = 'active' and expires_at <= now();
  for v_item in select * from store_order_items where order_id = v_order.id loop
    select * into v_stock from stock_items where id = v_item.stock_item_id for update;
    select coalesce(sum(quantity), 0) into v_reserved from stock_reservations where stock_item_id = v_item.stock_item_id and status = 'active' and expires_at > now();
    if v_stock.quantity - v_reserved < v_item.quantity then raise exception 'المخزون لم يعد كافيًا للمنتج: %', v_item.product_title; end if;
    insert into stock_reservations (stock_item_id, order_id, quantity, status, expires_at)
      values (v_item.stock_item_id, v_order.id, v_item.quantity, 'active', now() + interval '24 hours');
  end loop;
  update store_orders set status = 'accepted', reservation_expires_at = now() + interval '24 hours', updated_at = now() where id = v_order.id returning * into v_order;
  insert into store_order_events (order_id, actor_user_id, event_type) values (v_order.id, auth.uid(), 'accepted');
  return v_order;
end;
$$;

-- Converts a reviewed cash order once. Installment requests intentionally stay in
-- review until the merchant records the agreed terms in the invoicing flow.
create or replace function public.invoice_store_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order store_orders; v_owner uuid; v_customer_id uuid; v_invoice_id uuid; v_item store_order_items; v_stock stock_items;
begin
  select o.* into v_order from store_orders o join storefronts s on s.id = o.storefront_id
    where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  select owner_id into v_owner from storefronts where id = v_order.storefront_id;
  if v_order.invoice_id is not null then return jsonb_build_object('invoice_id', v_order.invoice_id, 'already_invoiced', true); end if;
  if v_order.status <> 'accepted' then raise exception 'اقبل الطلب واحجز الكمية قبل إنشاء الفاتورة'; end if;
  if v_order.order_type <> 'cash_on_delivery' then raise exception 'طلب التقسيط يحتاج إدخال شروط الاتفاق قبل إنشاء الفاتورة'; end if;

  select id into v_customer_id from customers where user_id = v_owner and phone = v_order.customer_phone order by created_at asc limit 1;
  if v_customer_id is null then
    insert into customers (user_id, name, phone, address) values (v_owner, v_order.customer_name, v_order.customer_phone, v_order.delivery_address) returning id into v_customer_id;
  end if;
  insert into invoices (user_id, customer_id, total, down_payment, monthly_installment, first_due_date, paid, notes, status)
    values (v_owner, v_customer_id, v_order.total, 0, 0, current_date, 0, concat('طلب متجر #', v_order.public_number), 'pending') returning id into v_invoice_id;
  for v_item in select * from store_order_items where order_id = v_order.id loop
    select * into v_stock from stock_items where id = v_item.stock_item_id for update;
    if not found or v_stock.quantity < v_item.quantity then raise exception 'المخزون غير كافٍ لإتمام الفاتورة: %', v_item.product_title; end if;
    insert into invoice_items (user_id, invoice_id, name, cost, price)
      select v_owner, v_invoice_id, v_item.product_title, v_stock.last_unit_cost, v_item.unit_price from generate_series(1, v_item.quantity);
    update stock_items set quantity = quantity - v_item.quantity, updated_at = now() where id = v_stock.id;
    update stock_reservations set status = 'consumed', released_at = now() where order_id = v_order.id and stock_item_id = v_stock.id and status = 'active';
  end loop;
  insert into shipments (user_id, invoice_id, status, recipient_name, recipient_phone, delivery_address, notes)
    values (v_owner, v_invoice_id, 'pending', v_order.customer_name, v_order.customer_phone, v_order.delivery_address, concat('طلب متجر #', v_order.public_number));
  update store_orders set invoice_id = v_invoice_id, status = 'invoiced', updated_at = now() where id = v_order.id;
  insert into store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), 'invoiced', jsonb_build_object('invoice_id', v_invoice_id));
  return jsonb_build_object('invoice_id', v_invoice_id, 'already_invoiced', false);
end;
$$;

grant execute on function public.get_public_storefront(text) to anon, authenticated;
grant execute on function public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb) to anon, authenticated;
grant execute on function public.accept_store_order(uuid) to authenticated;
grant execute on function public.invoice_store_order(uuid) to authenticated;
