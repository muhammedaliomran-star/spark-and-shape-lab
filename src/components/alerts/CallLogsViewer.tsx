import { CollectionCallLog } from "@/lib/collection-store";
import { Customer, fmt } from "@/lib/store";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { PhoneCall, Calendar, MessageSquare, Clock, User, CheckCircle2 } from "lucide-react";
import { Link } from "@/lib/router-compat";

interface CallLogsViewerProps {
  logs: CollectionCallLog[];
  customers: Customer[];
}

export function CallLogsViewer({ logs, customers }: CallLogsViewerProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-16 bg-card border rounded-2xl p-6">
        <PhoneCall className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
        <div className="text-base font-bold">لا توجد متابعات هاتفية مسجلة بعد</div>
        <div className="text-xs text-muted-foreground mt-1">
          عند الاتصال بالعميل وتسجيل نتيجة المكالمة من زر "تسجيل مكالمة / وعد"، ستظهر جميع المتابعات هنا مرتبة زمنياً.
        </div>
      </div>
    );
  }

  const findCustomer = (id: string) => customers.find((c) => c.id === id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-bold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          سجل المتابعات والاتصالات الأخيرة ({logs.length})
        </div>
        <div className="text-xs text-muted-foreground">آخر 200 متابعة هاتفية</div>
      </div>

      <div className="grid gap-2.5">
        {logs.map((log) => {
          const customer = findCustomer(log.customerId);
          const dateStr = format(new Date(log.date), "yyyy/MM/dd - hh:mm a");

          return (
            <div
              key={log.id}
              className="bg-card border rounded-xl p-4 flex items-start justify-between gap-4 flex-wrap hover:border-primary/40 transition-colors"
            >
              <div className="space-y-1.5 text-right flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-foreground">
                    {customer ? (
                      <Link to={`/customers?id=${customer.id}`} className="hover:text-primary hover:underline">
                        {customer.name}
                      </Link>
                    ) : (
                      "عميل غير محدد"
                    )}
                  </span>
                  {customer?.phone && (
                    <span dir="ltr" className="text-xs font-mono text-muted-foreground">
                      ({customer.phone})
                    </span>
                  )}
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted border font-semibold">
                    {log.outcomeLabel}
                  </span>
                </div>

                {log.notes && (
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border leading-relaxed">
                    💬 {log.notes}
                  </p>
                )}

                {log.promisedDate && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      وعد بالسداد بتاريخ: <b>{log.promisedDate}</b>
                      {log.promisedAmount ? ` بمبلغ ${fmt(log.promisedAmount)} ج.م` : ""}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-left text-xs text-muted-foreground shrink-0">
                <div>{dateStr}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
