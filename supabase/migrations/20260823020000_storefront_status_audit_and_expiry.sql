-- Storefront phase 1: route merchant status changes through audited RPCs
-- and schedule reservation cleanup independently of customer traffic.

create extension if not exists pg_cron;

create or replace function public.update_store_order_status(
  p_order_id uuid,
  p_status public.store_order_status,
  p_reason text default null
)
returns public.store_orders language plpgsql security definer set search_path = public as $$
declare v_order public.store_orders;
begin
  select o.* into v_order
  from public.store_orders o
  join public.storefronts s on s.id = o.storefront_id
  where o.id = p_order_id and s.owner_id = auth.uid()
  for update of o;

  if not found then raise exception 'الطلب غير موجود أو غير مسموح'; end if;
  if p_status not in ('under_review', 'needs_info', 'rejected') then
    raise exception 'تغيير الحالة غير مسموح من هذا المسار';
  end if;
  if v_order.status in ('invoiced', 'shipped', 'delivered', 'cancelled', 'expired') then
    raise exception 'لا يمكن تغيير حالة الطلب بعد إغلاقه';
  end if;
  if p_status = 'rejected' and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'سبب الرفض مطلوب';
  end if;

  update public.store_orders
  set status = p_status,
      status_reason = nullif(trim(coalesce(p_reason, '')), ''),
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into public.store_order_events (order_id, actor_user_id, event_type, payload)
  values (v_order.id, auth.uid(), p_status::text, jsonb_build_object('reason', v_order.status_reason));
  return v_order;
end;
$$;

revoke all on function public.update_store_order_status(uuid, public.store_order_status, text) from public;
grant execute on function public.update_store_order_status(uuid, public.store_order_status, text) to authenticated;

revoke all on function public.expire_storefront_reservations() from public, authenticated;
grant execute on function public.expire_storefront_reservations() to service_role;

do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-storefront-reservations';
    perform cron.schedule('expire-storefront-reservations', '*/5 * * * *', $cron$select public.expire_storefront_reservations();$cron$);
  end if;
exception when undefined_table or undefined_function then
  null;
end;
$$;