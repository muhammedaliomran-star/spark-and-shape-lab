import { useEffect, useMemo, useState } from "react";
import { useSearch, Link } from "@tanstack/react-router";
import {
  Truck, Search, Plus, MapPin, Building2, PackageCheck, Clock, Pencil, Trash2, ExternalLink,
  ShieldAlert, CalendarDays, Printer, FileText, Wallet, BarChart3, MessageCircle, CheckCheck, AlertTriangle,
} from "lucide-react";
import { useDB, db, useShopSettings, ShipmentStatus, type Shipment, type ShipmentCarrier, type ShippingZone } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
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
import { printShipmentLabel, printCarrierManifest } from "@/lib/shipping-docs";
import { renderShipmentOutForDelivery, waLink } from "@/lib/whatsapp-templates";
import { FastBarcodeScanner } from "@/components/shipping/FastBarcodeScanner";
import { SmartReturnModal } from "@/components/shipping/SmartReturnModal";
import { CarrierReconciliationView } from "@/components/shipping/CarrierReconciliationView";
import { CarrierExcelIntegrationModal } from "@/components/shipping/CarrierExcelIntegrationModal";
import { WhatsAppMenu } from "@/components/shipping/WhatsAppMenu";
import { QrCode, Calculator, FileSpreadsheet, Smartphone } from "lucide-react";

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد الانتظار", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  processing: { label: "جاري التجهيز", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  shipped: { label: "تم الشحن", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  delivered: { label: "تم التوصيل", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  returned: { label: "مرتجع", color: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
  cancelled: { label: "ملغي", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
};

const collectionMap: Record<string, { label: string; color: string }> = {
  uncollected: { label: "لم يُحصّل", color: "bg-slate-500/10 text-slate-500" },
  collected: { label: "محصّل مع المندوب", color: "bg-amber-500/10 text-amber-500" },
  settled: { label: "مُسوّى", color: "bg-emerald-500/10 text-emerald-500" },
};

const egp = (n: number) => `${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ج.م`;

function allowedShipmentStatuses(status: ShipmentStatus): ShipmentStatus[] {
  if (status === "pending") return ["pending", "processing", "cancelled"];
  if (status === "processing") return ["processing", "shipped", "cancelled"];
  if (status === "shipped") return ["shipped", "delivered", "returned"];
  if (status === "delivered") return ["delivered", "returned"];
  return [status];
}

const daysBetween = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86400000);

export default function Shipping() {
  const { shipments, carriers, zones, invoices, customers } = useDB();
  const { settings: shopSettings } = useShopSettings();
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
  const [fastScannerOpen, setFastScannerOpen] = useState(false);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [smartReturnModalOpen, setSmartReturnModalOpen] = useState(false);
  const [selectedReturnShipment, setSelectedReturnShipment] = useState<Shipment | null>(null);
  const [whatsappModalShipment, setWhatsappModalShipment] = useState<Shipment | null>(null);
  const [editCarrier, setEditCarrier] = useState<ShipmentCarrier | null>(null);
  const [editZone, setEditZone] = useState<ShippingZone | null>(null);
  const [detail, setDetail] = useState<Shipment | null>(null);

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
  const [shipmentCost, setShipmentCost] = useState("0");
  const [shipmentCod, setShipmentCod] = useState("0");

  // فلاتر + تحديد متعدد
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [carrierFilter, setCarrierFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCarrier, setBulkCarrier] = useState("");

  const invoicedIds = useMemo(() => new Set(shipments.map((s) => s.invoiceId).filter(Boolean)), [shipments]);
  const invoicesWithoutShipment = useMemo(() => invoices.filter((inv) => !invoicedIds.has(inv.id)), [invoices, invoicedIds]);
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const carrierById = useMemo(() => new Map(carriers.map((c) => [c.id, c])), [carriers]);
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const invoiceById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);

  const isLate = (s: Shipment) => {
    if (!["pending", "processing", "shipped"].includes(s.status)) return false;
    const expected = s.zoneId ? zoneById.get(s.zoneId)?.estimatedDays ?? 3 : 3;
    return daysBetween(s.createdAt, new Date().toISOString()) > expected + 1;
  };

  const filteredShipments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const periodDays = periodFilter === "7" ? 7 : periodFilter === "30" ? 30 : periodFilter === "90" ? 90 : null;
    return shipments.filter((s) => {
      if (statusFilter === "late" ? !isLate(s) : statusFilter !== "all" && s.status !== statusFilter) return false;
      if (carrierFilter !== "all" && s.carrierId !== carrierFilter) return false;
      if (zoneFilter !== "all" && s.zoneId !== zoneFilter) return false;
      if (periodDays && (now - new Date(s.createdAt).getTime()) / 86400000 > periodDays) return false;
      if (!q) return true;
      return [s.trackingNumber, s.recipientName, s.recipientPhone, s.deliveryAddress, s.invoiceId, orderNumbers[s.invoiceId ?? ""], carrierById.get(s.carrierId ?? "")?.name, zoneById.get(s.zoneId ?? "")?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipments, searchQuery, orderNumbers, carrierById, zoneById, statusFilter, carrierFilter, zoneFilter, periodFilter]);

  const filteredCarriers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return carriers;
    return carriers.filter((c) => [c.name, c.contactPerson, c.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [carriers, searchQuery]);

  const filteredZones = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter((z) => {
      const cName = carrierById.get(z.carrierId)?.name ?? "";
      return [z.name, cName].some((v) => v.toLowerCase().includes(q));
    });
  }, [zones, carrierById, searchQuery]);

  // ===== تحليلات الشحن =====
  const analytics = useMemo(() => {
    const closed = shipments.filter((s) => ["delivered", "returned"].includes(s.status));
    const delivered = shipments.filter((s) => s.status === "delivered");
    const returned = shipments.filter((s) => s.status === "returned");
    const durations = delivered
      .filter((s) => s.deliveredAt)
      .map((s) => daysBetween(s.createdAt, s.deliveredAt as string));
    const totalCost = shipments.reduce((sum, s) => sum + Number(s.shippingCost || 0), 0);
    return {
      successRate: closed.length ? (delivered.length / closed.length) * 100 : 0,
      returnRate: closed.length ? (returned.length / closed.length) * 100 : 0,
      avgDays: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      avgCost: shipments.length ? totalCost / shipments.length : 0,
      lateCount: shipments.filter(isLate).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipments, zoneById]);

  const carrierStats = useMemo(
    () =>
      carriers.map((c) => {
        const own = shipments.filter((s) => s.carrierId === c.id);
        const delivered = own.filter((s) => s.status === "delivered");
        const returned = own.filter((s) => s.status === "returned");
        const closed = delivered.length + returned.length;
        const durations = delivered.filter((s) => s.deliveredAt).map((s) => daysBetween(s.createdAt, s.deliveredAt as string));
        const due = own
          .filter((s) => s.collectionStatus === "collected")
          .reduce((sum, s) => sum + Number(s.codAmount || 0), 0);
        return {
          carrier: c,
          count: own.length,
          successRate: closed ? (delivered.length / closed) * 100 : 0,
          avgDays: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
          cost: own.reduce((sum, s) => sum + Number(s.shippingCost || 0), 0),
          due,
        };
      }),
    [carriers, shipments],
  );

  const zoneStats = useMemo(
    () =>
      zones.map((z) => {
        const own = shipments.filter((s) => s.zoneId === z.id);
        const delivered = own.filter((s) => s.status === "delivered");
        return { zone: z, count: own.length, delivered: delivered.length, cost: own.reduce((s2, s) => s2 + Number(s.shippingCost || 0), 0) };
      }),
    [zones, shipments],
  );

  const resetCarrierForm = () => { setCarrierName(""); setCarrierContact(""); setCarrierPhone(""); setCarrierBaseCost("0"); setEditCarrier(null); };
  const resetZoneForm = () => { setZoneName(""); setZoneCarrierId(""); setZoneCost("0"); setZoneDays("2"); setEditZone(null); };
  const resetShipmentForm = () => { setShipmentInvoiceId(""); setShipmentCarrierId(""); setShipmentZoneId(""); setShipmentTracking(""); setShipmentCost("0"); setShipmentCod("0"); };

  const handleAddCarrier = async () => {
    if (!carrierName) return toast.error("يرجى إدخال اسم الشركة");
    try {
      if (editCarrier) {
        await db.updateCarrier(editCarrier.id, { name: carrierName, contactPerson: carrierContact || null, phone: carrierPhone || null, baseCost: Number(carrierBaseCost) });
        toast.success("تم تحديث شركة الشحن");
      } else {
        await db.addCarrier({ name: carrierName, contactPerson: carrierContact || null, phone: carrierPhone || null, email: null, baseCost: Number(carrierBaseCost), active: true });
        toast.success("تمت إضافة شركة الشحن بنجاح");
      }
      setIsAddCarrierOpen(false);
      resetCarrierForm();
    } catch (e: any) { toast.error(e.message || "حدث خطأ أثناء الحفظ"); }
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
    } catch (e: any) { toast.error(e.message || "تعذر التحديث"); }
  };

  const handleAddZone = async () => {
    if (!zoneName || !zoneCarrierId) return toast.error("يرجى إدخال جميع البيانات المطلوبة");
    try {
      if (editZone) {
        await db.updateZone(editZone.id, { name: zoneName, carrierId: zoneCarrierId, deliveryCost: Number(zoneCost), estimatedDays: Number(zoneDays) || 2 });
        toast.success("تم تحديث المنطقة");
      } else {
        await db.addZone({ name: zoneName, carrierId: zoneCarrierId, deliveryCost: Number(zoneCost), estimatedDays: Number(zoneDays) || 2 });
        toast.success("تمت إضافة المنطقة بنجاح");
      }
      setIsAddZoneOpen(false);
      resetZoneForm();
    } catch (e: any) { toast.error(e.message || "حدث خطأ أثناء الإضافة"); }
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
    try { await db.removeZone(zone.id); toast.success("تم حذف المنطقة"); }
    catch (e: any) { toast.error(e.message || "تعذر الحذف"); }
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
        shippingCost: Number(shipmentCost) || 0,
        codAmount: Number(shipmentCod) || 0,
        collectionStatus: "uncollected",
        collectedAt: null,
        settledAt: null,
        notes: null,
      });
      toast.success("تمت إضافة الشحنة");
      setIsAddShipmentOpen(false);
      resetShipmentForm();
    } catch (e: any) { toast.error(e.message || "تعذر إنشاء الشحنة"); }
  };

  const handleStatusChange = async (id: string, status: ShipmentStatus) => {
    if (status === "returned") {
      const target = shipments.find((s) => s.id === id);
      if (target) {
        setSelectedReturnShipment(target);
        setSmartReturnModalOpen(true);
        return;
      }
    }
    let reason: string | undefined;
    if (status === "cancelled") {
      const label = statusMap[status]?.label ?? status;
      if (!window.confirm(`تأكيد تغيير الحالة إلى «${label}»؟`)) return;
      reason = window.prompt(`اكتب سبب ${label}`)?.trim() || undefined;
      if (!reason) return toast.error("سبب تغيير الحالة مطلوب");
    }
    try {
      await db.updateShipmentStatus(id, status, reason);
      toast.success("تم تحديث حالة الشحنة");
    } catch (e: any) { toast.error(e.message || "تعذر تحديث الحالة"); }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkStatus = async (status: ShipmentStatus) => {
    const ids = [...selected];
    if (!ids.length) return;
    let reason: string | undefined;
    if (status === "returned" || status === "cancelled") {
      reason = window.prompt(`اكتب سبب ${statusMap[status]?.label}`)?.trim() || undefined;
      if (!reason) return toast.error("سبب تغيير الحالة مطلوب");
    }
    const { ok, errors } = await db.bulkShipmentStatus(ids, status, reason);
    setSelected(new Set());
    if (ok) toast.success(`تم تحديث ${ok} شحنة`);
    if (errors.length) toast.error(`${errors.length} شحنة لم تتحدث: ${errors[0]}`);
  };

  const handleBulkAssign = async () => {
    if (!bulkCarrier || !selected.size) return;
    try {
      await db.bulkAssignCarrier([...selected], bulkCarrier);
      toast.success("تم تعيين المندوب للشحنات المحددة");
      setSelected(new Set());
      setBulkCarrier("");
    } catch (e: any) { toast.error(e.message || "تعذر التعيين"); }
  };

  const handleSettle = async (carrierId: string, amount: number) => {
    if (!window.confirm(`تأكيد تسوية ${egp(amount)} مع المندوب؟`)) return;
    try {
      const n = await db.settleCarrierCollections(carrierId);
      toast.success(`تمت تسوية ${n} شحنة`);
    } catch (e: any) { toast.error(e.message || "تعذرت التسوية"); }
  };

  const labelFor = (s: Shipment) =>
    printShipmentLabel({
      tracking: s.trackingNumber ?? s.id.slice(0, 8).toUpperCase(),
      recipientName: s.recipientName ?? "",
      recipientPhone: s.recipientPhone ?? "",
      address: s.deliveryAddress ?? "",
      carrierName: carrierById.get(s.carrierId ?? "")?.name ?? "",
      zoneName: zoneById.get(s.zoneId ?? "")?.name ?? "",
      codAmount: s.codAmount,
      shippingCost: s.shippingCost,
      createdAt: s.createdAt,
      invoiceRef: s.invoiceId ? orderNumbers[s.invoiceId] ?? s.invoiceId.slice(0, 8) : undefined,
    });

  const manifestFor = (carrier: ShipmentCarrier) => {
    const rows = shipments
      .filter((s) => s.carrierId === carrier.id && ["pending", "processing", "shipped"].includes(s.status))
      .map((s) => ({
        tracking: s.trackingNumber ?? s.id.slice(0, 8).toUpperCase(),
        recipient: s.recipientName ?? "",
        phone: s.recipientPhone ?? "",
        address: s.deliveryAddress ?? "",
        cod: s.codAmount,
        status: statusMap[s.status]?.label ?? s.status,
      }));
    if (!rows.length) return toast.error("لا توجد شحنات نشطة لهذا المندوب");
    printCarrierManifest({ carrierName: carrier.name, dateLabel: new Date().toLocaleDateString("en-US"), rows });
  };

  const whatsappLink = (s: Shipment) => {
    const carrier = carriers.find((c) => c.id === s.carrierId);
    const zone = zones.find((z) => z.id === s.zoneId);
    const orderNumber = s.invoiceId ? orderNumbers[s.invoiceId] : undefined;
    const tracking = s.trackingNumber || orderNumber || s.id.slice(0, 8).toUpperCase();
    const trackUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/order-tracking?num=${encodeURIComponent(orderNumber || tracking)}&phone=${encodeURIComponent(s.recipientPhone ?? "")}`;
    const msg = renderShipmentOutForDelivery({
      shop: { shopName: shopSettings.shopName || "سِجلّي", shopPhone: shopSettings.phone, whatsapp: shopSettings.whatsapp },
      recipientName: s.recipientName ?? "",
      recipientPhone: s.recipientPhone ?? "",
      trackingNumber: tracking,
      carrierName: carrier?.name,
      carrierPhone: carrier?.phone ?? undefined,
      zoneName: zone?.name,
      deliveryAddress: s.deliveryAddress ?? "",
      codAmount: s.codAmount ? String(s.codAmount) : undefined,
      trackUrl,
      publicNumber: orderNumber,
    });
    return waLink(s.recipientPhone ?? "", msg);
  };

  const selectedInvoiceCustomer = shipmentInvoiceId
    ? customerById.get(invoices.find((inv) => inv.id === shipmentInvoiceId)?.customerId ?? "")
    : null;

  const totalDue = carrierStats.reduce((s, c) => s + c.due, 0);

  return (
    <AppShell>
      <div className="space-y-8 pb-20" dir="rtl">
        <PageHeader
          title="نظام الشحن"
          subtitle="تتبع شحناتك، حصّل فلوسك من المناديب، واطبع البوالص والمانيفست"
          icon={<Truck className="h-7 w-7" />}
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-1.5 font-bold border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => setFastScannerOpen(true)}
              >
                <QrCode className="h-4 w-4" />
                الماسح السريع (باركون / كاميرا)
              </Button>
              <Button
                variant="outline"
                className="gap-1.5 font-bold border-emerald-600/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                onClick={() => setExcelModalOpen(true)}
              >
                <FileSpreadsheet className="h-4 w-4" />
                تكامل إكسيل شركات الشحن
              </Button>
              <Button variant="outline" asChild>
                <a href="/delivery" target="_blank" rel="noopener noreferrer">
                  <Smartphone className="ml-1.5 h-4 w-4 text-indigo-500" />
                  بوابة المندوب (موبايل)
                </a>
              </Button>
              <Button variant="outline" asChild><Link to="/shipping/day"><CalendarDays className="ml-2 h-4 w-4" /> يوم الشحن</Link></Button>
              <Button variant="outline" asChild><Link to="/shipping/rescue"><ShieldAlert className="ml-2 h-4 w-4" /> إنقاذ الطلبات</Link></Button>
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
                      <Select
                        value={shipmentInvoiceId}
                        onValueChange={(val) => {
                          setShipmentInvoiceId(val);
                          const inv = invoiceById.get(val);
                          if (inv) setShipmentCod(String(Math.max(0, inv.total - inv.paid)));
                        }}
                      >
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
                      <Label>المندوب / شركة الشحن</Label>
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
                      <Select
                        value={shipmentZoneId}
                        onValueChange={(val) => { setShipmentZoneId(val); const z = zoneById.get(val); if (z) setShipmentCost(String(z.deliveryCost)); }}
                        disabled={!shipmentCarrierId}
                      >
                        <SelectTrigger className="text-right"><SelectValue placeholder="اختر المنطقة" /></SelectTrigger>
                        <SelectContent>
                          {zones.filter((z) => z.carrierId === shipmentCarrierId).map((z) => (
                            <SelectItem key={z.id} value={z.id}>{z.name} — {z.deliveryCost} ج.م</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>تكلفة الشحن (ج.م)</Label>
                        <Input type="number" value={shipmentCost} onChange={(e) => setShipmentCost(e.target.value)} className="text-right" />
                      </div>
                      <div className="space-y-2">
                        <Label>مبلغ التحصيل COD</Label>
                        <Input type="number" value={shipmentCod} onChange={(e) => setShipmentCod(e.target.value)} className="text-right" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>رقم البوليصة / التتبع</Label>
                      <Input value={shipmentTracking} onChange={(e) => setShipmentTracking(e.target.value)} placeholder="اختياري" className="text-right" />
                    </div>
                    <p className="rounded-xl bg-primary/5 p-3 text-xs text-muted-foreground">
                      عند تسجيل «تم التوصيل» يتم تلقائيًا إضافة دفعة على الفاتورة بمبلغ التحصيل، وتسجيل مصروف بتكلفة الشحن.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => void handleAddShipment()} className="h-12 w-full rounded-xl font-bold">حفظ الشحنة</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          }
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "شحنات نشطة", value: String(shipments.filter((s) => ["pending", "processing", "shipped"].includes(s.status)).length), icon: Truck, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "تم التوصيل", value: String(shipments.filter((s) => s.status === "delivered").length), icon: PackageCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "شحنات متأخرة", value: String(analytics.lateCount), icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-500/10" },
            { label: "مستحقات المناديب", value: egp(totalDue), icon: Wallet, color: "text-amber-500", bg: "bg-amber-500/10" },
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
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <TabsList className="h-12 w-fit rounded-2xl bg-muted/50 p-1 ring-1 ring-hairline backdrop-blur-md">
                    <TabsTrigger value="shipments" className="rounded-xl px-5 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      <Truck className="ml-2 h-4 w-4" /> الشحنات
                    </TabsTrigger>
                    <TabsTrigger value="reconciliation" className="rounded-xl px-5 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      <Calculator className="ml-2 h-4 w-4 text-emerald-600" /> كشف الحساب والمطابقة
                    </TabsTrigger>
                    <TabsTrigger value="dues" className="rounded-xl px-5 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      <Wallet className="ml-2 h-4 w-4" /> المستحقات
                    </TabsTrigger>
                    <TabsTrigger value="carriers" className="rounded-xl px-5 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      <Building2 className="ml-2 h-4 w-4" /> المناديب
                    </TabsTrigger>
                    <TabsTrigger value="zones" className="rounded-xl px-5 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      <MapPin className="ml-2 h-4 w-4" /> المناطق
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="rounded-xl px-5 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      <BarChart3 className="ml-2 h-4 w-4" /> التحليلات
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
                <div className="flex flex-wrap gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 w-[150px] rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      {Object.entries(statusMap).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                      <SelectItem value="late">المتأخرة فقط</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={carrierFilter} onValueChange={setCarrierFilter}>
                    <SelectTrigger className="h-10 w-[150px] rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المناديب</SelectItem>
                      {carriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={zoneFilter} onValueChange={setZoneFilter}>
                    <SelectTrigger className="h-10 w-[150px] rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المناطق</SelectItem>
                      {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={periodFilter} onValueChange={setPeriodFilter}>
                    <SelectTrigger className="h-10 w-[140px] rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الفترات</SelectItem>
                      <SelectItem value="7">آخر 7 أيام</SelectItem>
                      <SelectItem value="30">آخر 30 يوم</SelectItem>
                      <SelectItem value="90">آخر 90 يوم</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selected.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                    <span className="text-sm font-bold">{selected.size} شحنة محددة</span>
                    <Button size="sm" variant="outline" onClick={() => void handleBulkStatus("processing")}>تجهيز</Button>
                    <Button size="sm" variant="outline" onClick={() => void handleBulkStatus("shipped")}>شحن</Button>
                    <Button size="sm" variant="outline" onClick={() => void handleBulkStatus("delivered")}>تسليم</Button>
                    <Select value={bulkCarrier} onValueChange={setBulkCarrier}>
                      <SelectTrigger className="h-9 w-[160px] rounded-xl text-xs font-bold"><SelectValue placeholder="تعيين مندوب" /></SelectTrigger>
                      <SelectContent>
                        {carriers.filter((c) => c.active).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" disabled={!bulkCarrier} onClick={() => void handleBulkAssign()}>تعيين</Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>إلغاء التحديد</Button>
                  </div>
                )}
              </div>
            </div>

            <TabsContent value="shipments">
              <div className="grid gap-4">
                {filteredShipments.length === 0 ? (
                  <BezelCard className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-4 rounded-full bg-muted p-6">
                      <Truck className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">لا توجد شحنات مطابقة</h3>
                    <p className="mt-2 text-muted-foreground">جرّب تغيير الفلاتر أو أضف شحنة جديدة.</p>
                  </BezelCard>
                ) : (
                  filteredShipments.map((s, i) => (
                    <Reveal key={s.id} delay={Math.min(i, 8) * 0.05}>
                      <BezelCard className="plate group flex flex-wrap items-center gap-4 p-5 lg:gap-6">
                        <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} aria-label="تحديد الشحنة" />
                        <div className={`h-12 w-1.5 rounded-full ${statusMap[s.status]?.color.split(" ")[0]}`} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-bold">#{s.trackingNumber || "بدون رقم"}</span>
                            <span className={`rounded-full border px-3 py-0.5 text-[11px] font-bold ${statusMap[s.status]?.color}`}>
                              {statusMap[s.status]?.label}
                            </span>
                            {isLate(s) && <span className="rounded-full bg-rose-500/10 px-3 py-0.5 text-[11px] font-bold text-rose-500">متأخرة</span>}
                            {s.codAmount > 0 && (
                              <span className={`rounded-full px-3 py-0.5 text-[11px] font-bold ${collectionMap[s.collectionStatus]?.color}`}>
                                {collectionMap[s.collectionStatus]?.label}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">{s.recipientName} • {s.recipientPhone}</p>
                          {s.invoiceId && (
                            <Link to="/invoices" search={{ invoice: s.invoiceId } as never} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <ExternalLink className="h-3 w-3" /> فاتورة مرتبطة
                            </Link>
                          )}
                        </div>
                        <div className="hidden text-right md:block">
                          <p className="text-sm font-medium text-muted-foreground">التحصيل</p>
                          <p className="text-sm font-bold">{egp(s.codAmount)}</p>
                        </div>
                        <div className="hidden text-right md:block">
                          <p className="text-sm font-medium text-muted-foreground">التكلفة</p>
                          <p className="text-sm font-bold">{egp(s.shippingCost)}</p>
                        </div>
                        <div className="hidden text-right lg:block">
                          <p className="text-sm font-medium text-muted-foreground">التاريخ</p>
                          <p className="text-sm font-bold">{format(new Date(s.createdAt), "dd MMMM yyyy", { locale: ar })}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="إشعارات وقوالب واتساب التلقائية"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                            onClick={() => setWhatsappModalShipment(s)}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="بوليصة شحن" onClick={() => labelFor(s)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="تفاصيل" onClick={() => setDetail(s)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Select value={s.status} onValueChange={(val) => void handleStatusChange(s.id, val as ShipmentStatus)}>
                            <SelectTrigger className="h-9 w-[130px] rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {allowedShipmentStatuses(s.status).map((status) => <SelectItem key={status} value={status}>{statusMap[status]?.label ?? status}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </BezelCard>
                    </Reveal>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="reconciliation">
              <CarrierReconciliationView
                carriers={carriers}
                shipments={shipments}
                onRefresh={async () => {
                  // DB refresh if needed
                }}
              />
            </TabsContent>

            <TabsContent value="dues">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {carrierStats.map((st, i) => (
                  <Reveal key={st.carrier.id} delay={i * 0.08}>
                    <BezelCard className="plate space-y-4 p-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold">{st.carrier.name}</h3>
                        <Wallet className="h-5 w-5 text-amber-500" />
                      </div>
                      <div className="rounded-2xl bg-amber-500/5 p-4">
                        <p className="text-xs font-medium text-muted-foreground">محصّل ولم يُسلَّم بعد</p>
                        <p className="mt-1 text-2xl font-bold text-amber-500">{egp(st.due)}</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-hairline pt-3 text-sm">
                        <span className="text-muted-foreground">عدد الشحنات</span>
                        <span className="font-bold">{st.count}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button className="flex-1" disabled={st.due <= 0} onClick={() => void handleSettle(st.carrier.id, st.due)}>
                          <CheckCheck className="ml-2 h-4 w-4" /> تسوية
                        </Button>
                        <Button variant="outline" onClick={() => manifestFor(st.carrier)} title="مانيفست اليوم">
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </BezelCard>
                  </Reveal>
                ))}
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
                        <Button variant="outline" size="sm" onClick={() => manifestFor(c)} title="مانيفست">
                          <Printer className="h-4 w-4" />
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
                        <span className="font-bold text-muted-foreground transition-colors group-hover:text-primary">إضافة مندوب / شركة شحن</span>
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
                        <span className="text-[10px] font-bold text-muted-foreground">{carrierById.get(z.carrierId)?.name}</span>
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

            <TabsContent value="analytics">
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "نسبة التسليم الناجح", value: `${analytics.successRate.toFixed(1)}%`, tone: "text-emerald-500" },
                    { label: "نسبة المرتجع", value: `${analytics.returnRate.toFixed(1)}%`, tone: "text-rose-500" },
                    { label: "متوسط أيام التسليم", value: analytics.avgDays.toFixed(1), tone: "text-blue-500" },
                    { label: "متوسط تكلفة الشحنة", value: egp(analytics.avgCost), tone: "text-amber-500" },
                  ].map((k, i) => (
                    <Reveal key={k.label} delay={i * 0.08}>
                      <BezelCard className="plate p-6">
                        <p className="text-sm font-medium text-muted-foreground">{k.label}</p>
                        <p className={`mt-2 text-3xl font-bold tracking-tight ${k.tone}`}>{k.value}</p>
                      </BezelCard>
                    </Reveal>
                  ))}
                </div>

                <Reveal delay={0.2}>
                  <BezelCard className="p-6">
                    <h3 className="mb-4 text-lg font-bold">أداء المناديب</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-sm">
                        <thead className="text-muted-foreground">
                          <tr className="border-b border-hairline">
                            <th className="py-2 font-medium">المندوب</th>
                            <th className="py-2 font-medium">الشحنات</th>
                            <th className="py-2 font-medium">نسبة النجاح</th>
                            <th className="py-2 font-medium">متوسط الأيام</th>
                            <th className="py-2 font-medium">إجمالي التكلفة</th>
                            <th className="py-2 font-medium">مستحقات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {carrierStats.map((st) => (
                            <tr key={st.carrier.id} className="border-b border-hairline/50">
                              <td className="py-3 font-bold">{st.carrier.name}</td>
                              <td className="py-3">{st.count}</td>
                              <td className="py-3">{st.successRate.toFixed(0)}%</td>
                              <td className="py-3">{st.avgDays.toFixed(1)}</td>
                              <td className="py-3">{egp(st.cost)}</td>
                              <td className="py-3 font-bold text-amber-500">{egp(st.due)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </BezelCard>
                </Reveal>

                <Reveal delay={0.3}>
                  <BezelCard className="p-6">
                    <h3 className="mb-4 text-lg font-bold">أداء المناطق</h3>
                    <div className="space-y-3">
                      {zoneStats.map((zs) => {
                        const max = Math.max(1, ...zoneStats.map((x) => x.count));
                        return (
                          <div key={zs.zone.id}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="font-bold">{zs.zone.name}</span>
                              <span className="text-muted-foreground">{zs.count} شحنة · {egp(zs.cost)}</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${(zs.count / max) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {zoneStats.length === 0 && <p className="text-sm text-muted-foreground">لا توجد مناطق مسجلة بعد.</p>}
                    </div>
                  </BezelCard>
                </Reveal>
              </div>
            </TabsContent>
          </Tabs>
        </Reveal>

        {/* تفاصيل الشحنة + التايم لاين */}
        <Sheet open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null); }}>
          <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-md" dir="rtl">
            {detail && (
              <>
                <SheetHeader>
                  <SheetTitle className="text-right">شحنة #{detail.trackingNumber || detail.id.slice(0, 8)}</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div className="rounded-2xl bg-muted/40 p-4 text-sm">
                    <p className="font-bold">{detail.recipientName}</p>
                    <p className="text-muted-foreground">{detail.recipientPhone}</p>
                    <p className="mt-1 text-muted-foreground">{detail.deliveryAddress}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-primary/5 p-3">
                      <p className="text-xs text-muted-foreground">التحصيل</p>
                      <p className="font-bold">{egp(detail.codAmount)}</p>
                    </div>
                    <div className="rounded-xl bg-amber-500/5 p-3">
                      <p className="text-xs text-muted-foreground">تكلفة الشحن</p>
                      <p className="font-bold">{egp(detail.shippingCost)}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 text-sm font-bold">مسار الشحنة</h4>
                    <div className="space-y-3">
                      {[
                        { label: "تم الإنشاء", at: detail.createdAt },
                        { label: "جاري التجهيز", at: detail.processingAt },
                        { label: "تم الشحن", at: detail.shippedAt },
                        { label: "تم التوصيل", at: detail.deliveredAt },
                        ...(detail.returnedAt ? [{ label: "مرتجع", at: detail.returnedAt }] : []),
                      ].map((step) => (
                        <div key={step.label} className="flex items-start gap-3">
                          <div className={`mt-1 h-3 w-3 rounded-full ${step.at ? "bg-primary" : "bg-muted"}`} />
                          <div>
                            <p className={`text-sm font-bold ${step.at ? "" : "text-muted-foreground"}`}>{step.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {step.at ? format(new Date(step.at), "dd MMM yyyy — hh:mm a", { locale: ar }) : "لم يتم بعد"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => labelFor(detail)}>
                      <Printer className="ml-2 h-4 w-4" /> بوليصة
                    </Button>
                    <Button asChild className="flex-1">
                      <a href={whatsappLink(detail)} target="_blank" rel="noreferrer">
                        <MessageCircle className="ml-2 h-4 w-4" /> واتساب
                      </a>
                    </Button>
                  </div>
                  {detail.invoiceId && (
                    <Link to="/invoices" search={{ invoice: detail.invoiceId } as never} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                      <ExternalLink className="h-4 w-4" /> عرض الفاتورة المرتبطة
                    </Link>
                  )}
                  {isLate(detail) && (
                    <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500">
                      <Clock className="h-4 w-4" /> الشحنة تجاوزت مدة التوصيل المتوقعة — راجع صفحة الإنقاذ.
                    </div>
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
        {/* الماسح السريع للباركود والكاميرا */}
        <FastBarcodeScanner
          open={fastScannerOpen}
          onOpenChange={setFastScannerOpen}
          carriers={carriers}
          shipments={shipments}
          onRefresh={async () => {
            // DB refresh
          }}
        />

        {/* تكامل إكسيل شركات الشحن */}
        <CarrierExcelIntegrationModal
          open={excelModalOpen}
          onOpenChange={setExcelModalOpen}
          carriers={carriers}
          zones={zones}
          shipments={shipments}
          onRefresh={async () => {
            // DB refresh
          }}
        />

        {/* مودال المرتجع الذكي وإعادة التخزين */}
        <SmartReturnModal
          open={smartReturnModalOpen}
          onOpenChange={setSmartReturnModalOpen}
          shipment={selectedReturnShipment}
          onSuccess={async () => {
            // DB refresh
          }}
        />

        {/* قائمة وقوالب رسائل واتساب */}
        {whatsappModalShipment && (
          <WhatsAppMenu
            open={!!whatsappModalShipment}
            onOpenChange={(open) => {
              if (!open) setWhatsappModalShipment(null);
            }}
            shipment={whatsappModalShipment}
            carrier={carriers.find((c) => c.id === whatsappModalShipment.carrierId)}
          />
        )}
      </div>
    </AppShell>
  );
}
