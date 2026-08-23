-- Phase 3: public product images with merchant-folder isolation.

insert into storage.buckets (id, name, public)
values ('storefront-product-images', 'storefront-product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public storefront product images are readable" on storage.objects;
create policy "Public storefront product images are readable"
  on storage.objects for select using (bucket_id = 'storefront-product-images');

drop policy if exists "Merchants upload storefront product images" on storage.objects;
create policy "Merchants upload storefront product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'storefront-product-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Merchants update storefront product images" on storage.objects;
create policy "Merchants update storefront product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'storefront-product-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'storefront-product-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Merchants delete storefront product images" on storage.objects;
create policy "Merchants delete storefront product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'storefront-product-images' and (storage.foldername(name))[1] = auth.uid()::text);