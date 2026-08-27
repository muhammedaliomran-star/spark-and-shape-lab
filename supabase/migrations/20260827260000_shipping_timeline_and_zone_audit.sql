alter table public.shipments
  add column if not exists processing_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists returned_at timestamptz,
  add column if not exists status_updated_by uuid references auth.users(id) on delete set null;

create or replace function public.assign_storefront_shipment(
  p_invoice_id uuid, p_carrier_id uuid, p_zone_id uuid, p_tracking_number text, p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_shipment public.shipments; v_order public.store_orders; v_old_zone uuid;
begin
  select sh.* into v_shipment from public.shipments sh where sh.invoice_id = p_invoice_id and sh.user_id = auth.uid() for update;
  if not found then raise exception 'الشحنة غير موجودة أو غير مسموح'; end if;
  if p_carrier_id is not null and not exists (select 1 from public.shipping_carriers where id = p_carrier_id and user_id = auth.uid() and active) then raise exception 'المندوب غير متاح'; end if;
  if p_zone_id is not null and not exists (select 1 from public.shipping_zones where id = p_zone_id and user_id = auth.uid() and (p_carrier_id is null or carrier_id = p_carrier_id)) then raise exception 'منطقة الشحن غير متاحة'; end if;
  select * into v_order from public.store_orders where invoice_id = p_invoice_id and storefront_id in (select id from public.storefronts where owner_id = auth.uid()) for update;
  v_old_zone := v_shipment.zone_id;
  if v_order.id is not null and v_old_zone is distinct from p_zone_id and nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'سبب تغيير منطقة الشحن مطلوب'; end if;
  update public.shipments set carrier_id = p_carrier_id, zone_id = p_zone_id, tracking_number = nullif(trim(coalesce(p_tracking_number, '')), '') where id = v_shipment.id;
  if v_order.id is not null and v_old_zone is distinct from p_zone_id then
    insert into public.store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), 'shipping_zone_changed', jsonb_build_object('from_zone_id', v_old_zone, 'to_zone_id', p_zone_id, 'reason', trim(p_reason)));
  end if;
end;
$$;

create or replace function public.update_storefront_shipment_status(p_shipment_id uuid, p_status public.shipment_status, p_reason text default null) returns void language plpgsql security definer set search_path = public as $$
declare v_shipment public.shipments; v_order public.store_orders;
begin
  select sh.* into v_shipment from public.shipments sh where sh.id = p_shipment_id and sh.user_id = auth.uid() for update;
  if not found then raise exception 'الشحنة غير موجودة أو غير مسموح'; end if;
  if v_shipment.status = 'delivered' and p_status <> 'delivered' then raise exception 'لا يمكن تغيير شحنة تم تسليمها'; end if;
  if v_shipment.status = 'cancelled' and p_status <> 'cancelled' then raise exception 'لا يمكن إعادة فتح شحنة ملغاة'; end if;
  if p_status = 'processing' and v_shipment.status <> 'pending' then raise exception 'يجب أن تبدأ الشحنة من قيد الانتظار'; end if;
  if p_status = 'shipped' and v_shipment.status <> 'processing' then raise exception 'يجب تجهيز الشحنة أولًا'; end if;
  if p_status = 'delivered' and v_shipment.status <> 'shipped' then raise exception 'يجب شحن الطلب أولًا'; end if;
  if p_status = 'returned' and v_shipment.status not in ('shipped', 'delivered') then raise exception 'لا يمكن إرجاع الشحنة في حالتها الحالية'; end if;
  update public.shipments set status = p_status, processing_at = case when p_status = 'processing' then coalesce(processing_at, now()) else processing_at end, shipped_at = case when p_status = 'shipped' then now() else shipped_at end, delivered_at = case when p_status = 'delivered' then now() else delivered_at end, returned_at = case when p_status = 'returned' then now() else returned_at end, actual_delivery_date = case when p_status = 'delivered' then now() else actual_delivery_date end, status_updated_by = auth.uid() where id = v_shipment.id;
  if v_shipment.invoice_id is not null then
    select * into v_order from public.store_orders where invoice_id = v_shipment.invoice_id for update;
    if found and p_status in ('shipped', 'delivered') then update public.store_orders set status = p_status::text, updated_at = now() where id = v_order.id; end if;
    if found and p_status = 'returned' then update public.store_orders set status = 'cancelled', status_reason = nullif(trim(coalesce(p_reason, '')), ''), updated_at = now() where id = v_order.id; end if;
    if found then insert into public.store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), p_status::text, jsonb_build_object('shipment_id', v_shipment.id, 'reason', p_reason)); end if;
  end if;
end;
$$;

revoke all on function public.assign_storefront_shipment(uuid, uuid, uuid, text, text) from public;
grant execute on function public.assign_storefront_shipment(uuid, uuid, uuid, text, text) to authenticated;