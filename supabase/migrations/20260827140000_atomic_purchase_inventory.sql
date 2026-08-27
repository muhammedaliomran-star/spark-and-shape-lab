create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stock_item_id uuid references public.stock_items(id) on delete set null,
  movement_type text not null check (movement_type in ('purchase', 'sale', 'return', 'adjustment', 'reversal')),
  quantity integer not null,
  unit_cost numeric(12,2) not null default 0,
  reference_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.stock_movements enable row level security;
create policy "Users manage own stock movements" on public.stock_movements for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.stock_movements to authenticated;

create or replace function public.record_purchase_with_inventory(
  p_supplier_id uuid, p_total numeric, p_payment_type text, p_purchase_date date, p_notes text, p_items jsonb, p_purchase_id uuid default gen_random_uuid()
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_item jsonb; v_stock public.stock_items; v_qty integer; v_name text; v_cost numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'أضف صنفًا واحدًا على الأقل'; end if;
  insert into public.purchases (id, user_id, supplier_id, total, payment_type, purchase_date, notes)
    values (p_purchase_id, auth.uid(), p_supplier_id, p_total, p_payment_type, p_purchase_date, p_notes);
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name'); v_qty := (v_item->>'quantity')::integer; v_cost := (v_item->>'unitCost')::numeric;
    if v_name = '' or v_qty is null or v_qty <= 0 or v_cost is null or v_cost <= 0 then raise exception 'بيانات صنف غير صحيحة'; end if;
    insert into public.purchase_items (user_id, purchase_id, name, unit_cost, quantity) values (auth.uid(), p_purchase_id, v_name, v_cost, v_qty);
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_name for update;
    if found then
      update public.stock_items set quantity = quantity + v_qty, last_unit_cost = v_cost, updated_at = now() where id = v_stock.id;
    else
      insert into public.stock_items (user_id, name, quantity, last_unit_cost, sale_price) values (auth.uid(), v_name, v_qty, v_cost, 0) returning * into v_stock;
    end if;
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id) values (auth.uid(), v_stock.id, 'purchase', v_qty, v_cost, p_purchase_id);
  end loop;
  return p_purchase_id;
end;
$$;

create or replace function public.update_purchase_with_inventory(
  p_purchase_id uuid, p_supplier_id uuid, p_total numeric, p_payment_type text, p_purchase_date date, p_notes text, p_items jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_old record; v_item jsonb; v_stock public.stock_items; v_qty integer; v_name text; v_cost numeric;
begin
  if not exists (select 1 from public.purchases where id = p_purchase_id and user_id = auth.uid()) then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  for v_old in select * from public.purchase_items where purchase_id = p_purchase_id and user_id = auth.uid() loop
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_old.name for update;
    if not found or v_stock.quantity < v_old.quantity then raise exception 'المخزون لا يسمح بعكس الفاتورة القديمة: %', v_old.name; end if;
    update public.stock_items set quantity = quantity - v_old.quantity, updated_at = now() where id = v_stock.id;
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes) values (auth.uid(), v_stock.id, 'reversal', -v_old.quantity, v_old.unit_cost, p_purchase_id, 'عكس نسخة الشراء القديمة');
  end loop;
  delete from public.purchase_items where purchase_id = p_purchase_id and user_id = auth.uid();
  update public.purchases set supplier_id = p_supplier_id, total = p_total, payment_type = p_payment_type, purchase_date = p_purchase_date, notes = p_notes where id = p_purchase_id and user_id = auth.uid();
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name'); v_qty := (v_item->>'quantity')::integer; v_cost := (v_item->>'unitCost')::numeric;
    if v_name = '' or v_qty is null or v_qty <= 0 or v_cost is null or v_cost <= 0 then raise exception 'بيانات صنف غير صحيحة'; end if;
    insert into public.purchase_items (user_id, purchase_id, name, unit_cost, quantity) values (auth.uid(), p_purchase_id, v_name, v_cost, v_qty);
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_name for update;
    if found then update public.stock_items set quantity = quantity + v_qty, last_unit_cost = v_cost, updated_at = now() where id = v_stock.id;
    else insert into public.stock_items (user_id, name, quantity, last_unit_cost, sale_price) values (auth.uid(), v_name, v_qty, v_cost, 0) returning * into v_stock; end if;
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id) values (auth.uid(), v_stock.id, 'purchase', v_qty, v_cost, p_purchase_id);
  end loop;
end;
$$;

create or replace function public.delete_purchase_with_inventory(p_purchase_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_old record; v_stock public.stock_items;
begin
  if not exists (select 1 from public.purchases where id = p_purchase_id and user_id = auth.uid()) then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  for v_old in select * from public.purchase_items where purchase_id = p_purchase_id and user_id = auth.uid() loop
    select * into v_stock from public.stock_items where user_id = auth.uid() and name = v_old.name for update;
    if not found or v_stock.quantity < v_old.quantity then raise exception 'المخزون لا يسمح بحذف الفاتورة: %', v_old.name; end if;
    update public.stock_items set quantity = quantity - v_old.quantity, updated_at = now() where id = v_stock.id;
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes) values (auth.uid(), v_stock.id, 'reversal', -v_old.quantity, v_old.unit_cost, p_purchase_id, 'عكس حذف فاتورة الشراء');
  end loop;
  delete from public.purchases where id = p_purchase_id and user_id = auth.uid();
end;
$$;

grant execute on function public.record_purchase_with_inventory(uuid, numeric, text, date, text, jsonb, uuid) to authenticated;
grant execute on function public.update_purchase_with_inventory(uuid, uuid, numeric, text, date, text, jsonb) to authenticated;
grant execute on function public.delete_purchase_with_inventory(uuid) to authenticated;

create or replace function public.log_invoice_item_stock_movement() returns trigger language plpgsql security definer set search_path = public as $$
declare v_stock public.stock_items;
begin
  select * into v_stock from public.stock_items where user_id = new.user_id and name = new.name limit 1;
  if found then
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
      values (new.user_id, v_stock.id, 'sale', -new.quantity, new.cost, new.invoice_id, 'بيع من فاتورة');
  end if;
  return new;
end;
$$;

create or replace function public.log_return_item_stock_movement() returns trigger language plpgsql security definer set search_path = public as $$
declare v_stock public.stock_items; v_type text;
begin
  select type into v_type from public.return_records where id = new.return_id;
  select * into v_stock from public.stock_items where user_id = new.user_id and name = new.name limit 1;
  if found then
    insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
      values (new.user_id, v_stock.id, 'return', case when v_type = 'supplier' then -new.quantity else new.quantity end, new.unit_price, new.return_id, 'مرتجع مخزون');
  end if;
  return new;
end;
$$;

create or replace function public.log_stock_adjustment_movement() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.stock_movements (user_id, stock_item_id, movement_type, quantity, unit_cost, reference_id, notes)
    values (new.user_id, new.stock_item_id, 'adjustment', new.delta, 0, new.id, new.reason);
  return new;
end;
$$;

drop trigger if exists invoice_item_stock_movement on public.invoice_items;
create trigger invoice_item_stock_movement after insert on public.invoice_items for each row execute function public.log_invoice_item_stock_movement();
drop trigger if exists return_item_stock_movement on public.return_items;
create trigger return_item_stock_movement after insert on public.return_items for each row execute function public.log_return_item_stock_movement();
drop trigger if exists stock_adjustment_movement on public.stock_adjustments;
create trigger stock_adjustment_movement after insert on public.stock_adjustments for each row execute function public.log_stock_adjustment_movement();
