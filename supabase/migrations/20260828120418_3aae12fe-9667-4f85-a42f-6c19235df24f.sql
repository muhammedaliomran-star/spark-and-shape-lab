alter table public.shipments
  add column if not exists shipping_cost numeric not null default 0,
  add column if not exists cod_amount numeric not null default 0,
  add column if not exists collection_status text not null default 'uncollected',
  add column if not exists collected_at timestamptz,
  add column if not exists settled_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shipments_collection_status_chk') then
    alter table public.shipments add constraint shipments_collection_status_chk
      check (collection_status in ('uncollected', 'collected', 'settled'));
  end if;
end $$;

create or replace function public.update_storefront_shipment_status(p_shipment_id uuid, p_status public.shipment_status, p_reason text default null) returns void language plpgsql security definer set search_path = public as $$
declare v_shipment public.shipments; v_order public.store_orders; v_due numeric;
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
    if found then insert into public.store_order_events (order_id, actor_user_id, event_type, payload) values (v_order.id, auth.uid(), p_status::text, jsonb_build_object('shipment_id', v_shipment.id, 'reason', p_reason)); end if;
  end if;
end;
$$;

create or replace function public.settle_carrier_collections(p_carrier_id uuid) returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not exists (select 1 from public.shipping_carriers where id = p_carrier_id and user_id = auth.uid()) then
    raise exception 'المندوب غير موجود أو غير مسموح';
  end if;
  with upd as (
    update public.shipments set collection_status = 'settled', settled_at = now()
    where user_id = auth.uid() and carrier_id = p_carrier_id and collection_status = 'collected'
    returning id
  ) select count(*) into v_count from upd;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.settle_carrier_collections(uuid) from public;
grant execute on function public.settle_carrier_collections(uuid) to authenticated;