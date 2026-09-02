import { useMemo, useState } from "react";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/store";
import type { AuditRunRecord } from "@/lib/reconciliation-engine";
import { History, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Props {
  runs: AuditRunRecord[];
  currentScore: number;
  onDelete: (id: string) => void;
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "يدوي",
  auto: "تلقائي",
  after_fix: "بعد إصلاح",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

export function AuditRunsHistory({ runs, currentScore, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);

  const chartData = useMemo(
    () =>
      [...runs]
        .reverse()
        .map((r) => ({
          label: formatDate(r.createdAt),
          score: r.healthScore,
          critical: r.criticalCount,
          findings: r.findingsCount,
          discrepancy: r.totalDiscrepancy,
        })),
    [runs]
  );

  const previous = runs[0];
  const delta = previous ? currentScore - previous.healthScore : 0;
  const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const deltaTone =
    delta > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : delta < 0
        ? "text-rose-600 dark:text-rose-400"
        : "text-muted-foreground";

  const best = runs.length ? Math.max(...runs.map((r) => r.healthScore)) : currentScore;
  const worst = runs.length ? Math.min(...runs.map((r) => r.healthScore)) : currentScore;

  return (
    <BezelCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold">سجل جولات التدقيق</h3>
            <p className="text-[11px] text-muted-foreground">
              تتبع درجة الصحة المحاسبية عبر الزمن — آخر {runs.length} جولة
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {previous && (
            <div className={`flex items-center gap-1 text-xs font-semibold ${deltaTone}`}>
              <DeltaIcon className="h-4 w-4" />
              <span>
                {delta === 0 ? "بدون تغيير" : `${delta > 0 ? "+" : ""}${delta}% عن آخر جولة`}
              </span>
            </div>
          )}
          <Badge variant="outline" className="text-[10px]">أعلى {best}%</Badge>
          <Badge variant="outline" className="text-[10px]">أدنى {worst}%</Badge>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-8"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}
          </Button>
        </div>
      </div>

      {runs.length < 2 ? (
        <p className="text-xs text-muted-foreground mt-4 text-center py-4 border border-dashed border-border/60 rounded-xl">
          {runs.length === 0
            ? "لم تُسجَّل أي جولة بعد — اضغط «إعادة التدقيق» لحفظ أول لقطة."
            : "سجّلت جولة واحدة فقط؛ المنحنى يظهر بعد الجولة الثانية."}
        </p>
      ) : (
        <div className="h-44 mt-4" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="reconScoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                  direction: "rtl",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "score") return [`${value}%`, "درجة الصحة"];
                  if (name === "critical") return [value, "أخطاء حرجة"];
                  if (name === "findings") return [value, "إجمالي الملاحظات"];
                  return [`${fmt(value)} ج.م`, "إجمالي الفروق"];
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#reconScoreGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {expanded && runs.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border/60">
                <th className="text-right py-2 font-semibold">التاريخ</th>
                <th className="text-center py-2 font-semibold">الصحة</th>
                <th className="text-center py-2 font-semibold">حرج</th>
                <th className="text-center py-2 font-semibold">تحذير</th>
                <th className="text-center py-2 font-semibold">تنبيه</th>
                <th className="text-center py-2 font-semibold">الفروق (ج.م)</th>
                <th className="text-center py-2 font-semibold">المصدر</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="py-2 text-center font-bold">{r.healthScore}%</td>
                  <td className="py-2 text-center text-rose-600 dark:text-rose-400">{r.criticalCount}</td>
                  <td className="py-2 text-center text-amber-600 dark:text-amber-400">{r.warningCount}</td>
                  <td className="py-2 text-center text-sky-600 dark:text-sky-400">{r.noticeCount}</td>
                  <td className="py-2 text-center">{fmt(r.totalDiscrepancy)}</td>
                  <td className="py-2 text-center">
                    <Badge variant="secondary" className="text-[10px]">
                      {SOURCE_LABEL[r.triggerSource] ?? r.triggerSource}
                    </Badge>
                  </td>
                  <td className="py-2 text-left">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(r.id)}
                      aria-label="حذف الجولة"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BezelCard>
  );
}
