create or replace function public.get_public_storefront_with_settings(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(public.get_public_storefront(p_slug), '{storefront,banner_url}', to_jsonb(s.banner_url)),
            '{storefront,theme_key}', to_jsonb(s.theme_key)
          ),
          '{storefront,seo_title}', to_jsonb(s.seo_title)
        ),
        '{storefront,seo_description}', to_jsonb(s.seo_description)
      ),
      '{storefront,social_links}', s.social_links
    ),
    '{storefront,minimum_order}', to_jsonb(s.minimum_order)
  ) from public.storefronts s where s.slug = lower(p_slug) and s.is_published;
$$;

grant execute on function public.get_public_storefront_with_settings(text) to anon, authenticated;
