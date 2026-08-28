import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDB, db, type ShipmentStatus } from "@/lib/store";
import { Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, ChevronLeft, ExternalLink, MessageCircle, Phone, RefreshCw, Search, ShieldAlert, Truck } from "lucide-react";
import { toast } from "sonner";
import { renderRescuePending, waLink, trackUrlFor } from "@/lib/whatsapp-templates";
import { useShopSettings } from "@/lib/store";

type StoreOrder = { id: string; public_number: string; status: string; status_reason: string | null; customer_name: string; customer_phone: string; delivery_address: string; total: number; invoice_id: string | null; created_at: string; store_order_items?: Array<{ product_title: string; quantity: number }> };
type RescueRow = { id: string; orderId: string | null; invoiceId: string | null; number: string; customer: string; phone: string; address: string; status: string; reason: string; total: number; createdAt: string; productSummary: string; shipmentId: string | null; kind: "shipment" | "order"; priority: "urgent" | "high" | "normal" };

const labels: Record<string, string> = { pending: "الشحنة لم تبدأ", processing: "التجهيز متأخر", shipped: "الشحن متأخر", returned: "الشحنة مرتجعة", cancelled: "ملغي", rejected: "طلب مرفوض", needs_info: "بيانات ناقصة", under_review: "قيد المراجعة" };
const ageInDays = (date: string) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));

export default function RescueOrders() {
  const { shipments, carriers, zones } = useDB();
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "urgent" | "shipment" | "order">("all");
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.from as any)("store_orders").select("id,public_number,status,status_reason,customer_name,customer_phone,delivery_address,total,invoice_id,created_at,store_order_items(product_title,quantity)").order("created_at", { ascending: true });
      if (error) throw error;
      setOrders(data ?? []);
    } catch (error: any) { toast.error(error.message ?? "تعذر تحميل الطلبات"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadOrders(); }, []);

  const rows = useMemo<RescueRow[]>(() => {
    const result: RescueRow[] = [];
    for (const shipment of shipments) {
      const age = ageInDays(shipment.createdAt);
      const risk = shipment.status === "pending" && age >= 1 || shipment.status === "processing" && age >= 1 || shipment.status === "shipped" && age >= 3 || shipment.status === "returned" || shipment.status === "cancelled" || !shipment.trackingNumber && age >= 1;
      if (!risk) continue;
      const order = orders.find((item) => item.invoice_id === shipment.invoiceId);
      const reason = order?.status_reason ?? (!shipment.trackingNumber ? "لم يتم تسجيل رقم تتبع" : `الشحنة في الحالة ${labels[shipment.status] ?? shipment.status} منذ ${age} يوم`);
      result.push({ id: shipment.id, orderId: order?.id ?? null, invoiceId: shipment.invoiceId, number: order?.public_number ?? shipment.invoiceId?.slice(0, 8) ?? shipment.id.slice(0, 8), customer: shipment.recipientName ?? order?.customer_name ?? "عميل غير معروف", phone: shipment.recipientPhone ?? order?.customer_phone ?? "", address: shipment.deliveryAddress ?? order?.delivery_address ?? "", status: shipment.status, reason, total: order?.total ?? 0, createdAt: shipment.createdAt, productSummary: order?.store_order_items?.map((item) => `${item.product_title} × ${item.quantity}`).join("، ") ?? "فاتورة مرتبطة", shipmentId: shipment.id, kind: "shipment", priority: shipment.status === "returned" || shipment.status === "cancelled" || age >= 3 ? "urgent" : age >= 1 ? "high" : "normal" });
    }
    for (const order of orders) {
      if (order.invoice_id || !["rejected", "needs_info", "under_review", "cancelled"].includes(order.status)) continue;
      result.push({ id: order.id, orderId: order.id, invoiceId: null, number: order.public_number, customer: order.customer_name, phone: order.customer_phone, address: order.delivery_address, status: order.status, reason: order.status_reason ?? labels[order.status] ?? "يحتاج مراجعة", total: Number(order.total ?? 0), createdAt: order.created_at, productSummary: (order.store_order_items ?? []).map((item) => `${item.product_title} × ${item.quantity}`).join("، "), shipmentId: null, kind: "order", priority: order.status === "rejected" || ageInDays(order.created_at) >= 2 ? "urgent" : "high" });
    }
    return result.sort((a, b) => ({ urgent: 0, high: 1, normal: 2 }[a.priority] - { urgent: 0, high: 1, normal: 2 }[b.priority] || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  }, [shipments, orders]);

  const { settings: shopSettings } = useShopSettings();
  const filtered = rows.filter((row) => (filter === "all" || filter === row.priority || filter === row.kind) && `${row.number} ${row.customer} ${row.phone} ${row.reason} ${row.productSummary} ${carriers.find((carrier) => carrier.id === shipments.find((shipment) => shipment.id === row.shipmentId)?.carrierId)?.name ?? ""} ${zones.find((zone) => zone.id === shipments.find((shipment) => shipment.id === row.shipmentId)?.zoneId)?.name ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const urgent = rows.filter((row) => row.priority === "urgent").length;
  const contact = (row: RescueRow) => {
    if (!row.phone) return toast.error("رقم العميل غير موجود");
    const msg = renderRescuePending({
      shop: { shopName: shopSettings.shopName || "سِجلّي", shopPhone: shopSettings.phone, whatsapp: shopSettings.whatsapp },
      customer: row.customer,
      phone: row.phone,
      number: row.number,
      statusLabel: labels[row.status] ?? row.status,
      reason: row.reason,
      ageDays: ageInDays(row.createdAt),
      productSummary: row.productSummary,
      total: String(row.total),
      address: row.address,
      trackUrl: trackUrlFor(row.number, row.phone),
    });
    window.open(waLink(row.phone, msg), "_blank", "noopener,noreferrer");
  };

  return <AppShell><div dir="rtl" className="space-y-6 pb-20"><PageHeader title="إنقاذ الطلبات" subtitle="كل طلب أو شحنة محتاجة تدخل قبل ما تضيع من إيدك." icon={<ShieldAlert className="h-7 w-7 text-warning" />} action={<div className="flex gap-2"><Button variant="outline" asChild><Link to="/shipping"><ChevronLeft className="h-4 w-4" /> قسم الشحن</Link></Button><Button variant="outline" onClick={() => void loadOrders()}><RefreshCw className="h-4 w-4" /> تحديث</Button></div>} /><div className="grid gap-3 sm:grid-cols-3"><Stat label="تحتاج إجراء فوري" value={urgent} tone="danger" /><Stat label="كل الحالات" value={rows.length} /><Stat label="بدون تتبع" value={rows.filter((row) => row.kind === "shipment" && !shipments.find((shipment) => shipment.id === row.shipmentId)?.trackingNumber).length} tone="warning" /></div><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث برقم الطلب أو العميل أو السبب" className="pr-10" /></div><div className="flex gap-2 overflow-x-auto"><FilterButton active={filter === "all"} onClick={() => setFilter("all")}>الكل</FilterButton><FilterButton active={filter === "urgent"} onClick={() => setFilter("urgent")}>فوري</FilterButton><FilterButton active={filter === "shipment"} onClick={() => setFilter("shipment")}>شحنات</FilterButton><FilterButton active={filter === "order"} onClick={() => setFilter("order")}>طلبات</FilterButton></div></div>{loading ? <div className="rounded-2xl border border-foreground/10 bg-card/70 p-10 text-center text-muted-foreground">جاري تجميع الطلبات المحتاجة إنقاذ…</div> : filtered.length === 0 ? <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card/70 p-10 text-success"><CheckCircle2 className="h-6 w-6" /><div><p className="font-bold">مفيش طلبات محتاجة تدخل دلوقتي</p><p className="text-sm text-muted-foreground">تابع هنا أي حالة تتعطل أو تتأخر.</p></div></div> : <div className="grid gap-3">{filtered.map((row) => <RescueCard key={`${row.kind}-${row.id}`} row={row} shipment={shipments.find((shipment) => shipment.id === row.shipmentId)} onContact={() => contact(row)} onRefresh={loadOrders} />)}</div>}</div></AppShell>;
}

function RescueCard({ row, shipment, onContact, onRefresh }: { row: RescueRow; shipment?: ReturnType<typeof useDB>["shipments"][number]; onContact: () => void; onRefresh: () => Promise<void> }) { const age = ageInDays(row.createdAt); const repair = async () => { if (!shipment) return; try { if (shipment.status === "pending") await db.updateShipmentStatus(shipment.id, "processing"); else if (shipment.status === "processing") await db.updateShipmentStatus(shipment.id, "shipped"); toast.success("اتحدثت حالة الشحنة"); await onRefresh(); } catch (error: any) { toast.error(error.message ?? "تعذر تحديث الشحنة"); } }; return <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-card/70"><div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"><div className={`h-2 w-full shrink-0 rounded-full lg:h-16 lg:w-2 ${row.priority === "urgent" ? "bg-danger" : "bg-warning"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-black">#{row.number}</span><span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-xs font-bold text-warning">{labels[row.status] ?? row.status}</span><span className="text-xs text-muted-foreground">منذ {age} يوم</span></div><p className="mt-2 font-bold">{row.customer}</p><p className="mt-1 text-sm text-muted-foreground">{row.productSummary || "بدون تفاصيل أصناف"}</p><p className="mt-2 flex items-center gap-1 text-sm text-danger"><AlertTriangle className="h-4 w-4" /> {row.reason}</p><p className="mt-1 text-xs text-muted-foreground">{row.address || "العنوان غير متوفر"}</p></div><div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" size="icon" onClick={onContact} title="تواصل عبر واتساب"><MessageCircle className="h-4 w-4" /></Button><Button variant="outline" size="icon" asChild title="اتصال"><a href={`tel:${row.phone}`}><Phone className="h-4 w-4" /></a></Button>{row.invoiceId && <Button variant="outline" asChild><Link to={`/shipping?invoice=${row.invoiceId}`}><ExternalLink className="h-4 w-4" /> فتح الشحنة</Link></Button>}{shipment && ["pending", "processing"].includes(shipment.status) && <Button onClick={() => void repair()}><Truck className="h-4 w-4" /> {shipment.status === "pending" ? "ابدأ التجهيز" : "علّمها اتشحنت"}</Button>}</div></div></div>; }
function Stat({ label, value, tone = "normal" }: { label: string; value: number; tone?: "normal" | "danger" | "warning" }) { return <div className="rounded-2xl border border-foreground/10 bg-card/70 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-black tabular-nums ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-foreground"}`}>{value}</p></div>; }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) { return <Button type="button" size="sm" variant={active ? "default" : "outline"} onClick={onClick}>{children}</Button>; }
