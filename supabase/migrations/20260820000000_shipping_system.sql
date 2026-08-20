-- Shipping Carriers table
CREATE TABLE public.shipping_carriers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    contact_person text,
    phone text,
    email text,
    base_cost decimal(12,2) DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Shipping Zones table
CREATE TABLE public.shipping_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL, -- e.g., "القاهرة", "الإسكندرية"
    carrier_id uuid REFERENCES public.shipping_carriers(id) ON DELETE CASCADE,
    delivery_cost decimal(12,2) DEFAULT 0,
    estimated_days integer DEFAULT 2,
    created_at timestamptz DEFAULT now()
);

-- Shipments table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status') THEN
        CREATE TYPE public.shipment_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'returned', 'cancelled');
    END IF;
END $$;

CREATE TABLE public.shipments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
    carrier_id uuid REFERENCES public.shipping_carriers(id),
    zone_id uuid REFERENCES public.shipping_zones(id),
    tracking_number text UNIQUE,
    status public.shipment_status DEFAULT 'pending',
    recipient_name text,
    recipient_phone text,
    delivery_address text,
    actual_delivery_date timestamptz,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_carriers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_zones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;
GRANT ALL ON public.shipping_carriers TO service_role;
GRANT ALL ON public.shipping_zones TO service_role;
GRANT ALL ON public.shipments TO service_role;
GRANT SELECT ON public.shipping_carriers TO anon;
GRANT SELECT ON public.shipping_zones TO anon;
GRANT SELECT ON public.shipments TO anon;

-- RLS
ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to shipping_carriers" ON public.shipping_carriers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to shipping_zones" ON public.shipping_zones FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to shipments" ON public.shipments FOR ALL TO authenticated USING (true);

