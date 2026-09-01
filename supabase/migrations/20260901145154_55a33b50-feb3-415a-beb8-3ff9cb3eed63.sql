ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS discount_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS serial_numbers text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.invoice_items
SET line_total = round(greatest(0, price * quantity - discount_amount) + tax_amount, 2)
WHERE line_total = 0;

ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_discount_pct_range CHECK (discount_pct >= 0 AND discount_pct <= 100),
  ADD CONSTRAINT invoice_items_tax_pct_range CHECK (tax_pct >= 0 AND tax_pct <= 100),
  ADD CONSTRAINT invoice_items_nonnegative_amounts CHECK (discount_amount >= 0 AND tax_amount >= 0 AND line_total >= 0);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS receipt_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS invoices_receipt_token_key ON public.invoices (receipt_token);

CREATE OR REPLACE FUNCTION public.get_public_invoice_receipt(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'invoice', jsonb_build_object(
      'number', upper(left(i.id::text, 6)),
      'created_at', i.created_at,
      'total', i.total,
      'paid', i.paid,
      'down_payment', i.down_payment,
      'monthly_installment', i.monthly_installment,
      'first_due_date', i.first_due_date,
      'discount_amount', i.discount_amount,
      'tax_amount', i.tax_amount,
      'status', i.status
    ),
    'customer', jsonb_build_object('name', c.name),
    'shop', jsonb_build_object(
      'name', COALESCE(NULLIF(s.shop_name, ''), 'سِجلّي'),
      'phone', NULLIF(s.phone, ''),
      'address', NULLIF(s.address, ''),
      'logo_url', s.logo_url,
      'currency', COALESCE(NULLIF(s.currency, ''), 'ج.م'),
      'tax_number', NULLIF(s.tax_number, ''),
      'footer_note', NULLIF(s.footer_note, '')
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', ii.name,
        'price', ii.price,
        'quantity', ii.quantity,
        'discount_pct', ii.discount_pct,
        'discount_amount', ii.discount_amount,
        'tax_pct', ii.tax_pct,
        'tax_amount', ii.tax_amount,
        'line_total', ii.line_total,
        'serial_numbers', ii.serial_numbers
      ) ORDER BY ii.created_at, ii.id)
      FROM public.invoice_items ii
      WHERE ii.invoice_id = i.id
    ), '[]'::jsonb)
  )
  FROM public.invoices i
  JOIN public.customers c ON c.id = i.customer_id AND c.user_id = i.user_id
  LEFT JOIN public.shop_settings s ON s.user_id = i.user_id
  WHERE i.receipt_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_invoice_receipt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_receipt(uuid) TO anon, authenticated, service_role;