import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { BezelCard } from "@/components/BezelCard";
import { useDB, fmt } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Finding = { title: string; detail: string };

export default function Reconciliation() {
  const data = useDB();
  const [movements, setMovements] = useState<Array<{ stock_item_id: string; quantity: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: rows, error } = await (supabase.from as any)("stock_movements").select("stock_item_id,quantity");
        if (error) throw error;
        if (!cancelled) setMovements((rows ?? []).map((row: any) => ({ stock_item_id: row.stock_item_id, quantity: Number(row.quantity ?? 0) })));
      } catch (error: any) {
        if (!cancelled) toast.error(error.message ?? "تعذر تحميل حركات المخزون");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const findings = useMemo(() => {
    const output: Finding[] = [];
    const paymentsByInvoice = new Map<string, number>();
    for (const payment of data.payments) paymentsByInvoice.set(payment.invoiceId, (paymentsByInvoice.get(payment.invoiceId) ?? 0) + payment.amount);
    for (const invoice of data.invoices) {
      const expected = Math.min(invoice.total, invoice.downPayment + (paymentsByInvoice.get(invoice.id) ?? 0));
      if (Math.abs(invoice.paid - expected) > 0.01) output.push({ title: `فرق تحصيل في الفاتورة ${invoice.id.slice(0, 8)}`, detail: `المسجل ${fmt(invoice.paid)} ج.م، والصحيح حسب الدفعات ${fmt(expected)} ج.م.` });
      const items = data.invoiceItems.filter((item) => item.invoiceId === invoice.id);
      if (invoice.status !== "cancelled" && (items.length === 0 || items.some((item) => item.cost <= 0))) output.push({ title: `تكلفة ناقصة في الفاتورة ${invoice.id.slice(0, 8)}`, detail: "الفاتورة مستبعدة من حساب الربح حتى تُسجل تكلفة كل صنف." });
    }
    const movementTotals = new Map<string, number>();
    for (const movement of movements) movementTotals.set(movement.stock_item_id, (movementTotals.get(movement.stock_item_id) ?? 0) + movement.quantity);
    for (const item of data.stockItems) {
      const movementTotal = movementTotals.get(item.id);
      if (movementTotal !== undefined && Math.abs(item.quantity - movementTotal) > 0) output.push({ title: `فرق مخزون: ${item.name}`, detail: `الرصيد الحالي ${fmt(item.quantity)}، ومجموع الحركات ${fmt(movementTotal)}.` });
    }
    for (const returned of data.returns) {
      if (data.returnItems.every((item) => item.returnId !== returned.id)) output.push({ title: `مرتجع بلا بنود ${returned.id.slice(0, 8)}`, detail: "أضف بنود المرتجع أو اعكس السجل قبل الاعتماد على إجماليه." });
    }
    return output;
  }, [data.invoices, data.invoiceItems, data.payments, data.returns, data.returnItems, data.stockItems, movements]);

  return <AppShell><div dir="rtl" className="space-y-6 pb-20"><PageHeader title="مركز المطابقة" subtitle="مراجعة الفروق بين الفواتير والدفعات والمخزون والمرتجعات." icon={<ClipboardCheck className="h-7 w-7" />} /><div className="grid gap-4 sm:grid-cols-3"><Metric label="المشاكل المكتشفة" value={fmt(findings.length)} danger={findings.length > 0} /><Metric label="الفواتير" value={fmt(data.invoices.length)} /><Metric label="حركات المخزون" value={loading ? "..." : fmt(movements.length)} /></div>{loading ? <BezelCard className="grid min-h-40 place-items-center"><Loader2 className="h-7 w-7 animate-spin" /></BezelCard> : findings.length === 0 ? <BezelCard className="flex items-center gap-3 p-6 text-success"><CheckCircle2 className="h-6 w-6" /><div><p className="font-bold">لا توجد فروق مكتشفة</p><p className="text-sm text-muted-foreground">البيانات المتاحة متطابقة حاليًا.</p></div></BezelCard> : <div className="grid gap-3">{findings.map((finding, index) => <BezelCard key={`${finding.title}-${index}`} className="flex items-start gap-3 border-warning/30 p-5"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" /><div><p className="font-bold">{finding.title}</p><p className="mt-1 text-sm text-muted-foreground">{finding.detail}</p></div></BezelCard>)}</div>}</div></AppShell>;
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <BezelCard className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-black ${danger ? "text-warning" : "text-foreground"}`}>{value}</p></BezelCard>; }
