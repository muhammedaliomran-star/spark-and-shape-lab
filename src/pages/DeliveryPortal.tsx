import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { db, Shipment, ShipmentCarrier, useDB } from "@/lib/store";
import { waLink, renderShipmentOutForDelivery } from "@/lib/whatsapp-templates";
import { toast } from "sonner";
import {
  Truck,
  Phone,
  MessageSquare,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Search,
  RotateCcw,
  Clock,
  Scan,
  ShieldCheck,
  ChevronLeft,
  DollarSign,
  Package,
} from "lucide-react";

export default function DeliveryPortal() {
  const { shipments, carriers, refresh } = useDB();
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "delivered" | "failed">("all");

  // Postpone/Fail Modal State
  const [postponeModalOpen, setPostponeModalOpen] = useState(false);
  const [targetShipment, setTargetShipment] = useState<Shipment | null>(null);
  const [failReason, setFailReason] = useState("العميل طلب تأجيل الموعد");
  const [failNotes, setFailNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  // Check URL query param for carrier
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const cId = params.get("carrier");
      if (cId) {
        setSelectedCarrierId(cId);
      } else if (carriers.length > 0 && !selectedCarrierId) {
        setSelectedCarrierId(carriers[0].id);
      }
    }
  }, [carriers]);

  const currentCarrier = useMemo(() => {
    return carriers.find((c) => c.id === selectedCarrierId) || carriers[0];
  }, [carriers, selectedCarrierId]);

  const carrierShipments = useMemo(() => {
    if (!currentCarrier) return [];
    let list = shipments.filter((s) => s.carrierId === currentCarrier.id);

    if (statusFilter === "pending") {
      list = list.filter((s) => ["pending", "processing", "shipped"].includes(s.status));
    } else if (statusFilter === "delivered") {
      list = list.filter((s) => s.status === "delivered");
    } else if (statusFilter === "failed") {
      list = list.filter((s) => ["returned", "cancelled"].includes(s.status));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          (s.trackingNumber && s.trackingNumber.toLowerCase().includes(q)) ||
          (s.recipientName && s.recipientName.toLowerCase().includes(q)) ||
          (s.recipientPhone && s.recipientPhone.includes(q)) ||
          (s.deliveryAddress && s.deliveryAddress.toLowerCase().includes(q))
      );
    }

    return list;
  }, [shipments, currentCarrier, statusFilter, searchQuery]);

  // Daily Metrics for the delivery agent
  const metrics = useMemo(() => {
    if (!currentCarrier) return { total: 0, delivered: 0, remaining: 0, totalCod: 0, collectedCod: 0 };
    const all = shipments.filter((s) => s.carrierId === currentCarrier.id);
    const del = all.filter((s) => s.status === "delivered");
    const rem = all.filter((s) => ["pending", "processing", "shipped"].includes(s.status));
    const totalCod = all.reduce((sum, s) => sum + (s.codAmount || 0), 0);
    const collectedCod = del.reduce((sum, s) => sum + (s.codAmount || 0), 0);

    return {
      total: all.length,
      delivered: del.length,
      remaining: rem.length,
      totalCod,
      collectedCod,
    };
  }, [shipments, currentCarrier]);

  const handleMarkDelivered = async (shipment: Shipment) => {
    try {
      await db.updateShipmentStatus(shipment.id, "delivered", "تم التسليم بنجاح عبر بوابة المندوب");
      toast.success(`✅ تم تأكيد تسليم الشحنة وتحصيل ${shipment.codAmount || 0} ج.م`);
      await refresh();
    } catch (err: any) {
      toast.error(err.message || "تعذر تحديث حالة الشحنة");
    }
  };

  const handleOpenFailModal = (shipment: Shipment) => {
    setTargetShipment(shipment);
    setFailReason("العميل طلب تأجيل الموعد");
    setFailNotes("");
    setPostponeModalOpen(true);
  };

  const handleConfirmFail = async () => {
    if (!targetShipment) return;
    setUpdating(true);
    try {
      const fullNote = `${failReason}${failNotes ? ` — ${failNotes}` : ""} (مسجل من المندوب)`;
      await db.updateShipmentStatus(targetShipment.id, "returned", fullNote);
      toast.info(`⚠️ تم تسجيل تعذر التسليم: ${failReason}`);
      setPostponeModalOpen(false);
      await refresh();
    } catch (err: any) {
      toast.error(err.message || "تعذر تسجيل الحالة");
    } finally {
      setUpdating(false);
    }
  };

  const openGoogleMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  };

  const sendWhatsApp = (s: Shipment) => {
    if (!s.recipientPhone) {
      toast.error("رقم هاتف العميل غير متوفر");
      return;
    }
    const text = `مرحباً ${s.recipientName || "عميلنا العزيز"} 🚚
معك مندوب التوصيل بخصوص شحنتك رقم *${s.trackingNumber || s.id.slice(0, 8)}*.
المبلغ المطلوب عند الاستلام: *${s.codAmount || 0} ج.م*

أنا في طريقي إليك، هل العنوان (${s.deliveryAddress || "-"}) مناسب الآن؟`;
    window.open(waLink(s.recipientPhone, text, { arabicDigits: false }), "_blank");
  };

  if (!currentCarrier) {
    return (
      <div className="min-h-screen bg-muted/20 p-6 flex items-center justify-center" dir="rtl">
        <BezelCard className="p-8 text-center max-w-md">
          <Truck className="h-12 w-12 text-primary mx-auto mb-3" />
          <h2 className="text-xl font-bold">بوابة مندوب التوصيل</h2>
          <p className="text-sm text-muted-foreground mt-2">
            لا توجد بيانات مندوب حالياً. يرجى التأكد من اختيار المندوب الصحيح من القائمة.
          </p>
        </BezelCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20" dir="rtl">
      {/* Mobile-Friendly Sticky Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b p-3 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-foreground">بوابة المندوب</h1>
              <p className="text-[11px] text-muted-foreground">
                كابتن: <strong className="text-foreground">{currentCarrier.name}</strong>
              </p>
            </div>
          </div>

          <div className="w-44">
            <Select value={selectedCarrierId} onValueChange={setSelectedCarrierId}>
              <SelectTrigger className="h-8 text-xs font-bold bg-muted/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {carriers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-3 sm:p-4 space-y-4">
        {/* Daily KPI Dashboard */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-card border text-center shadow-xs">
            <span className="text-[11px] text-muted-foreground">شحنات اليوم</span>
            <p className="text-xl font-black text-primary mt-0.5">{metrics.total}</p>
          </div>

          <div className="p-3 rounded-xl bg-card border text-center shadow-xs">
            <span className="text-[11px] text-muted-foreground">تم تسليمها ✅</span>
            <p className="text-xl font-black text-emerald-600 mt-0.5">{metrics.delivered}</p>
          </div>

          <div className="p-3 rounded-xl bg-card border text-center shadow-xs">
            <span className="text-[11px] text-muted-foreground">المتبقي ⏳</span>
            <p className="text-xl font-black text-amber-500 mt-0.5">{metrics.remaining}</p>
          </div>
        </div>

        {/* Total Cash Collected Card */}
        <div className="p-3.5 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-600 text-white">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground">إجمالي كاش التحصيل اليوم:</span>
              <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                {metrics.collectedCod.toLocaleString("ar-EG")}{" "}
                <span className="text-xs font-normal">/ {metrics.totalCod.toLocaleString("ar-EG")} ج.م</span>
              </p>
            </div>
          </div>
          <Badge className="bg-emerald-600 text-white text-[10px]">
            {metrics.total > 0 ? Math.round((metrics.delivered / metrics.total) * 100) : 0}% منجز
          </Badge>
        </div>

        {/* Search & Status Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، رقم الموبايل، أو كود التتبع..."
              className="pr-9 h-10 text-sm bg-card"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                statusFilter === "all" ? "bg-primary text-primary-foreground" : "bg-card border text-muted-foreground"
              }`}
            >
              الكل ({shipments.filter((s) => s.carrierId === currentCarrier.id).length})
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                statusFilter === "pending"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border text-muted-foreground"
              }`}
            >
              المتبقي للتوصيل ({metrics.remaining})
            </button>
            <button
              onClick={() => setStatusFilter("delivered")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                statusFilter === "delivered"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border text-muted-foreground"
              }`}
            >
              المسلّم ({metrics.delivered})
            </button>
            <button
              onClick={() => setStatusFilter("failed")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                statusFilter === "failed"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border text-muted-foreground"
              }`}
            >
              تعذر / مرتجع
            </button>
          </div>
        </div>

        {/* Shipments Action Cards List */}
        <div className="space-y-3">
          {carrierShipments.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="font-bold text-sm">لا توجد شحنات مطابقة</p>
              <p className="text-xs mt-1">تفقد فلاتر البحث أو حدد مندوباً آخر.</p>
            </div>
          ) : (
            carrierShipments.map((s) => (
              <div
                key={s.id}
                className={`p-4 rounded-xl border bg-card shadow-xs space-y-3 transition-all ${
                  s.status === "delivered"
                    ? "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10"
                    : s.status === "returned"
                    ? "border-rose-500/30 bg-rose-50/30 dark:bg-rose-950/10"
                    : "hover:border-primary/40"
                }`}
              >
                {/* Header & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-primary">
                        #{s.trackingNumber || s.id.slice(0, 8)}
                      </span>
                      <Badge
                        variant={
                          s.status === "delivered"
                            ? "default"
                            : s.status === "returned"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {s.status === "delivered"
                          ? "تم التسليم ✅"
                          : s.status === "returned"
                          ? "تعذر / مرتجع ❌"
                          : "جاري التوصيل 🚚"}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-base text-foreground mt-1">{s.recipientName || "عميل"}</h3>
                  </div>

                  <div className="text-left">
                    <span className="text-[11px] text-muted-foreground block">مبلغ التحصيل (COD)</span>
                    <span className="text-lg font-black text-emerald-600">{s.codAmount || 0} ج.م</span>
                  </div>
                </div>

                {/* Address & Quick Map */}
                <div className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-muted/40 text-xs">
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{s.deliveryAddress || "العنوان غير محدد"}</span>
                  </div>
                  {s.deliveryAddress && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs font-bold text-primary shrink-0 hover:bg-primary/10 gap-1"
                      onClick={() => openGoogleMaps(s.deliveryAddress!)}
                    >
                      خريطة
                    </Button>
                  )}
                </div>

                {/* Notes if any */}
                {s.notes && (
                  <p className="text-xs bg-amber-500/10 text-amber-800 dark:text-amber-300 p-2 rounded border border-amber-500/20">
                    ملاحظة: {s.notes}
                  </p>
                )}

                {/* Communication & Main Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {s.recipientPhone ? (
                    <a
                      href={`tel:${s.recipientPhone}`}
                      className="flex items-center justify-center gap-1.5 h-10 rounded-lg border bg-background font-bold text-xs hover:bg-muted transition-all"
                    >
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      اتصال ({s.recipientPhone})
                    </a>
                  ) : (
                    <div className="flex items-center justify-center h-10 rounded-lg border bg-muted/20 text-xs text-muted-foreground">
                      بدون هاتف
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 text-xs font-bold gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    onClick={() => sendWhatsApp(s)}
                    disabled={!s.recipientPhone}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    واتساب العميل
                  </Button>
                </div>

                {/* Status Decision Buttons (Only if pending) */}
                {s.status !== "delivered" && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                    <Button
                      type="button"
                      className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm gap-2"
                      onClick={() => handleMarkDelivered(s)}
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      تم التسليم وتحصيل {s.codAmount || 0} ج.م
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      className="h-12 font-bold text-xs gap-1.5"
                      onClick={() => handleOpenFailModal(s)}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      تعذر التسليم / تأجيل
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* Fail / Postpone Modal */}
      <Dialog open={postponeModalOpen} onOpenChange={setPostponeModalOpen}>
        <DialogContent className="max-w-md p-5" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تسجيل تعذر التسليم أو التأجيل
            </DialogTitle>
            <DialogDescription>
              حدد سبب تعذر تسليم الشحنة للعميل ({targetShipment?.recipientName}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <span className="text-xs font-bold">اختر السبب:</span>
              <div className="space-y-1.5">
                {[
                  "العميل طلب تأجيل الموعد ليوم آخر",
                  "العميل مغلق ولا يرد على الهاتف",
                  "العميل رفض الاستلام ودفع القيمة",
                  "العنوان غير صحيح أو خارج نطاق التوصيل",
                  "العميل غير متواجد في العنوان",
                ].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFailReason(r)}
                    className={`w-full text-right p-2.5 rounded-lg border text-xs transition-all ${
                      failReason === r
                        ? "border-destructive bg-destructive/10 font-bold text-destructive"
                        : "bg-card hover:bg-muted"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold">ملاحظات إضافية من المندوب:</span>
              <Input
                value={failNotes}
                onChange={(e) => setFailNotes(e.target.value)}
                placeholder="تفاصيل إضافية..."
                className="text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setPostponeModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmFail}
              disabled={updating}
              className="font-bold gap-1.5"
            >
              {updating ? "جاري الحفظ..." : "تأكيد تسجيل السبب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
