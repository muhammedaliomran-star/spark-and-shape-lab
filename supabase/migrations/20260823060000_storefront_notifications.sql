-- Phase 7: in-app merchant notifications for storefront activity.

create table if not exists public.storefront_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.store_orders(id) on delete cascade,
  event_id uuid references public.store_order_events(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id)
);

alter table public.storefront_notifications enable row level security;
drop policy if exists "Users read own storefront notifications" on public.storefront_notifications;
create policy "Users read own storefront notifications" on public.storefront_notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users update own storefront notifications" on public.storefront_notifications;
create policy "Users update own storefront notifications" on public.storefront_notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify_storefront_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text; v_body text;
begin
  select s.owner_id into v_owner from public.store_orders o join public.storefronts s on s.id = o.storefront_id where o.id = new.order_id;
  if v_owner is null then return new; end if;
  v_title := case new.event_type when 'submitted' then 'طلب جديد من المتجر' when 'accepted' then 'تم قبول طلب' when 'invoiced' then 'تم إنشاء فاتورة' when 'cancelled' then 'تم إلغاء طلب' when 'rejected' then 'تم رفض طلب' else 'تحديث على طلب' end;
  v_body := coalesce(new.payload->>'reason', 'رقم الطلب: ' || new.order_id::text);
  insert into public.storefront_notifications (user_id, order_id, event_id, title, body) values (v_owner, new.order_id, new.id, v_title, v_body) on conflict (event_id) do nothing;
  return new;
end;
$$;

drop trigger if exists store_order_event_notification on public.store_order_events;
create trigger store_order_event_notification after insert on public.store_order_events for each row execute function public.notify_storefront_event();