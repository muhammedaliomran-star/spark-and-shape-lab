CREATE TABLE public.treasury_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_key text,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'cash',
  initial_balance numeric NOT NULL DEFAULT 0,
  account_number text,
  bank_name text,
  color text NOT NULL DEFAULT 'emerald',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_accounts TO authenticated;
GRANT ALL ON public.treasury_accounts TO service_role;
ALTER TABLE public.treasury_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own treasury accounts" ON public.treasury_accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_treasury_accounts_updated_at BEFORE UPDATE ON public.treasury_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.treasury_manual_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_key text NOT NULL,
  type text NOT NULL,
  category text NOT NULL DEFAULT 'عام',
  amount numeric NOT NULL DEFAULT 0,
  tx_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  notes text,
  reference_number text,
  payment_method text,
  performed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_manual_transactions TO authenticated;
GRANT ALL ON public.treasury_manual_transactions TO service_role;
ALTER TABLE public.treasury_manual_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own manual cash transactions" ON public.treasury_manual_transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_treasury_manual_transactions_updated_at BEFORE UPDATE ON public.treasury_manual_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.treasury_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transfer_number text NOT NULL,
  from_account_key text NOT NULL,
  to_account_key text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  fee numeric NOT NULL DEFAULT 0,
  fee_recorded_as_expense boolean NOT NULL DEFAULT false,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_number text,
  notes text,
  performed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_transfers TO authenticated;
GRANT ALL ON public.treasury_transfers TO service_role;
ALTER TABLE public.treasury_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own internal transfers" ON public.treasury_transfers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_treasury_transfers_updated_at BEFORE UPDATE ON public.treasury_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.treasury_denomination_audits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_number text NOT NULL,
  account_key text NOT NULL,
  counted_at timestamptz NOT NULL DEFAULT now(),
  counted_by text,
  denominations jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_actual_cash numeric NOT NULL DEFAULT 0,
  system_expected_cash numeric NOT NULL DEFAULT 0,
  variance numeric NOT NULL DEFAULT 0,
  variance_reason text,
  notes text,
  status text NOT NULL DEFAULT 'settled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_denomination_audits TO authenticated;
GRANT ALL ON public.treasury_denomination_audits TO service_role;
ALTER TABLE public.treasury_denomination_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own denomination audits" ON public.treasury_denomination_audits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_treasury_denomination_audits_updated_at BEFORE UPDATE ON public.treasury_denomination_audits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();