import { useEffect, useMemo, useState } from "react";
import { useSearch, Link } from "@tanstack/react-router";
import { Truck, Search, Plus, MapPin, Building2, PackageCheck, Clock, Pencil, Trash2, ExternalLink, ShieldAlert, CalendarDays } from "lucide-react";
import { useDB, db, ShipmentStatus, type ShipmentCarrier, type ShippingZone } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { BezelCard } from "@/components/BezelCard";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد الانتظار", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  processing: { label: "جاري التجهيز", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  shipped: { label: "تم الشحن", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  delivered: { label: "تم التوصيل", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  returned: { label: "مرتجع", color: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
  cancelled: { label: "ملغي", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
};

function allowedShipmentStatuses(status: ShipmentStatus): ShipmentStatus[] {
  if (status === "pending") return ["pending", "processing", "cancelled"];
  if (status === "processing") return ["processing", "shipped", "cancelled"];
  if (status === "shipped") return ["shipped", "delivered", "returned"];
  if (status === "delivered") return ["delivered", "returned"];
  return [status];
}

export default function Shipping() {
  const { shipments, carriers, zones, invoices, customers } = useDB();
  const search = useSearch({ strict: false }) as { q?: string; invoice?: string };
  const [searchQuery, setSearchQuery] = useState(search.q ?? search.invoice ?? "");
  const [orderNumbers, setOrderNumbers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (search.q || search.invoice) setSearchQuery(search.q ?? search.invoice ?? "");
  }, [search.q, search.invoice]);

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase.from as any)("store_orders").select("invoice_id,public_number").not("invoice_id", "is", null);
      setOrderNumbers(Object.fromEntries((data ?? []).map((row: { invoice_id: string; public_number: string }) => [row.invoice_id, row.public_number])));
    })();
  }, []);

  const [isAddCarrierOpen, setIsAddCarrierOpen] = useState(false);
  const [isAddZoneOpen, setIsAddZoneOpen] = useState(false);
  const [isAddShipmentOpen, setIsAddShipmentOpen] = useState(false);
  const [editCarrier, setEditCarrier] = useState<ShipmentCarrier | null>(null);
  const [editZone, setEditZone] = useState<ShippingZone | null>(null);

  const [carrierName, setCarrierName] = useState("");
  const [carrierContact, setCarrierContact] = useState("");
  const [carrierPhone, setCarrierPhone] = useState("");
  const [carrierBaseCost, setCarrierBaseCost] = useState("0");

  const [zoneName, setZoneName] = useState("");
  const [zoneCarrierId, setZoneCarrierId] = useState("");
  const [zoneCost, setZoneCost] = useState("0");
  const [zoneDays, setZoneDays] = useState("2");

  const [shipmentInvoiceId, setShipmentInvoiceId] = useState("");
  const [shipmentCarrierId, setShipmentCarrierId] = useState("");
  const [shipmentZoneId, setShipmentZoneId] = useState("");
  const [shipmentTracking, setShipmentTracking] = useState("");

  const invoicedIds = useMemo(() => new Set(shipments.map((s) => s.invoiceId).filter(Boolean)), [shipments]);
  const invoicesWithoutShipment = useMemo(
    () => invoices.filter((inv) => !invoicedIds.has(inv.id)),
    [invoices, invoicedIds],
  );

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const filteredShipments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return shipments;
    return shipments.filter((s) =>
      [s.trackingNumber, s.recipientName, s.recipientPhone, s.deliveryAddress, s.invoiceId, orderNumbers[s.invoiceId ?? ""], carriers.find((c) => c.id === s.carrierId)?.name, zones.find((z) => z.id === s.zoneId)?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [shipments, searchQuery, orderNumbers, carriers, zones]);

  const filteredCarriers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return carriers;
    return carriers.filter((c) => [c.name, c.contactPerson, c.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [carriers, searchQuery]);

  const filteredZones = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter((z) => {
      const carrierName = carriers.find((c) => c.id === z.carrierId)?.name ?? "";
      return [z.name, carrierName].some((v) => v.toLowerCase().includes(q));
    });
  }, [zones, carriers, searchQuery]);

  const resetCarrierForm = () => {
    setCarrierName("");
    setCarrierContact("");
    setCarrierPhone("");
    setCarrierBaseCost("0");
    setEditCarrier(null);
  };

  const resetZoneForm = () => {
    setZoneName("");
    setZoneCarrierId("");
    setZoneCost("0");
    setZoneDays("2");
    setEditZone(null);
  };

  const resetShipmentForm = () => {
    setShipmentInvoiceId("");
    setShipmentCarrierId("");
    setShipmentZoneId("");
    setShipmentTracking("");
  };

  const handleAddCarrier = async () => {
    if (!carrierName) return toast.error("يرجى إدخال اسم الشركة");
    try {
      if (editCarrier) {
        await db.updateCarrier(editCarrier.id, {
          name: carrierName,
          contactPerson: carrierContact || null,
          phone: carrierPhone || null,
          baseCost: Number(carrierBaseCost),
        });
        toast.success("تم تحديث شركة الشحن");
      } else {
        await db.addCarrier({
          name: carrierName,
          contactPerson: carrierContact || null,
          phone: carrierPhone || null,
          email: null,
          baseCost: Number(carrierBaseCost),
          active: true,
        });
        toast.success("تمت إضافة شركة الشحن بنجاح");
      }
      setIsAddCarrierOpen(false);
      resetCarrierForm();
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ أثناء الحفظ");
    }
  };

  const openEditCarrier = (carrier: ShipmentCarrier) => {
    setEditCarrier(carrier);
    setCarrierName(carrier.name);
    setCarrierContact(carrier.contactPerson ?? "");
    setCarrierPhone(carrier.phone ?? "");
    setCarrierBaseCost(String(carrier.baseCost));
    setIsAddCarrierOpen(true);
  };

  const toggleCarrierActive = async (carrier: ShipmentCarrier) => {
    try {
      await db.updateCarrier(carrier.id, { active: !carrier.active });
      toast.success(carrier.active ? "تم إيقاف الشركة" : "تم تفعيل الشركة");
    } catch (e: any) {
      toast.error(e.message || "تعذر التحديث");
    }
  };

  const handleAddZone = async () => {
    if (!zoneName || !zoneCarrierId) return toast.error("يرجى إدخال جميع البيانات المطلوبة");
    try {
      if (editZone) {
        await db.updateZone(editZone.id, {
          name: zoneName,
          carrierId: zoneCarrierId,
          deliveryCost: Number(zoneCost),
          estimatedDays: Number(zoneDays) || 2,
        });
        toast.success("تم تحديث المنطقة");
      } else {
        await db.addZone({
          name: zoneName,
          carrierId: zoneCarrierId,
          deliveryCost: Number(zoneCost),
          estimatedDays: Number(zoneDays) || 2,
        });
        toast.success("تمت إضافة المنطقة بنجاح");
      }
      setIsAddZoneOpen(false);
      resetZoneForm();
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ أثناء الإضافة");
    }
  };

  const openEditZone = (zone: ShippingZone) => {
    setEditZone(zone);
    setZoneName(zone.name);
    setZoneCarrierId(zone.carrierId);
    setZoneCost(String(zone.deliveryCost));
    setZoneDays(String(zone.estimatedDays));
    setIsAddZoneOpen(true);
  };

  const handleRemoveZone = async (zone: ShippingZone) => {
    if (!window.confirm(`حذف منطقة «${zone.name}»؟`)) return;
    try {
      await db.removeZone(zone.id);
      toast.success("تم حذف المنطقة");
    } catch (e: any) {
      toast.error(e.message || "تعذر الحذف");
    }
  };

  const handleAddShipment = async () => {
    if (!shipmentInvoiceId) return toast.error("اختر الفاتورة");
    const invoice = invoices.find((inv) => inv.id === shipmentInvoiceId);
    const customer = invoice ? customerById.get(invoice.customerId) : null;
    try {
      await db.addShipment({
        invoiceId: shipmentInvoiceId,
        carrierId: shipmentCarrierId || null,
        zoneId: shipmentZoneId || null,
        trackingNumber: shipmentTracking.trim() || null,
        status: "pending",
        recipientName: customer?.name ?? null,
        recipientPhone: customer?.phone ?? null,
        deliveryAddress: customer?.address ?? null,
        processingAt: null, shippedAt: null, deliveredAt: null, returnedAt: null, statusUpdatedBy: null,
        actualDeliveryDate: null,
        notes: null,
      });
      toast.success("تمت إضافة الشحنة");
      setIsAddShipmentOpen(false);
      resetShipmentForm();
    } catch (e: any) {
      toast.error(e.message || "تعذر إنشاء الشحنة");
    }
  };

  const handleStatusChange = async (id: string, status: ShipmentStatus) => {
    let reason: string | undefined;
    if (status === "returned" || status === "cancelled") {
      const label = statusMap[status]?.label ?? status;
      if (!window.confirm(`تأكيد تغيير الحالة إلى «${label}»؟`)) return;
      reason = window.prompt(`اكتب سبب ${label}`)?.trim() || undefined;
      if (!reason) return toast.error("سبب تغيير الحالة مطلوب");
    }
    try {
      await db.updateShipmentStatus(id, status, reason);
      toast.success("تم تحديث حالة الشحنة");
    } catch (e: any) {
      toast.error(e.message || "تعذر تحديث الحالة");
    }
  };

  const selectedInvoiceCustomer = shipmentInvoiceId
    ? customerById.get(invoices.find((inv) => inv.id === shipmentInvoiceId)?.customerId ?? "")
    : null;

  return (
    <AppShell>
      <div className="space-y-8 pb-20" dir="rtl">
        <PageHeader
          title="نظام الشحن"
          subtitle="تتبع شحناتك وإدارة شركات التوصيل والمناطق الجغرافية"
          icon={<Truck className="h-7 w-7" />}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild><a href="/shipping/day"><CalendarDays className="ml-2 h-4 w-4" /> يوم الشحن</a></Button>
              <Button variant="outline" asChild><a href="/shipping/rescue"><ShieldAlert className="ml-2 h-4 w-4" /> إنقاذ الطلبات</a></Button>
              <Dialog open={isAddShipmentOpen} onOpenChange={(open) => { setIsAddShipmentOpen(open); if (!open) resetShipmentForm(); }}>
              <DialogTrigger asChild>
                <Button size="lg" className="h-12 rounded-2xl px-6 font-bold shadow-lg shadow-primary/20">
                  <Plus className="ml-2 h-5 w-5" />
                  شحنة جديدة
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="text-right">إنشاء شحنة جديدة</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>الفاتورة</Label>
                    <Select value={shipmentInvoiceId} onValueChange={setShipmentInvoiceId}>
                      <SelectTrigger className="text-right"><SelectValue placeholder="اختر فاتورة بدون شحنة" /></SelectTrigger>
                      <SelectContent>
                        {invoicesWithoutShipment.map((inv) => {
                          const customer = customerById.get(inv.customerId);
                          return (
                            <SelectItem key={inv.id} value={inv.id}>
                              {customer?.name ?? "عميل"} — {inv.total} ج.م
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {invoicesWithoutShipment.length === 0 && (
                      <p className="text-xs text-muted-foreground">كل الفواتير لها شحنات مسجلة.</p>
                    )}
                  </div>
                  {selectedInvoiceCustomer && (
                    <div className="rounded-xl bg-muted/40 p-3 text-sm">
                      <p>{selectedInvoiceCustomer.name} · {selectedInvoiceCustomer.phone}</p>
                      {selectedInvoiceCustomer.address && <p className="mt-1 text-muted-foreground">{selectedInvoiceCustomer.address}</p>}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>شركة الشحن</Label>
                    <Select value={shipmentCarrierId} onValueChange={(val) => { setShipmentCarrierId(val); setShipmentZoneId(""); }}>
                      <SelectTrigger className="text-right"><SelectValue placeholder="اختر الشركة" /></SelectTrigger>
                      <SelectContent>
                        {carriers.filter((c) => c.active).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>المنطقة</Label>
                    <Select value={shipmentZoneId} onValueChange={setShipmentZoneId} disabled={!shipmentCarrierId}>
                      <SelectTrigger className="text-right"><SelectValue placeholder="اختر المنطقة" /></SelectTrigger>
                      <SelectContent>
                        {zones.filter((z) => z.carrierId === shipmentCarrierId).map((z) => (
                          <SelectItem key={z.id} value={z.id}>{z.name} — {z.deliveryCost} ج.م</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>رقم البوليصة / التتبع</Label>
                    <Input value={shipmentTracking} onChange={(e) => setShipmentTracking(e.target.value)} placeholder="اختياري" className="text-right" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => void handleAddShipment()} className="w-full h-12 rounded-xl font-bold">حفظ الشحنة</Button>
                </DialogFooter>
              </DialogContent>
              </Dialog>
            </div>
          }
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "شحنات نشطة", value: shipments.filter((s) => ["pending", "processing", "shipped"].includes(s.status)).length, icon: Truck, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "تم التوصيل", value: shipments.filter((s) => s.status === "delivered").length, icon: PackageCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "قيد التجهيز", value: shipments.filter((s) => s.status === "processing").length, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
            { label: "شركات الشحن", value: carriers.length, icon: Building2, color: "text-indigo-500", bg: "bg-indigo-500/10" },
          ].map((metric, i) => (
            <Reveal key={metric.label} delay={i * 0.1}>
              <BezelCard className="group relative overflow-hidden p-6 transition-all hover:translate-y-[-4px]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight">{metric.value}</p>
                  </div>
                  <div className={`rounded-2xl ${metric.bg} p-3 ${metric.color} ring-1 ring-inset ring-current/20`}>
                    <metric.icon className="h-6 w-6" />
                  </div>
                </div>
              </BezelCard>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.4}>
          <Tabs defaultValue="shipments" className="w-full">
            <div className="sticky-search-bar mb-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <TabsList className="h-12 w-fit rounded-2xl bg-muted/50 p-1 ring-1 ring-hairline backdrop-blur-md">
                  <TabsTrigger value="shipments" className="rounded-xl px-6 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Truck className="ml-2 h-4 w-4" />
                    الشحنات
                  </TabsTrigger>
                  <TabsTrigger value="carriers" className="rounded-xl px-6 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Building2 className="ml-2 h-4 w-4" />
                    الشركات
                  </TabsTrigger>
                  <TabsTrigger value="zones" className="rounded-xl px-6 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <MapPin className="ml-2 h-4 w-4" />
                    المناطق
                  </TabsTrigger>
                </TabsList>
                <div className="relative w-full max-w-sm">
                  <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="بحث عن شحنة، عميل، أو رقم تتبع..."
                    className="h-12 rounded-2xl pr-11 text-right ring-hairline focus-visible:ring-primary/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <TabsContent value="shipments">
              <div className="grid gap-4">
                {filteredShipments.length === 0 ? (
                  <BezelCard className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-4 rounded-full bg-muted p-6">
                      <Truck className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">لا توجد شحنات مسجلة</h3>
                    <p className="mt-2 text-muted-foreground">ابدأ بإضافة أول شحنة لتتبعها هنا.</p>
                  </BezelCard>
                ) : (
                  filteredShipments.map((s, i) => (
                    <Reveal key={s.id} delay={i * 0.05}>
                      <BezelCard className="plate group flex flex-wrap items-center gap-4 p-5 lg:gap-6">
                        <div className={`h-12 w-1.5 rounded-full ${statusMap[s.status]?.color.split(" ")[0]}`} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-bold">#{s.trackingNumber || "بدون رقم"}</span>
                            <span className={`rounded-full border px-3 py-0.5 text-[11px] font-bold ${statusMap[s.status]?.color}`}>
                              {statusMap[s.status]?.label}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">
                            {s.recipientName} • {s.recipientPhone}
                          </p>
                          {s.invoiceId && (
                            <Link to="/invoices" search={{ invoice: s.invoiceId } as never} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <ExternalLink className="h-3 w-3" />
                              فاتورة مرتبطة
                            </Link>
                          )}
                        </div>
                        <div className="hidden md:block text-right">
                          <p className="text-sm font-medium text-muted-foreground">التاريخ</p>
                          <p className="text-sm font-bold">{format(new Date(s.createdAt), "dd MMMM yyyy", { locale: ar })}</p>
                        </div>
                        <div className="hidden min-w-[150px] lg:block">
                          <p className="text-sm font-medium text-muted-foreground">العنوان</p>
                          <p className="truncate text-sm font-bold max-w-[200px]">{s.deliveryAddress}</p>
                        </div>
                        <Select value={s.status} onValueChange={(val) => void handleStatusChange(s.id, val as ShipmentStatus)}>
                          <SelectTrigger className="h-9 w-[130px] rounded-xl text-xs font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allowedShipmentStatuses(s.status).map((status) => <SelectItem key={status} value={status}>{statusMap[status]?.label ?? status}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </BezelCard>
                    </Reveal>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="carriers">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCarriers.map((c, i) => (
                  <Reveal key={c.id} delay={i * 0.1}>
                    <BezelCard className="plate space-y-4 p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                          <Building2 className="h-6 w-6" />
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${c.active ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                          {c.active ? "نشط" : "غير نشط"}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{c.name}</h3>
                        <p className="text-sm text-muted-foreground">{c.contactPerson || "لا يوجد مسئول اتصال"}</p>
                        {c.phone && <p className="mt-1 text-xs text-muted-foreground">{c.phone}</p>}
                      </div>
                      <div className="flex items-center justify-between border-t border-hairline pt-4 text-sm">
                        <span className="text-muted-foreground">التكلفة الأساسية</span>
                        <span className="font-bold">{c.baseCost} ج.م</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditCarrier(c)}>
                          <Pencil className="h-4 w-4" /> تعديل
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void toggleCarrierActive(c)}>
                          {c.active ? "إيقاف" : "تفعيل"}
                        </Button>
                      </div>
                    </BezelCard>
                  </Reveal>
                ))}

                <Reveal delay={filteredCarriers.length * 0.1}>
                  <Dialog open={isAddCarrierOpen} onOpenChange={(open) => { setIsAddCarrierOpen(open); if (!open) resetCarrierForm(); }}>
                    <DialogTrigger asChild>
                      <button className="group flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-4 rounded-[1.75rem] border-2 border-dashed border-hairline p-8 transition-all hover:border-primary/50 hover:bg-primary/5">
                        <div className="rounded-full bg-muted p-4 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                          <Plus className="h-6 w-6" />
                        </div>
                        <span className="font-bold text-muted-foreground transition-colors group-hover:text-primary">إضافة شركة شحن</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]" dir="rtl">
                      <DialogHeader>
                        <DialogTitle className="text-right">{editCarrier ? "تعديل شركة الشحن" : "إضافة شركة شحن جديدة"}</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label>اسم الشركة</Label>
                          <Input value={carrierName} onChange={(e) => setCarrierName(e.target.value)} placeholder="مثلاً: ارامكس، مندوب خاص..." className="text-right" />
                        </div>
                        <div className="space-y-2">
                          <Label>المسئول</Label>
                          <Input value={carrierContact} onChange={(e) => setCarrierContact(e.target.value)} placeholder="اسم الشخص المسئول" className="text-right" />
                        </div>
                        <div className="space-y-2">
                          <Label>رقم الهاتف</Label>
                          <Input value={carrierPhone} onChange={(e) => setCarrierPhone(e.target.value)} placeholder="رقم الموبايل للتواصل" className="text-right" />
                        </div>
                        <div className="space-y-2">
                          <Label>التكلفة الأساسية (ج.م)</Label>
                          <Input type="number" value={carrierBaseCost} onChange={(e) => setCarrierBaseCost(e.target.value)} className="text-right" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={() => void handleAddCarrier()} className="h-12 w-full rounded-xl font-bold">حفظ البيانات</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </Reveal>
              </div>
            </TabsContent>

            <TabsContent value="zones">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredZones.map((z, i) => (
                  <Reveal key={z.id} delay={i * 0.1}>
                    <BezelCard className="plate space-y-4 p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 ring-1 ring-inset ring-amber-500/20">
                          <MapPin className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {carriers.find((c) => c.id === z.carrierId)?.name}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{z.name}</h3>
                        <p className="text-sm text-muted-foreground">مدة التوصيل: {z.estimatedDays} أيام</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-hairline pt-4 text-sm">
                        <span className="text-muted-foreground">تكلفة التوصيل</span>
                        <span className="font-bold text-primary">{z.deliveryCost} ج.م</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditZone(z)}>
                          <Pencil className="h-4 w-4" /> تعديل
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void handleRemoveZone(z)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </BezelCard>
                  </Reveal>
                ))}

                <Reveal delay={filteredZones.length * 0.1}>
                  <Dialog open={isAddZoneOpen} onOpenChange={(open) => { setIsAddZoneOpen(open); if (!open) resetZoneForm(); }}>
                    <DialogTrigger asChild>
                      <button className="group flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-4 rounded-[1.75rem] border-2 border-dashed border-hairline p-8 transition-all hover:border-amber-500/50 hover:bg-amber-500/5">
                        <div className="rounded-full bg-muted p-4 transition-colors group-hover:bg-amber-500/10 group-hover:text-amber-500">
                          <Plus className="h-6 w-6" />
                        </div>
                        <span className="font-bold text-muted-foreground transition-colors group-hover:text-amber-500">إضافة منطقة توصيل</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]" dir="rtl">
                      <DialogHeader>
                        <DialogTitle className="text-right">{editZone ? "تعديل المنطقة" : "إضافة منطقة توصيل"}</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label>اسم المنطقة</Label>
                          <Input value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder="مثلاً: القاهرة، الجيزة..." className="text-right" />
                        </div>
                        <div className="space-y-2">
                          <Label>شركة الشحن</Label>
                          <Select value={zoneCarrierId} onValueChange={setZoneCarrierId}>
                            <SelectTrigger className="text-right"><SelectValue placeholder="اختر الشركة" /></SelectTrigger>
                            <SelectContent>
                              {carriers.filter((c) => c.active).map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>تكلفة التوصيل (ج.م)</Label>
                          <Input type="number" value={zoneCost} onChange={(e) => setZoneCost(e.target.value)} className="text-right" />
                        </div>
                        <div className="space-y-2">
                          <Label>مدة التوصيل (أيام)</Label>
                          <Input type="number" value={zoneDays} onChange={(e) => setZoneDays(e.target.value)} className="text-right" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={() => void handleAddZone()} className="h-12 w-full rounded-xl font-bold">حفظ المنطقة</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </Reveal>
              </div>
            </TabsContent>
          </Tabs>
        </Reveal>
      </div>
    </AppShell>
  );
}
