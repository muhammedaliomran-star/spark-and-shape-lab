alter table public.invoice_items
  add column if not exists quantity integer not null default 1;

alter table public.invoice_items
  drop constraint if exists invoice_items_quantity_check;

alter table public.invoice_items
  add constraint invoice_items_quantity_check check (quantity > 0);

alter table public.invoice_items
  drop constraint if exists invoice_items_money_scale_check;

alter table public.invoice_items
  add constraint invoice_items_money_scale_check check (
    cost = round(cost, 2) and price = round(price, 2)
  );
