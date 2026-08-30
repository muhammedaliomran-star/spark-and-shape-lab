import React, { useState, useEffect } from "react";
import { fmt, invoiceNumber } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  DollarSign,
  FileText,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Check,
  X,
} from "lucide-react";

export interface ApprovalRequest {
  id: string;
  type: "discount" | "cancel_invoice" | "large_expense" | "special_return";
  title: string;
  requestedBy: string;
  amount: number;
  reason: string;
  details: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  actionAt?: string;
  actionNote?: string;
}

const LOCAL_STORAGE_APPROVALS_KEY = "segilly_owner_approvals_v1";

const INITIAL_REQUESTS: ApprovalRequest[] = [
  {
    id: "appr-1",
    type: "discount",
    title: "طلب خصم استثنائي 800 ج.م على فاتورة تقسيط",
    requestedBy: "أحمد إبراهيم (بائع)",
    amount: 800,
    reason: "عميل قديم اشترى 3 أجهزة ومعه كاش مقدم 50%",
    details: "فاتورة رقم INV-0042 — إجمالي الفاتورة: 24,000 ج.م",
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    status: "pending",
  },
  {
    id: "appr-2",
    type: "large_expense",
    title: "طلب صرف مصروف صيانة وتجديد تكييفات الصالة",
    requestedBy: "محمود حسن (مدير الفرع)",
    amount: 2400,
    reason: "صيانة دورية ضرورية للمكيفات مع تغيير فريون",
    details: "عرض أسعار مقدم من شركة الأمل للتبريد",
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    status: "pending",
  },
  {
    id: "appr-3",
    type: "special_return",
    title: "طلب قبول مرتجع بعد مرور 20 يوماً من الشراء",
    requestedBy: "كريم ممدوح (مسؤول خدمة العملاء)",
    amount: 1500,
    reason: "المنتج بحالته الأصلية تماماً بالكرتونة والعميل يرغب بالاستبدال بفئة أعلى",
    details: "صنف: شاشة سامسونج 32 بوصة سمارت",
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    status: "pending",
  },
];

export function OwnerApprovalsTab() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_APPROVALS_KEY);
      if (saved) {
        setRequests(JSON.parse(saved));
      } else {
        setRequests(INITIAL_REQUESTS);
        localStorage.setItem(LOCAL_STORAGE_APPROVALS_KEY, JSON.stringify(INITIAL_REQUESTS));
      }
    } catch (e) {
      console.error(e);
      setRequests(INITIAL_REQUESTS);
    }
  }, []);

  const saveRequests = (newRequests: ApprovalRequest[]) => {
    setRequests(newRequests);
    try {
      localStorage.setItem(LOCAL_STORAGE_APPROVALS_KEY, JSON.stringify(newRequests));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDecision = (id: string, decision: "approved" | "rejected") => {
    const note = actionNotes[id]?.trim() || (decision === "approved" ? "تمت الموافقة من المالك" : "تم الرفض من المالك");
    const updated = requests.map((req) => {
      if (req.id === id) {
        return {
          ...req,
          status: decision,
          actionAt: new Date().toISOString(),
          actionNote: note,
        };
      }
      return req;
    });

    saveRequests(updated);
    if (decision === "approved") {
      toast.success("تم اعتماد الطلب والموافقة عليه رسمياً ✅");
    } else {
      toast.error("تم رفض الطلب وإبلاغ البائع ❌");
    }
  };

  const handleCreateDemoRequest = () => {
    const newDemo: ApprovalRequest = {
      id: `appr-${Date.now()}`,
      type: "discount",
      title: `طلب خصم خاص بقيمة ${Math.floor(Math.random() * 500 + 200)} ج.م`,
      requestedBy: "أحمد إبراهيم (بائع الصالة)",
      amount: Math.floor(Math.random() * 500 + 200),
      reason: "تخفيض للعميل لإتمام صفقة بيع جهازين معاً كاش",
      details: `طلب فوري جديد — ${new Date().toLocaleTimeString("ar-EG")}`,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    saveRequests([newDemo, ...requests]);
    toast.info("تمت إضافة طلب موافقة تجريبي جديد للاختبار 🔔");
  };

  const filteredRequests = requests.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-warning/20 bg-warning/5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" />
              <span>نظام موافقات واعتمادات المالك (Owner Approvals Center)</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              الطلبات الإدارية الحساسة التي تتطلب إذن مباشر من صاحب المحل (خصومات كبيرة، إلغاءات، مرتجعات خاصة، ومصروفات كبرى).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateDemoRequest}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-primary hover:bg-muted transition"
            >
              <Sparkles className="h-4 w-4" />
              <span>طلب تجريبي جديد</span>
            </button>

            <div className="rounded-2xl border border-warning/30 bg-card px-4 py-2 text-center">
              <span className="text-[11px] text-muted-foreground">بانتظار موافقتك</span>
              <div className="text-lg font-black text-warning">{pendingCount} طلبات</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {[
          { id: "pending", label: "قيد الانتظار", count: pendingCount },
          { id: "approved", label: "تمت الموافقة", count: requests.filter((r) => r.status === "approved").length },
          { id: "rejected", label: "المرفوضة", count: requests.filter((r) => r.status === "rejected").length },
          { id: "all", label: "الكل", count: requests.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={cn(
              "flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all border",
              filter === tab.id
                ? "bg-foreground text-background border-foreground shadow-sm"
                : "bg-card/60 text-muted-foreground border-border/80 hover:text-foreground"
            )}
          >
            <span>{tab.label}</span>
            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-extrabold">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="rounded-3xl border border-border/80 bg-card/60 p-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h4 className="mt-4 text-base font-bold text-foreground">صندوق الطلبات فارغ</h4>
          <p className="mt-1 text-xs text-muted-foreground">لا توجد أي طلبات معلقة تتطلب موافقتك في هذا التصنيف.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredRequests.map((req) => {
            const isPending = req.status === "pending";

            return (
              <div
                key={req.id}
                className={cn(
                  "flex flex-col justify-between rounded-3xl border p-6 space-y-4 shadow-sm transition-all",
                  req.status === "pending"
                    ? "border-warning/40 bg-warning/5"
                    : req.status === "approved"
                    ? "border-emerald-500/30 bg-card/60"
                    : "border-border/60 bg-muted/20 opacity-75"
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[10px] font-black",
                            req.type === "discount"
                              ? "bg-primary/20 text-primary"
                              : req.type === "large_expense"
                              ? "bg-rose-500/20 text-rose-500"
                              : req.type === "special_return"
                              ? "bg-amber-500/20 text-amber-600"
                              : "bg-blue-500/20 text-blue-500"
                          )}
                        >
                          {req.type === "discount" && "طلب خصم"}
                          {req.type === "large_expense" && "مصروف كبير"}
                          {req.type === "special_return" && "مرتجع استثنائي"}
                          {req.type === "cancel_invoice" && "إلغاء فاتورة"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(req.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-foreground">{req.title}</h4>
                    </div>

                    <div className="text-left shrink-0">
                      <div className="text-base font-black text-foreground">{fmt(req.amount)} ج.م</div>
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold mt-1",
                          req.status === "pending"
                            ? "bg-warning text-black"
                            : req.status === "approved"
                            ? "bg-emerald-500 text-white"
                            : "bg-danger text-white"
                        )}
                      >
                        {req.status === "pending" ? "بانتظار القرار" : req.status === "approved" ? "معتمد" : "مرفوض"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/40 bg-card/80 p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>مقدم الطلب:</span>
                      <strong className="text-foreground">{req.requestedBy}</strong>
                    </div>
                    <div className="flex items-start justify-between text-muted-foreground">
                      <span>السبب والبيان:</span>
                      <span className="text-foreground font-semibold text-right max-w-[70%]">{req.reason}</span>
                    </div>
                    {req.details && (
                      <div className="border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
                        {req.details}
                      </div>
                    )}
                  </div>
                </div>

                {isPending ? (
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <input
                      type="text"
                      value={actionNotes[req.id] || ""}
                      onChange={(e) => setActionNotes({ ...actionNotes, [req.id]: e.target.value })}
                      placeholder="ملاحظة أو توجيه للبائع (اختياري)..."
                      className="w-full h-8 rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleDecision(req.id, "approved")}
                        className="flex items-center justify-center gap-1.5 h-9 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition"
                      >
                        <Check className="h-4 w-4" />
                        <span>موافقة واعتماد</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDecision(req.id, "rejected")}
                        className="flex items-center justify-center gap-1.5 h-9 rounded-xl bg-rose-600 text-xs font-bold text-white shadow-sm hover:bg-rose-500 transition"
                      >
                        <X className="h-4 w-4" />
                        <span>رفض الطلب</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground pt-1">
                    القرار: <strong>{req.actionNote || "تم اتخاذ القرار"}</strong> —{" "}
                    {req.actionAt && new Date(req.actionAt).toLocaleDateString("ar-EG")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
