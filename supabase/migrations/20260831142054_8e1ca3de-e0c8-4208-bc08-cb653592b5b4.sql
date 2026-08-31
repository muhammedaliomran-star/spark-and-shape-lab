CREATE TABLE public.carrier_settlements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  carrier_id uuid NOT NULL REFERENCES public.shipping_carriers(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'settlement' CHECK (type IN ('settlement','partial_payment','return_penalty','bonus','adjustment')),
  amount numeric NOT NULL DEFAULT 0,
  settled_on timestamp with time zone NOT NULL DEFAULT now(),
  payment_method text NOT NULL DEFAULT 'cash',
  reference_number text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carrier_settlements TO authenticated;
GRANT ALL ON public.carrier_settlements TO service_role;
ALTER TABLE public.carrier_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own carrier settlements" ON public.carrier_settlements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_carrier_settlements_carrier ON public.carrier_settlements(carrier_id, settled_on DESC);

CREATE TABLE public.delivery_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1,
  outcome text NOT NULL DEFAULT 'failed' CHECK (outcome IN ('delivered','partial','no_answer','refused','wrong_address','postponed','failed')),
  reason text,
  delivered_amount numeric NOT NULL DEFAULT 0,
  next_attempt_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_attempts TO authenticated;
GRANT ALL ON public.delivery_attempts TO service_role;
ALTER TABLE public.delivery_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own delivery attempts" ON public.delivery_attempts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_delivery_attempts_shipment ON public.delivery_attempts(shipment_id, created_at DESC);

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS weight_kg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pieces integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expected_delivery_date date;