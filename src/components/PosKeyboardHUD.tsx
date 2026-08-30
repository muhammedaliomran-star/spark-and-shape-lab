import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Search,
  Zap,
  Layers,
  Clock,
  Undo2,
  Tv,
  Trash2,
  Keyboard,
  Pause,
  FolderOpen,
} from "lucide-react";

interface PosKeyboardHUDProps {
  onSearchFocus?: () => void;
  onInstantCheckout?: () => void;
  onSplitPayment?: () => void;
  onQuickRefund?: () => void;
  onHoldCart?: () => void;
  onRecallHeld?: () => void;
  onCustomerDisplay?: () => void;
  onClearCart?: () => void;
  onShiftManager?: () => void;
  heldCount?: number;
  cartCount?: number;
}

export function PosKeyboardHUD({
  onSearchFocus,
  onInstantCheckout,
  onSplitPayment,
  onQuickRefund,
  onHoldCart,
  onRecallHeld,
  onCustomerDisplay,
  onClearCart,
  onShiftManager,
  heldCount = 0,
  cartCount = 0,
}: PosKeyboardHUDProps) {
  const shortcuts = [
    {
      key: "F2",
      label: "بحث وباركود",
      icon: <Search className="h-3 w-3" />,
      action: onSearchFocus,
      tone: "default",
    },
    {
      key: "F3",
      label: "مرتجع سريع",
      icon: <Undo2 className="h-3 w-3" />,
      action: onQuickRefund,
      tone: "danger",
    },
    {
      key: "F4",
      label: "كاش فوري",
      icon: <Zap className="h-3 w-3" />,
      action: onInstantCheckout,
      tone: "primary",
      disabled: cartCount === 0,
    },
    {
      key: "F6",
      label: "دفع متعدد (Split)",
      icon: <Layers className="h-3 w-3" />,
      action: onSplitPayment,
      tone: "secondary",
      disabled: cartCount === 0,
    },
    {
      key: "F8",
      label: "تعليق الفاتورة",
      icon: <Pause className="h-3 w-3" />,
      action: onHoldCart,
      tone: "warning",
      disabled: cartCount === 0,
    },
    {
      key: "F9",
      label: `معلقة (${heldCount})`,
      icon: <FolderOpen className="h-3 w-3" />,
      action: onRecallHeld,
      tone: "default",
      highlight: heldCount > 0,
    },
    {
      key: "F10",
      label: "شاشة العميل",
      icon: <Tv className="h-3 w-3" />,
      action: onCustomerDisplay,
      tone: "default",
    },
    {
      key: "Esc",
      label: "مسح السلة",
      icon: <Trash2 className="h-3 w-3" />,
      action: onClearCart,
      tone: "danger",
      disabled: cartCount === 0,
    },
  ];

  return (
    <div className="hidden lg:flex items-center justify-between gap-1.5 px-3 py-1.5 bg-card/90 backdrop-blur-md border-t border-border/50 text-[11px] select-none shrink-0 overflow-x-auto">
      <div className="flex items-center gap-1.5 text-muted-foreground font-bold shrink-0">
        <Keyboard className="h-3.5 w-3.5 text-primary" />
        <span>اختصارات الكاشير:</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {shortcuts.map((sc) => (
          <button
            key={sc.key}
            type="button"
            onClick={sc.action}
            disabled={sc.disabled}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-semibold",
              sc.highlight
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600 font-bold"
                : sc.tone === "primary"
                ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                : sc.tone === "danger"
                ? "bg-danger/5 border-danger/20 text-danger hover:bg-danger/10"
                : "bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <kbd className="px-1 py-0.2 rounded bg-background border border-border/80 font-mono font-bold text-[9px] shadow-2xs">
              {sc.key}
            </kbd>
            <span className="hidden xl:inline">{sc.icon}</span>
            <span>{sc.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
