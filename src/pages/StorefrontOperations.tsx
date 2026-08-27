import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/lib/router-compat";
import {
  createStorefrontReturn,
  getMyStorefront,
  getMyStoreOrders,
  updateStorefrontShipment,
  updateStorefrontShipmentStatus,
  type StoreOrder,
} from "@/lib/storefront";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, PackageCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";

type Option = { id: string; name: string; carrier_id?: string | null; delivery_cost?: number };
type CurrentShipment = { id: string; status: string; tracking_number: string | null; actual_delivery_date: string | null; processing_at: string | null; shipped_at: string | null; delivered_at: string | null; returned_at: string | null };

export default function StorefrontOperations() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [carriers, setCarriers] = useState<Option[]>([]);
  const [zones, setZones] = useState<Option[]>([]);
  const [selected, setSelected] = useState<StoreOrder | null>(null);
  const [carrierId, setCarrierId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [tracking, setTracking] = useState("");
  const [reason, setReason] = useState("");
  const [shipmentReason, setShipmentReason] = useState("");
  const [currentShipment, setCurrentShipment] = useState<CurrentShipment | null>(null);
  const [busy, setBusy] = useState(true);

  const load = async () => {
    try {
      const shop = await getMyStorefront();
      if (!shop) return;
      const [orderList, carrierResult, zoneResult] = await Promise.all([
        getMyStoreOrders(shop.id),
        (supabase.from as any)("shipping_carriers").select("id,name").eq("active", true).order("name"),
        (supabase.from as any)("shipping_zones").select("id,name,carrier_id,delivery_cost").order("name"),
      ]);
      setOrders(orderList.filter((order) => order.invoice_id));
      setCarriers(carrierResult.data ?? []);
      setZones(zoneResult.data ?? []);
    } catch (error: any) {
      toast.error(error.message ?? "تعذر تحميل العمليات");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const selectOrder = async (order: StoreOrder) => {
    const zone = zones.find((item) => item.id === order.shipping_zone_id);
    setSelected(order);
    setZoneId(order.shipping_zone_id ?? "");
    setCarrierId(zone?.carrier_id ?? "");
    const { data: shipment } = await (supabase.from as any)("shipments").select("id,status,tracking_number,actual_delivery_date,processing_at,shipped_at,delivered_at,returned_at").eq("invoice_id", order.invoice_id).maybeSingle();
    setCurrentShipment(shipment ?? null);
    setTracking(shipment?.tracking_number ?? "");
    setReason("");
    setShipmentReason("");
  };

  const saveShipment = async () => {
    if (!selected?.invoice_id) return;
    try {
      if (zoneId !== (selected.shipping_zone_id ?? "") && !shipmentReason.trim()) {
        toast.error("اكتب سبب تغيير منطقة الشحن");
        return;
      }
      await updateStorefrontShipment(selected.invoice_id, carrierId || null, zoneId || null, tracking, shipmentReason);
      if (tracking.trim()) {
        const { data: shipment } = await (supabase.from as any)("shipments").select("id,status").eq("invoice_id", selected.invoice_id).maybeSingle();
        if (shipment?.status === "pending") await updateStorefrontShipmentStatus(shipment.id, "processing");
      }
      toast.success("اتحدثت بيانات الشحنة");
      await load();
      const { data: shipment } = await (supabase.from as any)("shipments").select("id,status,tracking_number,actual_delivery_date,processing_at,shipped_at,delivered_at,returned_at").eq("invoice_id", selected.invoice_id).maybeSingle();
      setCurrentShipment(shipment ?? null);
    } catch (error: any) {
      toast.error(error.message ?? "تعذر تحديث الشحنة");
    }
  };

  const saveReturn = async () => {
    if (!selected || !reason.trim()) return toast.error("اكتب سبب المرتجع");
    try {
      await createStorefrontReturn(selected.id, reason);
      toast.success("اتسجل المرتجع");
      await load();
      setSelected(null);
    } catch (error: any) {
      toast.error(error.message ?? "تعذر تسجيل المرتجع");
    }
  };

  if (busy) return <AppShell><div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin" /></div></AppShell>;

  return (
    <AppShell>
      <div dir="rtl" className="space-y-6 pb-20">
        <PageHeader title="عمليات طلبات المتجر" subtitle="اربط الشحن وسجل المرتجعات بعد إصدار الفاتورة." icon={<PackageCheck className="h-7 w-7" />} />
        <div className="grid gap-3">
          {orders.map((order) => (
            <button key={order.id} type="button" onClick={() => selectOrder(order)} className={`rounded-2xl border p-4 text-right transition ${selected?.id === order.id ? "border-primary bg-primary/5" : "border-border/70 bg-card/60"}`}>
              <span className="font-bold">#{order.public_number} · {order.customer_name}</span>
              <span className="mr-3 text-sm text-muted-foreground">{order.return_id ? "تم تسجيل المرتجع" : order.status}</span>
            </button>
          ))}
          {orders.length === 0 && <BezelCard className="p-10 text-center text-muted-foreground">لا توجد طلبات مفوترة حاليًا.</BezelCard>}
        </div>
        {selected && <div className="grid gap-5 lg:grid-cols-2">
          <BezelCard className="p-5">
            <h2 className="flex items-center gap-2 font-bold"><PackageCheck className="h-5 w-5 text-primary" /> بيانات الشحنة</h2>
            <div className="mt-3 rounded-xl bg-muted/35 p-3 text-sm">
              <p>منطقة التوصيل: <b>{zones.find((item) => item.id === selected.shipping_zone_id)?.name ?? "استلام من المحل"}</b></p>
              <p className="mt-1">التكلفة المحفوظة: <b>{selected.shipping_fee} ج.م</b></p>
              <p className="mt-1">التكلفة الحالية: <b>{zones.find((item) => item.id === zoneId)?.delivery_cost ?? selected.shipping_fee} ج.م</b></p>
              <p className="mt-1">حالة الشحنة: <b>{currentShipment?.status ?? "غير موجودة"}</b></p>
              {currentShipment?.actual_delivery_date && <p className="mt-1">تاريخ التسليم: <b>{new Date(currentShipment.actual_delivery_date).toLocaleDateString("ar-EG")}</b></p>}
              {currentShipment?.processing_at && <p className="mt-1">بدأ التجهيز: <b>{new Date(currentShipment.processing_at).toLocaleDateString("ar-EG")}</b></p>}
              {currentShipment?.shipped_at && <p className="mt-1">تم الشحن: <b>{new Date(currentShipment.shipped_at).toLocaleDateString("ar-EG")}</b></p>}
              <Link to={`/shipping?invoice=${selected.invoice_id ?? ""}`} className="mt-2 inline-block text-primary underline">فتح في قسم الشحن</Link>
            </div>
            <div className="mt-4 grid gap-4">
              <div><Label>المندوب / شركة الشحن</Label><select value={carrierId} onChange={(event) => { setCarrierId(event.target.value); setZoneId(""); }} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3"><option value="">بدون تحديد</option>{carriers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div><Label>المنطقة</Label><select value={zoneId} onChange={(event) => setZoneId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3"><option value="">بدون تحديد</option>{zones.filter((item) => !carrierId || item.carrier_id === carrierId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div><Label>رقم البوليصة</Label><Input value={tracking} onChange={(event) => setTracking(event.target.value)} className="mt-2" /></div>
              {zoneId !== (selected.shipping_zone_id ?? "") && <div><Label>سبب تغيير المنطقة</Label><Input value={shipmentReason} onChange={(event) => setShipmentReason(event.target.value)} className="mt-2" placeholder="مثال: تغيير عنوان العميل" /></div>}
              <Button onClick={() => void saveShipment()}>حفظ بيانات الشحنة</Button>
            </div>
          </BezelCard>
          <BezelCard className="p-5">
            <h2 className="flex items-center gap-2 font-bold"><Undo2 className="h-5 w-5 text-warning" /> مرتجع الطلب</h2>
            <p className="mt-2 text-sm text-muted-foreground">سيتم إنشاء مرتجع بيع مرتبط بالفاتورة وتغيير حالة الطلب عند اكتمال المرتجع.</p>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="سبب المرتجع" className="mt-4" disabled={Boolean(selected.return_id)} />
            <Button variant="outline" className="mt-4" disabled={Boolean(selected.return_id)} onClick={() => void saveReturn()}>تسجيل المرتجع</Button>
          </BezelCard>
        </div>}
      </div>
    </AppShell>
  );
}
