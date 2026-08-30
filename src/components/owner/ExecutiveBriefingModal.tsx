import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmt } from "@/lib/store";
import { waLink } from "@/lib/whatsapp-templates";
import { toast } from "sonner";
import {
  MessageSquare,
  Copy,
  Check,
  Send,
  Sparkles,
  PhoneCall,
  Crown,
} from "lucide-react";

interface ExecutiveBriefingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: {
    totalSales: number;
    totalCashCollected: number;
    totalExpenses: number;
    grossProfit: number;
    netProfit: number;
    profitMargin: number;
    totalReceivables: number;
  };
  invoiceCount: number;
  overdueCount: number;
  overdueAmount: number;
  dueTodayCount: number;
  dueTodayAmount: number;
  topItemName?: string;
  lowStockCount: number;
  shopName: string;
}

export function ExecutiveBriefingModal({
  open,
  onOpenChange,
  stats,
  invoiceCount,
  overdueCount,
  overdueAmount,
  dueTodayCount,
  dueTodayAmount,
  topItemName,
  lowStockCount,
  shopName,
}: ExecutiveBriefingModalProps) {
  const [copied, setCopied] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState("");

  const todayDateStr = new Date().toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const generateReportText = () => {
    return `👑 *تقرير المالك اليومي — ${shopName}*
📅 التاريخ: ${todayDateStr}

━━━━━━━━━━━━━━━━━━━━━
💼 *المؤشرات المالية الرئيسية اليوم:*
💰 السيولة المحصلة كاش: *${fmt(stats.totalCashCollected)} ج.م*
📈 صافي الأرباح المحققة: *${fmt(stats.netProfit)} ج.م* (${stats.profitMargin}%)
🧾 إجمالي مبيعات اليوم: *${fmt(stats.totalSales)} ج.م* (عدد ${invoiceCount} فواتير)
💸 إجمالي المصروفات: *${fmt(stats.totalExpenses)} ج.م*

━━━━━━━━━━━━━━━━━━━━━
🎯 *التحصيل ورادار الأقساط:*
⏰ أقساط مستحقة اليوم: *${dueTodayCount} قسط* بإجمالي *${fmt(dueTodayAmount)} ج.م*
⚠️ عملاء متأخرين عن السداد: *${overdueCount} عميل* بإجمالي متأخرات *${fmt(overdueAmount)} ج.م*
👥 إجمالي ديون المحل في السوق: *${fmt(stats.totalReceivables)} ج.م*

━━━━━━━━━━━━━━━━━━━━━
📦 *المخزن والأصناف:*
⭐ الصنف الأكثر ربحية: *${topItemName || "مستقر"}*
🚨 أصناف قاربت على النفاد: *${lowStockCount} أصناف*

━━━━━━━━━━━━━━━━━━━━━
🔒 تم استخراج التقرير آلياً عبر نظام *سِجلّي Boss* الإداري.`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateReportText());
    setCopied(true);
    toast.success("تم نسخ التقرير التنفيذي بنجاح! جاهز للصق على واتساب 📋");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const text = generateReportText();
    const url = waLink(ownerPhone.trim(), text);
    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-6">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-foreground">
            <Crown className="h-6 w-6 text-warning" />
            <span>الملخص الذكي للمالك (Daily Executive Briefing)</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            ملخص نصي فوري وشامل لنبض المحل اليومي مجهز للإرسال المباشر على واتساب أو التليجرام.
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Target Phone Input */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                رقم هاتف المالك (اختياري للإرسال السريع)
              </label>
              <input
                type="tel"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="010XXXXXXXX أو 011..."
                className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40 text-left placeholder:text-right"
              />
            </div>

            <div className="flex items-end gap-2 w-full sm:w-auto pt-4 sm:pt-0">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="flex-1 sm:flex-none h-10 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition"
              >
                <Send className="h-4 w-4" />
                <span>إرسال عبر واتساب</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="h-10 flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-bold text-foreground hover:bg-muted transition"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? "تم النسخ" : "نسخ النص"}</span>
              </button>
            </div>
          </div>

          {/* Report Preview Box */}
          <div className="relative rounded-2xl border border-border/80 bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-72 overflow-y-auto selection:bg-primary/20">
            {generateReportText()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
