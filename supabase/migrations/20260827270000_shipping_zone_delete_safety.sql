alter table public.shipments drop constraint if exists shipments_zone_id_fkey;
alter table public.shipments add constraint shipments_zone_id_fkey foreign key (zone_id) references public.shipping_zones(id) on delete set null;

alter table public.shipping_zones drop constraint if exists shipping_zones_carrier_id_fkey;
alter table public.shipping_zones add constraint shipping_zones_carrier_id_fkey foreign key (carrier_id) references public.shipping_carriers(id) on delete restrict;