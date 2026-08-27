import logoMark from "@/assets/logo-mark.png";
import { Link, useNavigate, useLocation } from "@/lib/router-compat";
import type { ReactNode } from "react";
import { LogOut, Undo2, Wallet, GitBranch, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, Users, FileText, Bell, Receipt, Truck, Package, BarChart3, Settings, CalendarDays, Warehouse, Store, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDB, lowStockCount, useShopSettings, isDueSoonOrOverdue } from "@/lib/store";
import { UserChip } from "@/components/UserChip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { applyTheme } from "@/lib/theme";
import { useEffect } from "react";

const nav = [
  { to: "/", label: "لوحة التحكم", icon: LayoutGrid },
  { to: "/daily", label: "اليومية", icon: CalendarDays },
  { to: "/customers", label: "العملاء", icon: Users },
  { to: "/invoices", label: "الفواتير", icon: FileText },
  { to: "/shipping", label: "الشحن", icon: Truck },
  { to: "/purchases", label: "المشتريات", icon: Truck },
  { to: "/suppliers", label: "الموردين", icon: Users },

  { to: "/inventory", label: "المنتجات", icon: Package },
  { to: "/warehouse", label: "المخزن", icon: Warehouse },
  { to: "/storefront", label: "المتجر الإلكتروني", icon: Store },
  { to: "/branches", label: "الفروع", icon: GitBranch },
  { to: "/returns", label: "المرتجعات", icon: Undo2 },
  { to: "/cashbox", label: "الصندوق", icon: Wallet },
  { to: "/payments", label: "الدفعات", icon: Banknote },
  { to: "/expenses", label: "المصروفات", icon: Receipt },
  { to: "/alerts", label: "المنبه", icon: Bell, alertKey: true as const },
  { to: "/reports", label: "التقارير", icon: BarChart3 },
  { to: "/reconciliation", label: "المطابقة", icon: ClipboardCheck },
  { to: "/settings", label: "الإعدادات", icon: Settings },
];

function dueOrOverdueCount(
  invoices: Array<{ firstDueDate: string; paid: number; total: number }>,
  daysBefore: number,
) {
  return invoices.filter((inv) => isDueSoonOrOverdue(inv, daysBefore)).length;
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { invoices, stockItems } = useDB();
  const { settings } = useShopSettings();
  useEffect(() => { applyTheme(settings.theme); }, [settings.theme]);
  const overdueCount = settings.alertsEnabled
    ? dueOrOverdueCount(invoices, settings.reminderDaysBefore) +
      lowStockCount(stockItems, settings.lowStockThreshold)
    : 0;
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/landing");
  };
  return (
    <div dir="rtl" className="relative min-h-screen text-foreground flex overflow-hidden selection:bg-primary selection:text-black">
      {/* Ambient background layer */}
      <div className="fixed inset-0 z-[-1] ambient-mesh opacity-80" />
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[17.5rem] shrink-0 flex-col gap-8 p-4 md:flex">
        <div className="glass flex h-full min-h-0 flex-col gap-6 overflow-hidden rounded-[1.75rem] p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <img src={logoMark} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
          </span>
          <div>
            <div className="text-display text-2xl font-bold leading-none text-foreground">سِجلّي</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/85">Segilly</div>
          </div>
        </div>
        <nav className="stagger no-scrollbar -mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1">
          {nav.map((n) => {
            const active = n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to);
            const Icon = n.icon;
            const showBadge = n.alertKey && overdueCount > 0;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "group relative flex items-center justify-between gap-2 rounded-full px-4 py-2.5 text-sm transition-[transform,box-shadow,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  active
                    ? "bg-primary font-semibold text-primary-foreground shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.45)]"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground hover:translate-x-[-3px] hover:shadow-[inset_0_0_0_1px_var(--hairline)]"
                )}
              >
                <span className="flex items-center gap-2">
                  {n.label}
                  {showBadge && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-danger text-danger-foreground text-[10px] font-bold leading-none animate-pulse">
                      {overdueCount}
                    </span>
                  )}
                </span>
                <span className="relative">
                  <Icon className="w-4 h-4" />
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-0 flex shrink-0 flex-col gap-2 border-t border-[var(--hairline)] pt-3">
          <UserChip />
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span className="text-xs text-muted-foreground">وضع الليل / النهار</span>
            <ThemeToggle className="h-9 w-9" />
          </div>
          <button onClick={signOut} className="press flex items-center justify-between gap-2 rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-[background-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-destructive/10 hover:text-destructive">
            <span>تسجيل الخروج</span>
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="glass no-scrollbar fixed inset-x-3 bottom-3 z-40 flex overflow-x-auto rounded-[1.5rem] md:hidden">
        {nav.map((n) => {
          const active = n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to);
          const Icon = n.icon;
          const showBadge = n.alertKey && overdueCount > 0;
          return (
            <Link key={n.to} to={n.to} className={cn("press flex min-w-[68px] flex-1 flex-col items-center gap-1.5 rounded-[1.25rem] py-3 text-[11px]", active ? "bg-primary/12 font-semibold text-primary" : "text-muted-foreground")}>
              <span className="relative">
                <Icon className="w-5 h-5" />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-danger text-danger-foreground text-[9px] font-bold leading-none">
                    {overdueCount}
                  </span>
                )}
              </span>
              {n.label}
            </Link>
          );
        })}
      </div>

      {/* علامة القمر — ظاهرة دايماً على الموبايل */}
      <div className="fixed left-3 top-3 z-40 md:hidden">
        <ThemeToggle className="h-10 w-10 backdrop-blur-xl" />
      </div>

      <main className="min-w-0 flex-1 px-4 pb-32 pt-10 text-right md:px-12 md:pb-16 md:pt-16">
        {children}
      </main>
    </div>
  );
}
