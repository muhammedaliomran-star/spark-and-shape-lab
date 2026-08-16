-- Branches table
CREATE TABLE public.branches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    location text,
    phone text,
    manager_name text,
    is_main boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own branches" ON public.branches
    FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Link stock_items to branches (optional but good for future)
ALTER TABLE public.stock_items ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- Payment records (for customer installments and general payments)
-- Note: 'payments' table already exists for invoices, but we might want a unified 'transaction_logs' or similar.
-- The user asked for "Payments" (الدفعات). In a professional system, this often refers to tracking all incoming/outgoing payments, 
-- or specifically a dedicated section to manage installments globally.
-- Let's create a 'payment_vouchers' table for more formal payment tracking.

CREATE TABLE public.payment_vouchers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
    amount numeric NOT NULL,
    type text NOT NULL, -- 'receipt' (قبض) or 'payment' (صرف)
    payment_method text DEFAULT 'cash', -- 'cash', 'bank', 'wallet'
    description text,
    voucher_date date DEFAULT CURRENT_DATE,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_vouchers TO authenticated;
GRANT ALL ON public.payment_vouchers TO service_role;

ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own vouchers" ON public.payment_vouchers
    FOR ALL TO authenticated USING (auth.uid() = user_id);

