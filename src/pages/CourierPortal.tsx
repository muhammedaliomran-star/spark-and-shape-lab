import { useState, useMemo, useEffect, useRef } from "react";
import { useDB, type Shipment, type ShipmentCarrier } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  Phone,
  MessageSquare,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Search,
  ScanLine,
  RefreshCw,
  Wallet,
  Package,
  Calendar,
  ExternalLink,
  ChevronLeft,
  X,
  Sparkles,
  Camera,
  Share2,
  Navigation,
  Clock,
  User,
  HelpCircle,
  RotateCcw,
} from "lucide-react";
import { Link } from "@/lib/router-compat";
import { WhatsAppTemplateModal } from "@/components/WhatsAppTemplateModal";
import { generateWhatsAppLink, type WhatsAppTemplateData } from "@/lib/whatsapp";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { toast } from "sonner";

const QUICK_FAIL_REASONS = [
  "الهاتف مغلق / غير متاح",
  "العميل لم يرد على الاتصال",
  "طلب العميل تأجيل موعد الاستلام",
  "العنوان غير واضح / يحتاج تفاصيل إضافية",
  "العميل رفض الاستلام",
  "المندوب لم يتمكن من الوصول للمنطقة",
];

const money = (val: number) =>
  new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(Math.round(val || 0));

export default function CourierPortal() {
  const { shipments, carriers, invoices, zones, updateShipmentStatus, refresh, loading } = useDB();
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "delivered" | "returned">("active");

  // Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Delivery Modal State
  const [deliverModalShipment, setDeliverModalShipment] = useState<Shipment | null>(null);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [collectedAmount, setCollectedAmount] = useState<string>("");

  // Fail / Reschedule Modal State
  const [failModalShipment, setFailModalShipment] = useState<Shipment | null>(null);
  const [failReason, setFailReason] = useState(QUICK_FAIL_REASONS[0]);
  const [customFailNote, setCustomFailNote] = useState("");

  // WhatsApp Modal State
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [whatsAppShipment, setWhatsAppShipment] = useState<Shipment | null>(null);

  // Read query parameter for initial carrier selection
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cId = params.get("carrier") || params.get("carrierId");
    if (cId) {
      const match = carriers.find((c) => c.id === cId || c.phone?.replace(/\D/g, "") === cId.replace(/\D/g, ""));
      if (match) {
        setSelectedCarrierId(match.id);
      }
    }
  }, [carriers]);

  const activeCarrier = useMemo(() => {
    if (selectedCarrierId === "all") return null;
    return carriers.find((c) => c.id === selectedCarrierId) || null;
  }, [selectedCarrierId, carriers]);

  // Invoice Map
  const invoiceMap = useMemo(() => new Map(invoices.map((inv) => [inv.id, inv])), [invoices]);
  const carrierMap = useMemo(() => new Map(carriers.map((c) => [c.id, c])), [carriers]);
  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  // Filtered Shipments
  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      // Carrier match
      if (selectedCarrierId !== "all" && s.carrierId !== selectedCarrierId) return false;

      // Status filter
      if (statusFilter === "active" && !["pending", "processing", "shipped"].includes(s.status)) return false;
      if (statusFilter === "delivered" && s.status !== "delivered") return false;
      if (statusFilter === "returned" && !["returned", "failed"].includes(s.status)) return false;

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const tracking = (s.trackingNumber || "").toLowerCase();
        const name = (s.recipientName || "").toLowerCase();
        const phone = (s.recipientPhone || "").toLowerCase();
        const addr = (s.deliveryAddress || "").toLowerCase();
        const inv = s.invoiceId ? invoiceMap.get(s.invoiceId) : null;
        const invNum = (inv?.id || "").toLowerCase();

        return (
          tracking.includes(q) ||
          name.includes(q) ||
          phone.includes(q) ||
          addr.includes(q) ||
          invNum.includes(q)
        );
      }

      return true;
    });
  }, [shipments, selectedCarrierId, statusFilter, searchQuery, invoiceMap]);

  // KPIs
  const kpis = useMemo(() => {
    const relevant = selectedCarrierId === "all" ? shipments : shipments.filter((s) => s.carrierId === selectedCarrierId);
    const totalAssigned = relevant.length;
    let activeCount = 0;
    let deliveredCount = 0;
    let returnedCount = 0;
    let totalCashToCollect = 0;
    let totalCashCollected = 0;

    for (const s of relevant) {
      const cod = Number(s.codAmount || s.shippingCost || 0);
      if (["pending", "processing", "shipped"].includes(s.status)) {
        activeCount++;
        totalCashToCollect += cod;
      } else if (s.status === "delivered") {
        deliveredCount++;
        totalCashCollected += cod;
      } else if (["returned", "failed"].includes(s.status)) {
        returnedCount++;
      }
    }

    return {
      totalAssigned,
      activeCount,
      deliveredCount,
      returnedCount,
      totalCashToCollect,
      totalCashCollected,
    };
  }, [shipments, selectedCarrierId]);

  // Handle Barcode Scanner Start/Stop
  const startScanner = async () => {
    setIsScanning(true);
    try {
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;
      
      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      const selectedDeviceId = videoInputDevices.length > 0
        ? (videoInputDevices.find((d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear"))?.deviceId || videoInputDevices[0].deviceId)
        : undefined;

      await codeReader.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current ?? undefined,
        (result, err) => {
          if (result) {
            const text = result.getText().trim();
            setSearchQuery(text);
            stopScanner();
            toast.success(`تم مسح الباركود: ${text}`);
          }
        }
      );
    } catch (e) {
      console.error(e);
      toast.error("تعذر فتح كاميرا الهاتف للمسح");
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (codeReaderRef.current) {
      try {
        // Reset scanner stream
        (codeReaderRef.current as any).reset?.();
      } catch {
        // ignore
      }
      codeReaderRef.current = null;
    }
    setIsScanning(false);
  };

  // Mark as Delivered
  const handleConfirmDelivered = async () => {
    if (!deliverModalShipment) return;
    try {
      await updateShipmentStatus(deliverModalShipment.id, "delivered", deliveryNote || "تم التسليم بنجاح مع المندوب");
      toast.success("تم تسجيل تسليم الشحنة واستلام المبلغ بنجاح!");
      setDeliverModalShipment(null);
      setDeliveryNote("");
      void refresh();
    } catch {
      toast.error("حدث خطأ أثناء حفظ الحالة");
    }
  };

  // Mark as Failed / Rescheduled
  const handleConfirmFailed = async () => {
    if (!failModalShipment) return;
    const finalReason = customFailNote.trim() ? `${failReason}: ${customFailNote.trim()}` : failReason;
    try {
      await updateShipmentStatus(failModalShipment.id, "returned", finalReason);
      toast.success("تم تسجيل تعذر التسليم وتحديث حالة الشحنة");
      
      // Prompt for WhatsApp notification
      setWhatsAppShipment(failModalShipment);
      setFailModalShipment(null);
      setCustomFailNote("");
      void refresh();
    } catch {
      toast.error("حدث خطأ أثناء التحديث");
    }
  };

  // Google Maps Directions link
  const getMapsUrl = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  // Open WhatsApp Modal
  const openWhatsApp = (s: Shipment) => {
    setWhatsAppShipment(s);
    setWhatsAppModalOpen(true);
  };

  // Share Daily Summary via WhatsApp
  const shareDailySummary = () => {
    const name = activeCarrier?.name || "المندوب";
    const msg = `📊 *تقرير توريد شحنات المندوب:* ${name}
📅 التاريخ: ${new Date().toLocaleDateString("ar-EG")}

✅ *عدد الشحنات المسلمة:* ${kpis.deliveredCount}
💵 *إجمالي النقدية المحصلة (COD):* ${money(kpis.totalCashCollected)} ج.م
⏳ *الشحنات المتبقية للتوصيل:* ${kpis.activeCount}
⚠️ *المرتجعات / المؤجل:* ${kpis.returnedCount}

_تم الإنشاء عبر بوابة المندوب - سِجلّي_`;

    const adminPhone = "201066830834";
    const link = generateWhatsAppLink(adminPhone, msg);
    window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#09110e] text-slate-100 selection:bg-emerald-500 selection:text-black pb-24 relative overflow-x-hidden font-sans"
    >
      {/* Background Ambient Aura */}
      <div
        className="pointer-events-none absolute -top-24 right-1/4 h-80 w-80 rounded-full bg-emerald-500/10 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/3 -left-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-[120px]"
        aria-hidden
      />

      {/* Top Mobile App Bar */}
      <header className="sticky top-0 z-30 bg-[#09110e]/85 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <div className="mx-auto max-w-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-md shadow-emerald-950/40 shrink-0">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-white tracking-tight">بوابة المندوب</h1>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase">
                  ميداني
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {activeCarrier ? `كابتن: ${activeCarrier.name}` : "كل الشحنات المسندة"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={loading}
              className="h-9 px-2.5 text-xs bg-white/5 border-white/10 text-slate-300 hover:text-white rounded-xl"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs bg-white/5 border-white/10 text-slate-300 hover:text-white rounded-xl gap-1"
            >
              <Link to="/shipping">
                <ChevronLeft className="h-3.5 w-3.5" />
                اللوحة
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-4 space-y-4">
        {/* Carrier Quick Selector */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <User className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-slate-300 whitespace-nowrap">اسم المندوب:</span>
            <Select value={selectedCarrierId} onValueChange={setSelectedCarrierId}>
              <SelectTrigger className="h-9 text-xs bg-white/5 border-white/10 text-white rounded-xl flex-1 sm:w-52">
                <SelectValue placeholder="اختر المندوب..." />
              </SelectTrigger>
              <SelectContent dir="rtl" className="bg-[#121c18] border-white/15 text-white">
                <SelectItem value="all" className="text-xs font-bold">
                  🌟 كل المناديب (عرض شامل)
                </SelectItem>
                {carriers.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name} {c.phone ? `(${c.phone})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activeCarrier?.phone && (
            <a
              href={`tel:${activeCarrier.phone}`}
              className="text-[11px] font-mono text-emerald-400 hover:underline flex items-center gap-1 self-end sm:self-center"
              dir="ltr"
            >
              <Phone className="h-3 w-3" /> {activeCarrier.phone}
            </a>
          )}
        </div>

        {/* Live Daily KPI Card */}
        <div className="rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/15 via-white/[0.03] to-white/[0.01] p-4 sm:p-5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              ملخص التحصيل والتوصيل اليوم
            </span>
            <Button
              size="sm"
              onClick={shareDailySummary}
              className="h-7 text-[11px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg gap-1"
            >
              <Share2 className="h-3 w-3" />
              مشاركة التقرير
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5">
            {/* KPI 1: Collected Cash */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] font-bold text-emerald-300 block">تم تحصيله (توريد)</span>
              <span className="text-lg sm:text-xl font-black text-emerald-400 block mt-0.5">
                {money(kpis.totalCashCollected)} <span className="text-xs">ج.م</span>
              </span>
            </div>

            {/* KPI 2: Remaining Cash */}
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
              <span className="text-[10px] font-bold text-cyan-300 block">المتبقي في الطريق</span>
              <span className="text-lg sm:text-xl font-black text-cyan-300 block mt-0.5">
                {money(kpis.totalCashToCollect)} <span className="text-xs">ج.م</span>
              </span>
            </div>

            {/* KPI 3: Delivered Count */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] font-bold text-slate-400 block">شحنات سلمت</span>
              <span className="text-lg sm:text-xl font-black text-white block mt-0.5">
                {kpis.deliveredCount}{" "}
                <span className="text-xs text-slate-400 font-normal">/ {kpis.totalAssigned}</span>
              </span>
            </div>

            {/* KPI 4: Pending / Active */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] font-bold text-amber-300 block">بانتظار التسليم</span>
              <span className="text-lg sm:text-xl font-black text-amber-400 block mt-0.5">
                {kpis.activeCount} <span className="text-xs text-amber-200/70 font-normal">شحنة</span>
              </span>
            </div>
          </div>
        </div>

        {/* Search Bar + Barcode Scanner Trigger */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-3 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، الموبايل، أو رقم التتبع..."
              className="h-11 pr-10 pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-2xl text-xs focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-3 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button
            type="button"
            onClick={isScanning ? stopScanner : startScanner}
            className={`h-11 px-3.5 rounded-2xl font-bold text-xs gap-1.5 shadow-md ${
              isScanning
                ? "bg-rose-600 hover:bg-rose-500 text-white"
                : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20"
            }`}
          >
            <ScanLine className="h-4 w-4" />
            <span className="hidden sm:inline">{isScanning ? "إلغاء المسح" : "مسح الباركود"}</span>
          </Button>
        </div>

        {/* Mobile Camera Scanner Viewfinder */}
        {isScanning && (
          <div className="rounded-3xl border border-emerald-500/40 bg-black/90 p-4 space-y-3 shadow-2xl animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-bold">
              <span className="flex items-center gap-1.5">
                <Camera className="h-4 w-4 animate-pulse" />
                وجّه كاميرا الهاتف نحو باركود الشحنة
              </span>
              <button onClick={stopScanner} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/20">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              {/* Overlay crosshair */}
              <div className="absolute inset-0 border-2 border-emerald-500/50 pointer-events-none m-8 rounded-xl flex items-center justify-center">
                <div className="w-full h-0.5 bg-emerald-400/80 shadow-lg shadow-emerald-400 animate-bounce" />
              </div>
            </div>
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-white/[0.04] border border-white/10 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setStatusFilter("active")}
            className={`py-2 rounded-xl transition-all ${
              statusFilter === "active"
                ? "bg-emerald-500 text-black shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            للتسليم ({kpis.activeCount})
          </button>
          <button
            onClick={() => setStatusFilter("delivered")}
            className={`py-2 rounded-xl transition-all ${
              statusFilter === "delivered"
                ? "bg-emerald-500 text-black shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            تمت ({kpis.deliveredCount})
          </button>
          <button
            onClick={() => setStatusFilter("returned")}
            className={`py-2 rounded-xl transition-all ${
              statusFilter === "returned"
                ? "bg-emerald-500 text-black shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            مرتجع ({kpis.returnedCount})
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`py-2 rounded-xl transition-all ${
              statusFilter === "all"
                ? "bg-emerald-500 text-black shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            الكل ({filteredShipments.length})
          </button>
        </div>

        {/* Shipments List */}
        <div className="space-y-3 pt-1">
          {filteredShipments.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center space-y-2">
              <Package className="h-8 w-8 text-slate-500 mx-auto" />
              <p className="text-sm font-bold text-slate-300">لا توجد شحنات مطابقة</p>
              <p className="text-xs text-slate-500">
                {searchQuery ? "جرب تغيير نص البحث أو الفلتر" : "لا توجد شحنات نشطة مسندة حالياً"}
              </p>
            </div>
          ) : (
            filteredShipments.map((s) => {
              const cod = Number(s.codAmount || s.shippingCost || 0);
              const inv = s.invoiceId ? invoiceMap.get(s.invoiceId) : null;
              const carrier = carrierMap.get(s.carrierId ?? "");
              const zone = s.zoneId ? zoneMap.get(s.zoneId) : null;
              const isDelivered = s.status === "delivered";
              const isFailed = ["returned", "failed"].includes(s.status);

              return (
                <div
                  key={s.id}
                  className={`rounded-3xl border p-4 sm:p-5 backdrop-blur-md transition-all space-y-3.5 ${
                    isDelivered
                      ? "border-emerald-500/20 bg-emerald-950/10"
                      : isFailed
                      ? "border-rose-500/20 bg-rose-950/10"
                      : "border-white/10 bg-white/[0.03] hover:border-emerald-500/30"
                  }`}
                >
                  {/* Top Bar: Recipient & COD Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-extrabold text-white">
                          {s.recipientName || "عميل بدون اسم"}
                        </h2>
                        {isDelivered ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black">
                            <CheckCircle2 className="h-3 w-3" /> تم التسليم
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-black">
                            <AlertTriangle className="h-3 w-3" /> مرتجع / مؤجل
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-black">
                            <Truck className="h-3 w-3" /> قيد التوصيل
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span className="font-mono text-slate-300">
                          #{s.trackingNumber || s.id.slice(0, 8)}
                        </span>
                        {inv?.id && (
                          <span>· فاتورة #{inv.id.slice(0, 8)}</span>
                        )}
                        {zone && <span>· منطقة: {zone.name}</span>}
                      </div>
                    </div>

                    {/* COD Amount */}
                    <div className="text-left bg-white/5 border border-white/10 rounded-2xl px-3 py-2 shrink-0">
                      <span className="text-[10px] text-slate-400 block font-medium">التحصيل المطلـوب</span>
                      <span className="text-base font-black text-emerald-400 font-mono">
                        {money(cod)} <span className="text-[11px]">ج.م</span>
                      </span>
                    </div>
                  </div>

                  {/* Delivery Address */}
                  {s.deliveryAddress && (
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-start justify-between gap-2 text-xs text-slate-300">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{s.deliveryAddress}</span>
                      </div>
                      <a
                        href={getMapsUrl(s.deliveryAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 shrink-0 self-center bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20"
                      >
                        <Navigation className="h-3 w-3" />
                        الخريطة
                      </a>
                    </div>
                  )}

                  {/* Status Reason / Note if any */}
                  {s.notes && (
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{s.notes}</span>
                    </div>
                  )}

                  {/* Driver Quick Communication Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {s.recipientPhone ? (
                      <a
                        href={`tel:${s.recipientPhone}`}
                        className="h-10 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        اتصال بالعميل
                      </a>
                    ) : (
                      <Button disabled variant="outline" className="h-10 text-xs">
                        لا يوجد هاتف
                      </Button>
                    )}

                    <Button
                      type="button"
                      onClick={() => openWhatsApp(s)}
                      className="h-10 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] text-xs font-black gap-1.5"
                    >
                      <MessageSquare className="h-3.5 w-3.5 fill-current" />
                      إشعار واتساب
                    </Button>
                  </div>

                  {/* Delivery Action Triggers (When Not Delivered) */}
                  {!isDelivered && (
                    <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                      <Button
                        type="button"
                        onClick={() => {
                          setDeliverModalShipment(s);
                          setCollectedAmount(String(cod));
                        }}
                        className="flex-1 h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs shadow-lg shadow-emerald-500/20 gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        تم التسليم والتحصيل ({money(cod)} ج.م)
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setFailModalShipment(s);
                          setFailReason(QUICK_FAIL_REASONS[0]);
                        }}
                        className="h-11 px-3.5 rounded-2xl border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-bold text-xs gap-1.5"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        تعذر التسليم
                      </Button>
                    </div>
                  )}

                  {/* Reset back to active if delivered or returned */}
                  {(isDelivered || isFailed) && (
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>تاريخ التحديث: {new Date(s.createdAt).toLocaleDateString("ar-EG")}</span>
                      <button
                        type="button"
                        onClick={() => void updateShipmentStatus(s.id, "shipped", "إعادة المحاولة مع المندوب")}
                        className="text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" /> إعادة للتشغيل
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Confirm Delivery Modal */}
      {deliverModalShipment && (
        <Dialog open={Boolean(deliverModalShipment)} onOpenChange={(open) => !open && setDeliverModalShipment(null)}>
          <DialogContent dir="rtl" className="max-w-md bg-[#121c18] border-white/15 text-white rounded-3xl p-6">
            <DialogHeader>
              <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <DialogTitle className="text-lg font-black text-center text-white">
                تأكيد تسليم الشحنة وتحصيل المبلغ
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-slate-400">
                العميل: {deliverModalShipment.recipientName} · رقم: #{deliverModalShipment.trackingNumber || deliverModalShipment.id.slice(0, 8)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <span className="text-xs text-emerald-300 block font-bold">المبلغ المستلم نقداً (COD)</span>
                <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
                  {money(Number(deliverModalShipment.codAmount || deliverModalShipment.shippingCost || 0))} ج.م
                </span>
              </div>

              <div>
                <Label className="text-xs text-slate-300 font-bold mb-1.5 block">ملاحظات التسليم (اختياري)</Label>
                <Input
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="مثال: تم الاستلام بواسطة الحارس، أو دفع فودافون كاش..."
                  className="h-10 text-xs bg-white/5 border-white/10 text-white rounded-xl"
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeliverModalShipment(null)}
                className="w-full sm:w-auto text-xs rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDelivered}
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl shadow-lg shadow-emerald-500/25"
              >
                تأكيد التسليم فوراً
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Fail / Reschedule Modal */}
      {failModalShipment && (
        <Dialog open={Boolean(failModalShipment)} onOpenChange={(open) => !open && setFailModalShipment(null)}>
          <DialogContent dir="rtl" className="max-w-md bg-[#181113] border-rose-500/30 text-white rounded-3xl p-6">
            <DialogHeader>
              <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-2">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <DialogTitle className="text-lg font-black text-center text-white">
                تسجيل تعذر التسليم أو طلب التأجيل
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-slate-400">
                اختر سبب عدم الاستلام ليتم حفظه وإشعار خدمة العملاء والعميل
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs text-slate-300 font-bold mb-2 block">سبب تعذر الاستلام:</Label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_FAIL_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFailReason(r)}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                        failReason === r
                          ? "bg-rose-500/25 text-rose-300 border-rose-500/50 font-bold"
                          : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-300 font-bold mb-1.5 block">تفاصيل إضافية</Label>
                <Input
                  value={customFailNote}
                  onChange={(e) => setCustomFailNote(e.target.value)}
                  placeholder="مثال: طلب التوصيل بعد الساعة 6 مساءً..."
                  className="h-10 text-xs bg-white/5 border-white/10 text-white rounded-xl"
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFailModalShipment(null)}
                className="w-full sm:w-auto text-xs rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleConfirmFailed}
                className="w-full sm:w-auto bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-600/25"
              >
                حفظ وإشعار
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* WhatsApp Template Modal */}
      {whatsAppModalOpen && whatsAppShipment && (
        <WhatsAppTemplateModal
          open={whatsAppModalOpen}
          onClose={() => {
            setWhatsAppModalOpen(false);
            setWhatsAppShipment(null);
          }}
          initialTemplate={
            whatsAppShipment.status === "shipped" || whatsAppShipment.status === "pending"
              ? "out_for_delivery"
              : whatsAppShipment.status === "delivered"
              ? "delivered"
              : "rescue_reschedule"
          }
          data={{
            customerName: whatsAppShipment.recipientName || undefined,
            customerPhone: whatsAppShipment.recipientPhone || undefined,
            orderNumber: whatsAppShipment.trackingNumber || whatsAppShipment.id.slice(0, 8),
            address: whatsAppShipment.deliveryAddress || undefined,
            total: Number(whatsAppShipment.codAmount || whatsAppShipment.shippingCost || 0),
            carrierName: activeCarrier?.name || carrierMap.get(whatsAppShipment.carrierId ?? "")?.name || "مندوب التوصيل",
            carrierPhone: activeCarrier?.phone || carrierMap.get(whatsAppShipment.carrierId ?? "")?.phone || undefined,
          }}
        />
      )}
    </main>
  );
}
