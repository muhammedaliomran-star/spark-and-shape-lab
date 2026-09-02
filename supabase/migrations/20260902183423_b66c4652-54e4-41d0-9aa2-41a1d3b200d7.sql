CREATE TABLE public.reconciliation_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  health_score integer NOT NULL DEFAULT 100,
  total_discrepancy numeric NOT NULL DEFAULT 0,
  critical_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  notice_count integer NOT NULL DEFAULT 0,
  auto_fixable_count integer NOT NULL DEFAULT 0,
  findings_count integer NOT NULL DEFAULT 0,
  category_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  trigger_source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reconciliation_audit_runs_user_created_idx ON public.reconciliation_audit_runs (user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.reconciliation_audit_runs TO authenticated;
GRANT ALL ON public.reconciliation_audit_runs TO service_role;
ALTER TABLE public.reconciliation_audit_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own audit runs" ON public.reconciliation_audit_runs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);