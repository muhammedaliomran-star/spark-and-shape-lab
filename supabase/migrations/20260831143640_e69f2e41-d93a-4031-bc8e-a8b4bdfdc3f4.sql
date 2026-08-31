create table public.shipment_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  kind text not null check (kind in ('late', 'status_update')),
  status public.shipment_status,
  title text not null,
  body text not null,
  tracking_identifier text,
  expected_delivery_date date,
  dedupe_key text not null,
  read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

grant select, insert, update, delete on public.shipment_notifications to authenticated;
grant all on public.shipment_notifications to service_role;

alter table public.shipment_notifications enable row level security;

create policy "Users manage own shipment notifications"
on public.shipment_notifications
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index shipment_notifications_user_created_idx
  on public.shipment_notifications (user_id, created_at desc);
create index shipment_notifications_active_late_idx
  on public.shipment_notifications (user_id, shipment_id)
  where kind = 'late' and resolved_at is null;

create or replace function public.set_shipment_expected_delivery_date()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_days integer;
begin
  if new.zone_id is not null and (
    tg_op = 'INSERT'
    or new.expected_delivery_date is null
    or new.zone_id is distinct from old.zone_id
  ) then
    select greatest(coalesce(z.estimated_days, 3), 0)
      into v_days
    from public.shipping_zones z
    where z.id = new.zone_id;
    new.expected_delivery_date := coalesce(new.created_at, now())::date + coalesce(v_days, 3);
  elsif new.expected_delivery_date is null and tg_op = 'INSERT' then
    new.expected_delivery_date := coalesce(new.created_at, now())::date + 3;
  end if;
  return new;
end;
$$;

drop trigger if exists shipments_set_expected_delivery_date on public.shipments;
create trigger shipments_set_expected_delivery_date
before insert or update of zone_id on public.shipments
for each row execute function public.set_shipment_expected_delivery_date();

create or replace function public.sync_late_shipment_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'غير مصرح'; end if;

  insert into public.shipment_notifications (
    user_id, shipment_id, kind, status, title, body,
    tracking_identifier, expected_delivery_date, dedupe_key
  )
  select
    sh.user_id,
    sh.id,
    'late',
    sh.status,
    'شحنة متأخرة عن موعد التسليم',
    concat('الشحنة ', coalesce(so.public_number, sh.tracking_number, left(sh.id::text, 8)), ' تجاوزت موعد التسليم المتوقع ', sh.expected_delivery_date::text),
    coalesce(so.public_number, sh.tracking_number),
    sh.expected_delivery_date,
    concat('late:', sh.id::text, ':', sh.expected_delivery_date::text)
  from public.shipments sh
  left join public.store_orders so on so.invoice_id = sh.invoice_id
  where sh.user_id = auth.uid()
    and sh.status in ('pending', 'processing', 'shipped')
    and sh.expected_delivery_date is not null
    and sh.expected_delivery_date < current_date
  on conflict (user_id, dedupe_key) do update
    set status = excluded.status,
        title = excluded.title,
        body = excluded.body,
        tracking_identifier = excluded.tracking_identifier,
        resolved_at = null;

  get diagnostics v_count = row_count;

  update public.shipment_notifications n
  set resolved_at = coalesce(n.resolved_at, now())
  where n.user_id = auth.uid()
    and n.kind = 'late'
    and n.resolved_at is null
    and not exists (
      select 1 from public.shipments sh
      where sh.id = n.shipment_id
        and sh.user_id = auth.uid()
        and sh.status in ('pending', 'processing', 'shipped')
        and sh.expected_delivery_date is not null
        and sh.expected_delivery_date < current_date
    );

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.sync_late_shipment_notifications() from public;
grant execute on function public.sync_late_shipment_notifications() to authenticated;

create or replace function public.update_storefront_shipment_status(p_shipment_id uuid, p_status public.shipment_status, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shipment public.shipments;
  v_order public.store_orders;
  v_due numeric;
  v_tracking_identifier text;
begin
  select sh.* into v_shipment from public.shipments sh where sh.id = p_shipment_id and sh.user_id = auth.uid() for update;
  if not found then raise exception 'الشحنة غير موجودة أو غير مسموح'; end if;
  if v_shipment.status = 'delivered' and p_status <> 'delivered' then raise exception 'لا يمكن تغيير شحنة تم تسليمها'; end if;
  if v_shipment.status = 'cancelled' and p_status <> 'cancelled' then raise exception 'لا يمكن إعادة فتح شحنة ملغاة'; end if;
  if p_status = 'processing' and v_shipment.status <> 'pending' then raise exception 'يجب أن تبدأ الشحنة من قيد الانتظار'; end if;
  if p_status = 'shipped' and v_shipment.status <> 'processing' then raise exception 'يجب تجهيز الشحنة أولًا'; end if;
  if p_status = 'delivered' and v_shipment.status <> 'shipped' then raise exception 'يجب شحن الطلب أولًا'; end if;
  if p_status = 'returned' and v_shipment.status not in ('shipped', 'delivered') then raise exception 'لا يمكن إرجاع الشحنة في حالتها الحالية'; end if;

  update public.shipments set status = p_status,
    processing_at = case when p_status = 'processing' then coalesce(processing_at, now()) else processing_at end,
    shipped_at = case when p_status = 'shipped' then now() else shipped_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
    returned_at = case when p_status = 'returned' then now() else returned_at end,
    actual_delivery_date = case when p_status = 'delivered' then now() else actual_delivery_date end,
    collection_status = case when p_status = 'delivered' and coalesce(cod_amount, 0) > 0 and collection_status = 'uncollected' then 'collected' else collection_status end,
    collected_at = case when p_status = 'delivered' and coalesce(cod_amount, 0) > 0 and collected_at is null then now() else collected_at end,
    status_updated_by = auth.uid()
  where id = v_shipment.id;

  if p_status = 'delivered' then
    if v_shipment.invoice_id is not null and coalesce(v_shipment.cod_amount, 0) > 0 then
      select greatest(0, i.total - i.paid) into v_due from public.invoices i where i.id = v_shipment.invoice_id and i.user_id = auth.uid();
      if coalesce(v_due, 0) > 0 then
        insert into public.payments (user_id, invoice_id, amount, paid_at)
        values (auth.uid(), v_shipment.invoice_id, least(v_due, v_shipment.cod_amount), now());
        perform public.recalculate_invoice_paid(v_shipment.invoice_id);
      end if;
    end if;
    if coalesce(v_shipment.shipping_cost, 0) > 0 then
      insert into public.expenses (user_id, amount, category, expense_date, notes)
      values (auth.uid(), v_shipment.shipping_cost, 'transport', current_date,
        concat('تكلفة شحن - شحنة ', coalesce(v_shipment.tracking_number, v_shipment.id::text)));
    end if;
  end if;

  if v_shipment.invoice_id is not null then
    select * into v_order from public.store_orders where invoice_id = v_shipment.invoice_id for update;
    if found and p_status in ('shipped', 'delivered') then update public.store_orders set status = p_status::text, updated_at = now() where id = v_order.id; end if;
    if found and p_status = 'returned' then update public.store_orders set status = 'cancelled', status_reason = nullif(trim(coalesce(p_reason, '')), ''), updated_at = now() where id = v_order.id; end if;
    if found then
      insert into public.store_order_events (order_id, actor_user_id, event_type, payload)
      values (v_order.id, auth.uid(), p_status::text, jsonb_build_object('shipment_id', v_shipment.id, 'reason', p_reason));
      v_tracking_identifier := v_order.public_number;
    end if;
  end if;

  v_tracking_identifier := coalesce(v_tracking_identifier, v_shipment.tracking_number);
  insert into public.shipment_notifications (
    user_id, shipment_id, kind, status, title, body, tracking_identifier, expected_delivery_date, dedupe_key
  ) values (
    auth.uid(), v_shipment.id, 'status_update', p_status,
    'تحديث حالة الشحنة',
    concat('تم تغيير حالة شحنة ', coalesce(v_tracking_identifier, left(v_shipment.id::text, 8)), ' إلى ', p_status::text, '. رابط التتبع جاهز للإرسال للعميل.'),
    v_tracking_identifier,
    v_shipment.expected_delivery_date,
    concat('status:', v_shipment.id::text, ':', p_status::text)
  ) on conflict (user_id, dedupe_key) do nothing;

  if p_status in ('delivered', 'returned', 'cancelled') then
    update public.shipment_notifications
    set resolved_at = coalesce(resolved_at, now())
    where user_id = auth.uid() and shipment_id = v_shipment.id and kind = 'late' and resolved_at is null;
  end if;
end;
$$;

revoke all on function public.update_storefront_shipment_status(uuid, public.shipment_status, text) from public;
grant execute on function public.update_storefront_shipment_status(uuid, public.shipment_status, text) to authenticated;

create or replace function public.get_public_order_status(p_public_number text, p_customer_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'public_number', o.public_number,
    'status', o.status,
    'order_type', o.order_type,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'total', o.total,
    'shipping_fee', o.shipping_fee,
    'items', coalesce((select jsonb_agg(jsonb_build_object('title', i.product_title, 'quantity', i.quantity)) from public.store_order_items i where i.order_id = o.id), '[]'::jsonb)
  ) into v_result
  from public.store_orders o
  where upper(o.public_number) = upper(trim(p_public_number))
    and regexp_replace(o.customer_phone, '[^0-9]+', '', 'g') = regexp_replace(trim(p_customer_phone), '[^0-9]+', '', 'g');

  if v_result is not null then return v_result; end if;

  select jsonb_build_object(
    'public_number', coalesce(sh.tracking_number, left(sh.id::text, 8)),
    'status', case sh.status
      when 'pending' then 'submitted'
      when 'processing' then 'under_review'
      else sh.status::text
    end,
    'order_type', 'cash_on_delivery',
    'created_at', sh.created_at,
    'updated_at', coalesce(sh.actual_delivery_date, sh.created_at),
    'total', sh.cod_amount,
    'shipping_fee', sh.shipping_cost,
    'items', '[]'::jsonb
  ) into v_result
  from public.shipments sh
  where upper(coalesce(sh.tracking_number, '')) = upper(trim(p_public_number))
    and regexp_replace(coalesce(sh.recipient_phone, ''), '[^0-9]+', '', 'g') = regexp_replace(trim(p_customer_phone), '[^0-9]+', '', 'g')
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.get_public_order_status(text, text) from public;
grant execute on function public.get_public_order_status(text, text) to anon, authenticated;