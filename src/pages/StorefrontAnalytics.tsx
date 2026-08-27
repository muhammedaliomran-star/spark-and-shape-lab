import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { BezelCard } from "@/components/BezelCard";
import { getMyStorefront } from "@/lib/storefront";
import { getStorefrontAnalyticsSummary, type StorefrontEvent } from "@/lib/storefront-analytics";
import { BarChart3, Loader2, Store } from "lucide-react";
import { toast } from "sonner";

const labels: Record<StorefrontEvent, string> = { store_view: "زيارات المتجر", product_view: "مشاهدات المنتجات", cart_add: "إضافات للسلة", checkout_start: "بدء الدفع", order_submitted: "طلبات مكتملة" };

export default function StorefrontAnalytics() {
  const [summary, setSummary] = useState<Partial<Record<StorefrontEvent, number>>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { try { const shop = await getMyStorefront(); if (shop) setSummary(await getStorefrontAnalyticsSummary(shop.id, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))); } catch (error: any) { toast.error(error.message ?? "تعذر تحميل التحليلات"); } finally { setLoading(false); } })(); }, []);
  const views = summary.store_view ?? 0;
  const orders = summary.order_submitted ?? 0;
  const conversion = views ? Math.round((orders / views) * 1000) / 10 : 0;
  return <AppShell><div dir="rtl" className="space-y-6 pb-20"><PageHeader title="تحليلات المتجر" subtitle="أداء آخر 30 يومًا من الزيارات حتى الطلب." icon={<BarChart3 className="h-7 w-7" />} />{loading ? <div className="py-20 text-center text-muted-foreground"><Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin" />جارٍ تحميل التحليلات...</div> : <><div className="grid gap-3 sm:grid-cols-3"><Stat label="الزيارات" value={views} /><Stat label="الطلبات" value={orders} /><Stat label="معدل التحويل" value={`${conversion}%`} /></div><BezelCard className="p-5"><div className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /><h2 className="font-bold">رحلة العميل</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-5">{Object.entries(labels).map(([key, label]) => <div key={key} className="rounded-2xl bg-muted/35 p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-black">{summary[key as StorefrontEvent] ?? 0}</p></div>)}</div></BezelCard></>}</div></AppShell>;
}

function Stat({ label, value }: { label: string; value: number | string }) { return <BezelCard variant="flat" className="p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></BezelCard>; }
