-- Atomic payment operations: invoice.paid is always derived from the invoice down payment plus payment rows.
create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_id uuid default gen_random_uuid(),
  p_paid_at timestamptz default now()
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_invoice public.invoices; v_paid numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'مبلغ التحصيل يجب أن يكون أكبر من صفر'; end if;
  select i.* into v_invoice from public.invoices i where i.id = p_invoice_id and i.user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  if v_invoice.status = 'cancelled' then raise exception 'لا يمكن التحصيل من فاتورة ملغاة'; end if;
  if p_amount > greatest(0, v_invoice.total - v_invoice.paid) then raise exception 'مبلغ التحصيل أكبر من المتبقي'; end if;
  insert into public.payments (id, user_id, invoice_id, amount, paid_at) values (p_payment_id, auth.uid(), p_invoice_id, p_amount, p_paid_at);
  select v_invoice.down_payment + coalesce(sum(p.amount), 0) into v_paid from public.payments p where p.invoice_id = p_invoice_id;
  v_paid := least(v_invoice.total, v_paid);
  update public.invoices set paid = v_paid, status = case when v_paid >= total then 'paid' else status end where id = p_invoice_id;
  return jsonb_build_object('payment_id', p_payment_id, 'invoice_id', p_invoice_id, 'paid', v_paid);
end;
$$;

create or replace function public.update_invoice_payment(p_payment_id uuid, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_payment public.payments; v_invoice public.invoices; v_other numeric; v_paid numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'مبلغ التحصيل يجب أن يكون أكبر من صفر'; end if;
  select p.* into v_payment from public.payments p where p.id = p_payment_id and p.user_id = auth.uid() for update;
  if not found then raise exception 'الدفعة غير موجودة أو غير مسموح'; end if;
  select i.* into v_invoice from public.invoices i where i.id = v_payment.invoice_id and i.user_id = auth.uid() for update;
  select coalesce(sum(p.amount), 0) into v_other from public.payments p where p.invoice_id = v_invoice.id and p.id <> v_payment.id;
  if v_invoice.status = 'cancelled' or p_amount > greatest(0, v_invoice.total - v_invoice.down_payment - v_other) then raise exception 'مبلغ التحصيل أكبر من المتبقي'; end if;
  update public.payments set amount = p_amount where id = p_payment_id;
  v_paid := least(v_invoice.total, v_invoice.down_payment + v_other + p_amount);
  update public.invoices set paid = v_paid, status = case when v_paid >= total then 'paid' when status = 'paid' then 'pending' else status end where id = v_invoice.id;
  return jsonb_build_object('payment_id', p_payment_id, 'invoice_id', v_invoice.id, 'paid', v_paid);
end;
$$;

create or replace function public.delete_invoice_payment(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_payment public.payments; v_invoice public.invoices; v_paid numeric;
begin
  select p.* into v_payment from public.payments p where p.id = p_payment_id and p.user_id = auth.uid() for update;
  if not found then raise exception 'الدفعة غير موجودة أو غير مسموح'; end if;
  select i.* into v_invoice from public.invoices i where i.id = v_payment.invoice_id and i.user_id = auth.uid() for update;
  delete from public.payments where id = p_payment_id;
  select least(v_invoice.total, v_invoice.down_payment + coalesce(sum(p.amount), 0)) into v_paid from public.payments p where p.invoice_id = v_invoice.id;
  update public.invoices set paid = v_paid, status = case when v_paid < total and status = 'paid' then 'pending' else status end where id = v_invoice.id;
  return jsonb_build_object('payment_id', p_payment_id, 'invoice_id', v_invoice.id, 'paid', v_paid);
end;
$$;

create or replace function public.recalculate_invoice_paid(p_invoice_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_invoice public.invoices; v_paid numeric;
begin
  select i.* into v_invoice from public.invoices i where i.id = p_invoice_id and i.user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  select least(v_invoice.total, v_invoice.down_payment + coalesce(sum(p.amount), 0)) into v_paid from public.payments p where p.invoice_id = v_invoice.id;
  update public.invoices set paid = v_paid, status = case when v_paid >= total then 'paid' when status = 'paid' then 'pending' else status end where id = v_invoice.id;
  return v_paid;
end;
$$;

grant execute on function public.record_invoice_payment(uuid, numeric, uuid, timestamptz) to authenticated;
grant execute on function public.update_invoice_payment(uuid, numeric) to authenticated;
grant execute on function public.delete_invoice_payment(uuid) to authenticated;
grant execute on function public.recalculate_invoice_paid(uuid) to authenticated;
