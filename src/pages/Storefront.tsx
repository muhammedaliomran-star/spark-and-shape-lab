import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StorefrontOrders } from "@/components/StorefrontOrders";
import { useDB } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { acceptStoreOrder, getMyStorefront, getMyStorefrontProducts, getMyStoreOrders, invoiceStoreOrder, invoiceStoreOrderInstallment, saveStorefront, storefrontSlug, updateStoreOrderStatus, upsertStorefrontProduct, type Storefront, type StorefrontProduct, type StoreOrder } from "@/lib/storefront";
import { fmt } from "@/lib/store";
import { generateInstallmentSchedule, roundCurrency } from "@/lib/financial-engine";
import { toast } from "sonner";
import { ExternalLink, Globe2, Loader2, PackageOpen, Save, ShoppingBag, Store, Settings2, BarChart3 } from "lucide-react";

const emptyForm = { slug: "", name: "", phone: "", whatsapp_phone: "", description: "", shipping_policy: "", is_published: false };
const statusLabel: Record<string, string> = { submitted: "طلب جديد", under_review: "قيد المراجعة", needs_info: "محتاج بيانات", accepted: "تم القبول", invoiced: "اتحول لفاتورة", shipped: "اتشحن", delivered: "تم التسليم", rejected: "مرفوض", cancelled: "ملغي", expired: "انتهت المهلة" };

export default function StorefrontPage() {
  const { stockItems } = useDB();
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installmentOrder, setInstallmentOrder] = useState<StoreOrder | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const shop = await getMyStorefront();
      setStorefront(shop);
      if (!shop) return;
      setForm({ slug: shop.slug, name: shop.name, phone: shop.phone ?? "", whatsapp_phone: shop.whatsapp_phone ?? "", description: shop.description ?? "", shipping_policy: shop.shipping_policy ?? "", is_published: shop.is_published });
      const [catalogue, orderList] = await Promise.all([getMyStorefrontProducts(shop.id), getMyStoreOrders(shop.id)]);
      setProducts(catalogue); setOrders(orderList);
    } catch (error: any) { toast.error(error.message ?? "تعذر تحميل المتجر"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!storefront) return; const channel = supabase.channel(`storefront-orders:${storefront.id}`).on("postgres_changes", { event: "*", schema: "public", table: "store_orders", filter: `storefront_id=eq.${storefront.id}` }, () => { void load(); }).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [storefront?.id]);

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim()) return toast.error("اكتب اسم المتجر والرابط المختصر");
    setSaving(true);
    try { const saved = await saveStorefront({ ...form, slug: storefrontSlug(form.slug) }); setStorefront(saved); setForm((v) => ({ ...v, slug: saved.slug })); toast.success("اتحفظت إعدادات المتجر"); }
    catch (error: any) { toast.error(error.message ?? "تعذر حفظ المتجر"); }
    finally { setSaving(false); }
  };

  const toggleProduct = async (stockId: string) => {
    if (!storefront) return toast.error("احفظ إعدادات المتجر الأول");
    const existing = products.find((product) => product.stock_item_id === stockId);
    const stock = stockItems.find((item) => item.id === stockId);
    if (!stock) return;
    try {
      const saved = await upsertStorefrontProduct(existing ? { ...existing, is_published: !existing.is_published } : {
        storefront_id: storefront.id, stock_item_id: stock.id, category_id: null, slug: storefrontSlug(stock.name) || `product-${stock.id.slice(0, 8)}`,
        title: stock.name, description: null, images: [], display_price: stock.salePrice, show_installments: false, down_payment_from: null, monthly_payment_from: null, sort_order: products.length, is_published: true,
      });
      setProducts((current) => existing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
      toast.success(saved.is_published ? "اتنشر في المتجر" : "اتشال من المتجر");
    } catch (error: any) { toast.error(error.message ?? "تعذر تحديث المنتج"); }
  };

  const updateOrder = async (order: StoreOrder, action: "accepted" | "rejected" | "under_review", reason?: string) => {
    try {
      if (action === "accepted") await acceptStoreOrder(order.id); else await updateStoreOrderStatus(order.id, action, reason);
      toast.success(action === "accepted" ? "اتقبل الطلب واتحجزت الكمية 24 ساعة" : "اتحدثت حالة الطلب");
      if (storefront) setOrders(await getMyStoreOrders(storefront.id));
    } catch (error: any) { toast.error(error.message ?? "تعذر تحديث الطلب"); }
  };

  const invoiceOrder = async (order: StoreOrder) => {
    if (order.order_type === "installment_request") { setInstallmentOrder(order); return; }
    try {
      const result = await invoiceStoreOrder(order.id);
      toast.success(result.already_invoiced ? "الفاتورة موجودة بالفعل" : "اتعملت الفاتورة والشحنة المبدئية");
      if (storefront) setOrders(await getMyStoreOrders(storefront.id));
    } catch (error: any) { toast.error(error.message ?? "تعذر إنشاء الفاتورة"); }
  };

  const published = products.filter((item) => item.is_published).length;
  const newOrders = orders.filter((order) => ["submitted", "under_review", "needs_info"].includes(order.status)).length;
  const shopUrl = storefront ? `/shop/${storefront.slug}` : "";
  const listedStock = useMemo(() => stockItems.filter((item) => item.quantity > 0), [stockItems]);

  return <AppShell><PageTransition><div className="space-y-6 pb-20" dir="rtl">
    <PageHeader title="المتجر الإلكتروني" subtitle="انشر منتجاتك واستقبل الطلبات في سِجلّي." icon={<Store className="h-7 w-7" />} action={<div className="flex flex-wrap gap-2">{storefront && <Button variant="outline" asChild><a href={shopUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> افتح المتجر</a></Button>}<Button variant="outline" asChild><a href="/storefront/catalog"><Settings2 className="h-4 w-4" /> إدارة الكتالوج</a></Button><Button variant="outline" asChild><a href="/storefront/analytics"><BarChart3 className="h-4 w-4" /> التحليلات</a></Button><Button variant="outline" asChild><a href="/storefront/settings">إعدادات المتجر</a></Button><Button variant="outline" asChild><a href="/storefront/operations">الشحن والمرتجعات</a></Button></div>} />
    {loading ? <div className="py-20 text-center text-muted-foreground"><Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin" />جارٍ تجهيز متجرك…</div> : <Tabs defaultValue="setup">
      <TabsList><TabsTrigger value="setup"><Globe2 className="h-4 w-4" /> الإعداد</TabsTrigger><TabsTrigger value="catalog"><PackageOpen className="h-4 w-4" /> الكتالوج ({published})</TabsTrigger><TabsTrigger value="orders"><ShoppingBag className="h-4 w-4" /> الطلبات {newOrders ? `(${newOrders})` : ""}</TabsTrigger></TabsList>
      <TabsContent value="setup" className="mt-5"><BezelCard className="max-w-3xl p-6"><div className="grid gap-5 sm:grid-cols-2">
        <Field label="اسم المتجر" value={form.name} onChange={(name) => setForm({ ...form, name })} placeholder="مثال: معرض النور" />
        <Field label="رابط المتجر" value={form.slug} onChange={(slug) => setForm({ ...form, slug: storefrontSlug(slug) })} placeholder="alnoor" prefix="/shop/" />
        <Field label="رقم الهاتف" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} placeholder="01000000000" />
        <Field label="واتساب" value={form.whatsapp_phone} onChange={(whatsapp_phone) => setForm({ ...form, whatsapp_phone })} placeholder="01000000000" />
      </div><div className="mt-5 grid gap-5"><TextField label="وصف قصير" value={form.description} onChange={(description) => setForm({ ...form, description })} placeholder="قول للعميل بتبيع إيه وبتوصل لفين" /><TextField label="سياسة التوصيل" value={form.shipping_policy} onChange={(shipping_policy) => setForm({ ...form, shipping_policy })} placeholder="التوصيل خلال يومين إلى 4 أيام…" /></div>
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-border/70 bg-muted/30 p-4"><div><p className="font-bold">نشر المتجر للعامة</p><p className="text-sm text-muted-foreground">مش هيظهر الرابط غير لما تفعل النشر.</p></div><Switch checked={form.is_published} onCheckedChange={(is_published) => setForm({ ...form, is_published })} /></div>
      <Button className="mt-6" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ الإعدادات</Button></BezelCard></TabsContent>
      <TabsContent value="catalog" className="mt-5"><BezelCard className="p-0 overflow-hidden"><div className="border-b border-border/70 p-5"><h2 className="font-bold">انشر من المخزون</h2><p className="mt-1 text-sm text-muted-foreground">المنتجات المنشورة فقط بتظهر للعميل، والأسعار قابلة للتعديل في المرحلة القادمة.</p></div><div className="divide-y divide-border/70">{listedStock.map((item) => { const product = products.find((entry) => entry.stock_item_id === item.id); return <div key={item.id} className="flex items-center gap-4 p-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><PackageOpen className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold">{item.name}</p><p className="text-sm text-muted-foreground">متاح {item.quantity} · {fmt(item.salePrice)} ج.م</p></div><Switch checked={product?.is_published ?? false} onCheckedChange={() => toggleProduct(item.id)} /></div>; })}{listedStock.length === 0 && <p className="p-8 text-center text-muted-foreground">أضف أصنافًا للمخزن الأول.</p>}</div></BezelCard></TabsContent>
      <TabsContent value="orders" className="mt-5"><StorefrontOrders orders={orders.map((order) => order.order_type === "installment_request" ? { ...order, order_type: "cash_on_delivery" as const } : order)} onRefresh={async () => { if (storefront) setOrders(await getMyStoreOrders(storefront.id)); }} onUpdate={updateOrder} onInvoice={(order) => invoiceOrder(orders.find((item) => item.id === order.id) ?? order)} /></TabsContent>
    </Tabs>}
  </div>{installmentOrder && <InstallmentAgreementDialog order={installmentOrder} onClose={() => setInstallmentOrder(null)} onSaved={async () => { setInstallmentOrder(null); if (storefront) setOrders(await getMyStoreOrders(storefront.id)); }} />}</PageTransition></AppShell>;
}

function Field({ label, value, onChange, placeholder, prefix }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; prefix?: string }) { return <div className="grid gap-2"><Label>{label}</Label><div className="flex items-center rounded-md border border-input bg-transparent px-3"><Input className="border-0 px-0 shadow-none focus-visible:ring-0" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} dir="ltr" />{prefix && <span className="text-sm text-muted-foreground" dir="ltr">{prefix}</span>}</div></div>; }
function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <div className="grid gap-2"><Label>{label}</Label><Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>; }

function InstallmentAgreementDialog({ order, onClose, onSaved }: { order: StoreOrder; onClose: () => void; onSaved: () => Promise<void> }) {
  const [downPayment, setDownPayment] = useState("0"); const [monthly, setMonthly] = useState(""); const [count, setCount] = useState("6"); const [firstDue, setFirstDue] = useState(new Date().toISOString().slice(0, 10)); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const down = Number(downPayment) || 0; const countValue = Math.max(1, Math.floor(Number(count) || 1)); const remaining = roundCurrency(Math.max(0, order.total - down)); const schedule = remaining > 0 && firstDue ? generateInstallmentSchedule(remaining, countValue, new Date(`${firstDue}T00:00:00`), Number(monthly) || undefined) : [];
  const save = async () => { const monthlyValue = Number(monthly); if (!Number.isFinite(down) || down < 0 || down > order.total || !Number.isFinite(monthlyValue) || monthlyValue <= 0 || !firstDue || schedule.length === 0 || roundCurrency(schedule.reduce((sum, row) => sum + row.amount, 0)) !== remaining) return setError("راجع المقدم والقسط وعدد الأقساط وتاريخ أول استحقاق"); setBusy(true); setError(""); try { await invoiceStoreOrderInstallment(order.id, down, monthlyValue, firstDue, countValue); toast.success("اتعملت فاتورة التقسيط والشحنة"); await onSaved(); } catch (reason: any) { setError(reason.message ?? "تعذر إنشاء فاتورة التقسيط"); } finally { setBusy(false); } };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><BezelCard className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">طلب #{order.public_number}</p><h2 className="mt-1 text-xl font-black">اتفاق التقسيط</h2></div><Button variant="outline" onClick={onClose}>إغلاق</Button></div><p className="mt-4 rounded-xl bg-muted/35 p-3 text-sm">إجمالي الطلب: <b>{fmt(order.total)} ج.م</b> · المتبقي: <b>{fmt(remaining)} ج.م</b></p><div className="mt-5 grid gap-4"><AgreementField label="المقدم" value={downPayment} onChange={setDownPayment} /><AgreementField label="القسط الشهري" value={monthly} onChange={setMonthly} /><AgreementField label="عدد الأقساط" value={count} onChange={setCount} /><div><Label>تاريخ أول استحقاق</Label><Input type="date" value={firstDue} onChange={(event) => setFirstDue(event.target.value)} className="mt-2" /></div></div>{schedule.length > 0 && <div className="mt-5 rounded-xl border border-border/70 p-3"><p className="mb-2 text-sm font-bold">معاينة الجدول · القسط الأخير {fmt(schedule.at(-1)?.amount ?? 0)} ج.م</p><div className="grid max-h-32 gap-1 overflow-y-auto text-xs text-muted-foreground">{schedule.map((row) => <div key={row.n} className="flex justify-between"><span>قسط {row.n}</span><b>{fmt(row.amount)} ج.م</b></div>)}</div></div>}{error && <p className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}<Button className="mt-5 w-full" disabled={busy} onClick={() => void save()}>{busy ? "جاري إنشاء الفاتورة..." : "تأكيد الاتفاق وإنشاء الفاتورة"}</Button></BezelCard></div>;
}

function AgreementField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div><Label>{label}</Label><Input type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2" /></div>; }
