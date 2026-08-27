create or replace function public.create_invoice_shipment(
  p_invoice_id uuid,
  p_carrier_id uuid default null,
  p_zone_id uuid default null,
  p_tracking_number text default null
) returns public.shipments language plpgsql security definer set search_path = public as $$
declare
  v_invoice public.invoices;
  v_customer public.customers;
  v_shipment public.shipments;
  v_tracking text := nullif(trim(coalesce(p_tracking_number, '')), '');
begin
  select * into v_invoice from public.invoices where id = p_invoice_id and user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  if v_invoice.status = 'cancelled' then raise exception 'لا يمكن إنشاء شحنة لفاتورة ملغاة'; end if;
  if exists (select 1 from public.shipments where invoice_id = p_invoice_id) then raise exception 'يوجد شحنة مسجلة لهذه الفاتورة بالفعل'; end if;
  if p_carrier_id is not null and not exists (select 1 from public.shipping_carriers where id = p_carrier_id and user_id = auth.uid() and active) then raise exception 'شركة الشحن غير متاحة'; end if;
  if p_zone_id is not null and not exists (select 1 from public.shipping_zones where id = p_zone_id and user_id = auth.uid() and (p_carrier_id is null or carrier_id = p_carrier_id)) then raise exception 'منطقة الشحن غير متاحة'; end if;
  select * into v_customer from public.customers where id = v_invoice.customer_id and user_id = auth.uid();
  insert into public.shipments (user_id, invoice_id, carrier_id, zone_id, tracking_number, status, recipient_name, recipient_phone, delivery_address)
    values (auth.uid(), p_invoice_id, p_carrier_id, p_zone_id, v_tracking, 'pending', v_customer.name, v_customer.phone, v_customer.address)
    returning * into v_shipment;
  return v_shipment;
exception when unique_violation then
  raise exception 'يوجد شحنة مسجلة لهذه الفاتورة أو رقم التتبع مستخدم بالفعل';
end;
$$;

revoke all on function public.create_invoice_shipment(uuid, uuid, uuid, text) from public;
grant execute on function public.create_invoice_shipment(uuid, uuid, uuid, text) to authenticated;
