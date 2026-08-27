create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  operation text not null check (operation in ('insert', 'update', 'delete')),
  record_type text not null,
  record_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  order_id uuid references public.store_orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_user_created_idx on public.audit_events(user_id, created_at desc);
create index if not exists audit_events_record_idx on public.audit_events(record_type, record_id, created_at desc);
create index if not exists audit_events_order_idx on public.audit_events(order_id, created_at desc);

alter table public.audit_events enable row level security;
drop policy if exists "Users read own audit events" on public.audit_events;
create policy "Users read own audit events" on public.audit_events
  for select to authenticated using (user_id = auth.uid());
grant select on public.audit_events to authenticated;
grant all on public.audit_events to service_role;

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_after jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_user uuid := coalesce((v_after->>'user_id')::uuid, (v_before->>'user_id')::uuid, auth.uid());
  v_record_id uuid := coalesce((v_after->>'id')::uuid, (v_before->>'id')::uuid);
  v_order_id uuid := coalesce((v_after->>'order_id')::uuid, (v_before->>'order_id')::uuid);
  v_reason text := coalesce(v_after->>'reason', v_after->>'status_reason', v_after->>'notes', v_before->>'reason', v_before->>'status_reason', v_before->>'notes');
begin
  if v_user is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_table_name = 'store_orders' then v_order_id := v_record_id; end if;
  insert into public.audit_events (user_id, actor_user_id, operation, record_type, record_id, before_data, after_data, reason, order_id)
  values (v_user, auth.uid(), lower(tg_op), tg_table_name, v_record_id, v_before, v_after, v_reason, v_order_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['invoices', 'invoice_items', 'payments', 'purchases', 'purchase_items', 'stock_items', 'stock_adjustments', 'return_records', 'return_items', 'store_orders', 'shipments'] loop
    execute format('drop trigger if exists audit_%I on public.%I', v_table, v_table);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', v_table, v_table);
  end loop;
end $$;
