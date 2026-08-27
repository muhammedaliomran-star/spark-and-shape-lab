create or replace function public.guard_store_order_transition()
returns trigger language plpgsql as $$
begin
  if old.status = new.status then return new; end if;
  if current_setting('app.allow_shipment_reversal', true) = 'on'
    and old.status = 'returned' and new.status = 'pending' then
    return new;
  end if;
  if not (
    (old.status = 'submitted' and new.status in ('under_review', 'needs_info', 'accepted', 'rejected', 'cancelled')) or
    (old.status = 'under_review' and new.status in ('needs_info', 'accepted', 'rejected', 'cancelled')) or
    (old.status = 'needs_info' and new.status in ('under_review', 'accepted', 'rejected', 'cancelled')) or
    (old.status = 'accepted' and new.status = 'invoiced') or
    (old.status = 'invoiced' and new.status = 'shipped') or
    (old.status = 'shipped' and new.status = 'delivered')
  ) then raise exception 'انتقال حالة الطلب غير مسموح: % إلى %', old.status, new.status; end if;
  return new;
end;
$$;

drop trigger if exists store_order_state_guard on public.store_orders;
create trigger store_order_state_guard before update of status on public.store_orders for each row execute function public.guard_store_order_transition();

create or replace function public.guard_shipment_transition()
returns trigger language plpgsql as $$
begin
  if old.status = new.status then return new; end if;
  if not (
    (old.status = 'pending' and new.status = 'processing') or
    (old.status in ('pending', 'processing') and new.status = 'shipped') or
    (old.status = 'shipped' and new.status = 'delivered') or
    (old.status in ('shipped', 'delivered') and new.status = 'returned') or
    (old.status in ('pending', 'processing') and new.status = 'cancelled')
  ) then raise exception 'انتقال حالة الشحنة غير مسموح: % إلى %', old.status, new.status; end if;
  return new;
end;
$$;

drop trigger if exists shipment_state_guard on public.shipments;
create trigger shipment_state_guard before update of status on public.shipments for each row execute function public.guard_shipment_transition();
