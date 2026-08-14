-- Create return_records table
CREATE TABLE public.return_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('sale', 'supplier')),
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create return_items table
CREATE TABLE public.return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    return_id UUID NOT NULL REFERENCES public.return_records(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_records TO authenticated;
GRANT ALL ON public.return_records TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_items TO authenticated;
GRANT ALL ON public.return_items TO service_role;

-- Enable RLS
ALTER TABLE public.return_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

-- Policies for return_records
CREATE POLICY "Users can manage their own return records"
ON public.return_records
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policies for return_items
CREATE POLICY "Users can manage their own return items"
ON public.return_items
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
