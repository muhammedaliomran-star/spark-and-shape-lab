create or replace function public.assign_storefront_shipment(
  p_invoice_id uuid, p_carrier_id uuid, p_zone_id uuid, p_tracking_number text, p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_shipment public.shipments; v_order public.store_orders; v_old_zone uuid; v_fee numeric := 0;
begin
  select * into v_shipment from public.shipments where invoice_id = p_invoice_id and user_id = auth.uid() for update;
  if not found then raise exception 'الشحنة غير موجودة أو غير مسموح'; end if;
  if v_shipment.status in ('shipped', 'delivered', 'returned', 'cancelled') and v_shipment.zone_id is distinct from p_zone_id then raise exception 'لا يمكن تغيير المنطقة بعد بدء تنفيذ الشحنة'; end if;
  if p_carrier_id is not null and not exists (select 1 from public.shipping_carriers where id = p_carrier_id and user_id = auth.uid() and active) then raise exception 'شركة الشحن غير متاحة'; end if;
  if p_zone_id is not null then
    select delivery_cost into v_fee from public.shipping_zones where id = p_zone_id and user_id = auth.uid() and (p_carrier_id is null or carrier_id = p_carrier_id);
    if not found then raise exception 'منطقة الشحن غير متاحة'; end if;
  end if;
  select * into v_order from public.store_orders where invoice_id = p_invoice_id and storefront_id in (select id from public.storefronts where owner_id = auth.uid()) for update;
  v_old_zone := v_shipment.zone_id;
  if v_order.id is not null and v_old_zone is distinct from p_zone_id and nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'سبب تغيير منطقة الشحن مطلوب'; end if;
  update public.shipments set carrier_id = p_carrier_id, zone_id = p_zone_id, tracking_number = nullif(trim(coalesce(p_tracking_number, '')), '') where id = v_shipment.id;
  if v_order.id is not null then
    update public.store_orders set shipping_zone_id = p_zone_id, shipping_fee = v_fee, total = greatest(0, subtotal + v_fee - coalesce(discount_amount, 0)), updated_at = now() where id = v_order.id;
    if v_old_zone is distinct from p_zone_id then
      insert into public.store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), 'shipping_zone_changed', jsonb_build_object('from_zone_id', v_old_zone, 'to_zone_id', p_zone_id, 'old_fee', v_order.shipping_fee, 'new_fee', v_fee, 'reason', trim(p_reason)));
    end if;
  end if;
end;
$$;

revoke all on function public.assign_storefront_shipment(uuid, uuid, uuid, text, text) from public;
grant execute on function public.assign_storefront_shipment(uuid, uuid, uuid, text, text) to authenticated;