import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShopSettings, saveShopSettings } from "@/lib/store";
import { applyTheme, resolvedTheme, storeTheme } from "@/lib/theme";

/**
 * علامة القمر — تبديل فوري بين وضع الليل والنهار.
 * التبديل بيتطبق على طول محلياً، وبيتحفظ في إعدادات المحل لو المستخدم مسجّل دخول.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { settings } = useShopSettings();
  const [mode, setMode] = useState<"dark" | "light">("dark");

  useEffect(() => { setMode(resolvedTheme(settings.theme)); }, [settings.theme]);

  const toggle = async () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    applyTheme(next);
    storeTheme(next);
    try { await saveShopSettings({ ...settings, theme: next }); } catch { /* زائر — يكفي الحفظ محلياً */ }
  };

  const isDark = mode === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "التبديل لوضع النهار" : "التبديل لوضع الليل"}
      title={isDark ? "وضع النهار" : "وضع الليل"}
      className={cn(
        "group relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full",
        "bg-foreground/[0.045] p-[3px] ring-1 ring-[var(--hairline,rgba(255,255,255,0.08))]",
        "transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.94]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-primary/0 transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:bg-primary/10"
      />
      <span className="relative grid h-full w-full place-items-center rounded-full bg-background/60 shadow-[inset_0_1px_1px_hsl(var(--foreground)/0.06)]">
        <Moon
          strokeWidth={1.5}
          className={cn(
            "absolute h-[18px] w-[18px] text-foreground transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0",
          )}
        />
        <Sun
          strokeWidth={1.5}
          className={cn(
            "absolute h-[18px] w-[18px] text-muted-foreground transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isDark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100",
          )}
        />
      </span>
    </button>
  );
}

export default ThemeToggle;