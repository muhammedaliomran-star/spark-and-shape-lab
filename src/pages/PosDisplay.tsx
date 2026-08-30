import { useEffect, useState } from "react";
import {
  CustomerDisplayState,
  getCustomerDisplayState,
  subscribeCustomerDisplay,
} from "@/lib/customer-display";
import { fmt } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  Store,
  Clock,
  QrCode,
  Tag,
  Receipt,
  HeartHandshake,
} from "lucide-react";
import { format } from "date-fns";

export default function PosDisplayPage() {
  const [state, setState] = useState<CustomerDisplayState>(getCustomerDisplayState());
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const unsub = subscribeCustomerDisplay((newState) => {
      setState(newState);
    });
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between select-none overflow-hidden"
      dir="rtl"
    >
      {/* Top Header Bar */}
      <header className="p-4 sm:p-6 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              {state.shopName || "سِجلّي"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">شاشة عرض العميل — مرحباً بكم</p>
          </div>
        </div>

        <div className="text-left font-mono">
          <div className="text-xl sm:text-2xl font-black text-slate-200">
            {format(time, "hh:mm:ss a")}
          </div>
          <div className="text-xs text-slate-400">{format(time, "dd MMMM yyyy")}</div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 flex flex-col justify-center max-w-7xl w-full mx-auto">
        <AnimatePresence mode="wait">
          {state.status === "completed" ? (
            /* Thank you & Success Screen */
            <motion.div
              key="completed"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="text-center space-y-6 py-12"
            >
              <div className="inline-flex p-6 rounded-full bg-emerald-500/20 text-emerald-400 ring-8 ring-emerald-500/10 shadow-2xl animate-bounce">
                <CheckCircle2 className="h-16 w-16" />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl sm:text-4xl font-black text-white">
                  شكراً لزيارتكم! تم الدفع بنجاح
                </h2>
                {state.completedInvoiceCode && (
                  <div className="text-sm font-mono text-slate-400">
                    رقم الفاتورة: <span className="text-emerald-400 font-bold">{state.completedInvoiceCode}</span>
                  </div>
                )}
              </div>

              <div className="max-w-md mx-auto p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-3">
                <div className="flex justify-between items-center text-sm text-slate-400">
                  <span>المبلغ المدفوع</span>
                  <span className="font-mono text-xl font-bold text-white">
                    {fmt(state.paidAmount || state.total)} ج.م
                  </span>
                </div>
                {(state.changeDue ?? 0) > 0 && (
                  <div className="flex justify-between items-center text-sm text-emerald-400 font-bold border-t border-slate-800 pt-3">
                    <span>الباقي (الفكة)</span>
                    <span className="font-mono text-2xl">{fmt(state.changeDue ?? 0)} ج.م</span>
                  </div>
                )}
              </div>

              <p className="text-slate-400 text-sm flex items-center justify-center gap-1.5 font-medium">
                <HeartHandshake className="h-5 w-5 text-rose-400" />
                سعدنا بخدمتكم ونتمنى لكم يوماً سعيداً!
              </p>
            </motion.div>
          ) : state.items.length === 0 ? (
            /* Idle Screen */
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6 py-16"
            >
              <div className="inline-flex p-8 rounded-3xl bg-slate-900/80 border border-slate-800 text-primary shadow-2xl">
                <ShoppingBag className="h-16 w-16 stroke-[1.5]" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  أهلاً بك في {state.shopName || "المتجر"}
                </h2>
                <p className="text-slate-400 text-sm">
                  سيتم عرض مشترياتك وتفاصيل الحساب هنا لحظة بلحظة...
                </p>
              </div>
            </motion.div>
          ) : (
            /* Active Cart Items Breakdown */
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              {/* Left Column: Cart items table */}
              <div className="lg:col-span-7 bg-slate-900/90 rounded-3xl border border-slate-800 p-5 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <div className="font-bold text-slate-300 flex items-center gap-2 text-sm">
                    <Receipt className="h-4 w-4 text-primary" />
                    <span>قائمة المشتريات ({state.items.length} صنف)</span>
                  </div>
                  {state.customerName && (
                    <span className="text-xs bg-primary/20 text-primary-foreground px-2.5 py-1 rounded-xl font-bold">
                      العميل: {state.customerName}
                    </span>
                  )}
                </div>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {state.items.map((it, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-white text-base">{it.name}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          {fmt(it.price)} ج.م × {it.quantity}
                        </div>
                      </div>

                      <div className="text-left font-mono font-black text-lg text-emerald-400">
                        {fmt(it.total)} <span className="text-xs text-slate-400">ج.م</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Right Column: Grand Total Card */}
              <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm text-slate-400">
                    <span>المجموع الفرعي:</span>
                    <span className="font-mono text-base font-bold text-slate-200">
                      {fmt(state.subtotal)} ج.م
                    </span>
                  </div>

                  {state.discountAmount > 0 && (
                    <div className="flex justify-between items-center text-sm text-rose-400 font-bold bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                      <span className="flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" /> الخصم:
                      </span>
                      <span className="font-mono text-base">- {fmt(state.discountAmount)} ج.م</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-800 pt-5 space-y-2">
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    المبلغ الإجمالي المطلوب
                  </div>
                  <div className="text-4xl sm:text-5xl font-black text-emerald-400 font-mono tracking-tight">
                    {fmt(state.total)}{" "}
                    <span className="text-lg sm:text-xl font-bold text-slate-400">ج.م</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-center text-xs text-slate-400 space-y-1">
                  <div className="font-bold text-slate-300">طرق الدفع المتاحة</div>
                  <div>نقد كاش • إنستاباي • محافظ إلكترونية • فيزا / ماستركارد</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="p-4 bg-slate-900/60 border-t border-slate-800/80 text-center text-xs text-slate-500">
        نظام سِجلّي الذكي لإدارة نقاط البيع والمحلات • شكراً لثقتكم بنا
      </footer>
    </div>
  );
}
