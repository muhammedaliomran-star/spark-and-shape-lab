import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  SlidersHorizontal,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardSectionId =
  | "quick_actions"
  | "storefront_bar"
  | "bento_kpis"
  | "secondary_kpis"
  | "top_products"
  | "insights"
  | "charts"
  | "expenses"
  | "at_risk"
  | "due_today"
  | "quick_links";

export interface SectionConfig {
  id: DashboardSectionId;
  label: string;
  description: string;
  visible: boolean;
}

const DEFAULT_SECTIONS: SectionConfig[] = [
  {
    id: "quick_actions",
    label: "شريط الإجراءات السريعة",
    description: "أزرار فورية لإنشاء فاتورة، سند تحصيل، ومصروف",
    visible: true,
  },
  {
    id: "storefront_bar",
    label: "شريط المتجر الإلكتروني السريع",
    description: "إحصاءات الزوار والطلبات الجديدة الواردة من متجرك",
    visible: true,
  },
  {
    id: "bento_kpis",
    label: "مؤشرات السيولة والديون والأرباح (Bento)",
    description: "السيولة النقدية، ديون العملاء، المخزون، والأرباح",
    visible: true,
  },
  {
    id: "secondary_kpis",
    label: "العملاء والشحن ومؤشر الرقابة",
    description: "كروت الشحن COD، مؤشر المطابقة المحاسبية، وحالة العملاء",
    visible: true,
  },
  {
    id: "top_products",
    label: "الأصناف الأكثر مبيعاً وتحقيقاً للإيراد",
    description: "ترتيب أعلى المنتجات طلباً وإيراداً لتنظيم التموين",
    visible: true,
  },
  {
    id: "insights",
    label: "توصيات وتنبيهات الإدارة الذكية",
    description: "تحليل ذكي للفروق الأسبوعية ونواقص المخزن",
    visible: true,
  },
  {
    id: "charts",
    label: "شارتات الاتجاهات والتحصيل",
    description: "رسم بياني لاتجاهات التحصيل وحالة التزام العملاء",
    visible: true,
  },
  {
    id: "expenses",
    label: "توزيع المصروفات",
    description: "تفصيل نسب المصروفات حسب التصنيف للفترة المحددة",
    visible: true,
  },
  {
    id: "at_risk",
    label: "عملاء بحاجة لمتابعة وتحصيل عاجل",
    description: "جدول العملاء المتأخرين مع أرقام الهواتف",
    visible: true,
  },
  {
    id: "due_today",
    label: "أقساط تستحق التحصيل اليوم",
    description: "قائمة الدفعات والأقساط المستحقة خلال اليوم",
    visible: true,
  },
  {
    id: "quick_links",
    label: "الأقسام والمراكز الحيوية",
    description: "روابط سريعة لأقسام النظام الرئيسية",
    visible: true,
  },
];

const STORAGE_KEY = "segilly_dashboard_sections_v1";

export function useDashboardLayout() {
  const [sections, setSections] = useState<SectionConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SectionConfig[] = JSON.parse(saved);
        // Ensure all default sections are present even if new sections were added
        const parsedMap = new Map(parsed.map((s) => [s.id, s]));
        const merged: SectionConfig[] = [];
        for (const item of DEFAULT_SECTIONS) {
          if (parsedMap.has(item.id)) {
            merged.push({ ...item, ...parsedMap.get(item.id)! });
          } else {
            merged.push(item);
          }
        }
        // Preserve user ordering
        const ordered = parsed
          .filter((p) => DEFAULT_SECTIONS.some((d) => d.id === p.id))
          .map((p) => ({ ...p, ...DEFAULT_SECTIONS.find((d) => d.id === p.id)!, visible: p.visible }));
        return ordered.length === DEFAULT_SECTIONS.length ? ordered : merged;
      }
    } catch {
      // fallback
    }
    return DEFAULT_SECTIONS;
  });

  const saveSections = (newSections: SectionConfig[]) => {
    setSections(newSections);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSections));
    } catch {
      // fallback
    }
  };

  const toggleSection = (id: DashboardSectionId) => {
    const updated = sections.map((s) =>
      s.id === id ? { ...s, visible: !s.visible } : s
    );
    saveSections(updated);
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    const clone = [...sections];
    const temp = clone[index];
    clone[index] = clone[targetIndex];
    clone[targetIndex] = temp;
    saveSections(clone);
  };

  const resetToDefault = () => {
    saveSections(DEFAULT_SECTIONS);
  };

  const isVisible = (id: DashboardSectionId) => {
    const s = sections.find((sec) => sec.id === id);
    return s ? s.visible : true;
  };

  return {
    sections,
    isVisible,
    toggleSection,
    moveSection,
    resetToDefault,
  };
}

export function DashboardCustomizationModal({
  open,
  onOpenChange,
  sections,
  onToggle,
  onMove,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: SectionConfig[];
  onToggle: (id: DashboardSectionId) => void;
  onMove: (index: number, direction: "up" | "down") => void;
  onReset: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              إعادة الضبط الافتراضي
            </Button>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg font-bold">تخصيص لوحة التحكم</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1 text-right">
            يمكنك إخفاء أو إعادة ترتيب أقسام لوحة التحكم لتناسب أسلوب عملك اليومي.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {sections.map((section, idx) => (
            <div
              key={section.id}
              className={cn(
                "flex items-center justify-between p-3.5 rounded-2xl border transition-all",
                section.visible
                  ? "bg-card border-border/80"
                  : "bg-muted/30 border-border/40 opacity-60"
              )}
            >
              {/* Order Controls & Visibility */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onMove(idx, "up")}
                    className="p-1 rounded-md hover:bg-muted disabled:opacity-30 disabled:pointer-events-none text-muted-foreground transition-colors"
                    title="تحريك لأعلى"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === sections.length - 1}
                    onClick={() => onMove(idx, "down")}
                    className="p-1 rounded-md hover:bg-muted disabled:opacity-30 disabled:pointer-events-none text-muted-foreground transition-colors"
                    title="تحريك لأسفل"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 ps-2 border-s border-border/60">
                  <Switch
                    checked={section.visible}
                    onCheckedChange={() => onToggle(section.id)}
                    aria-label={`تفعيل ${section.label}`}
                  />
                </div>
              </div>

              {/* Title & Description */}
              <div className="text-right flex-1 pe-3">
                <div className="text-sm font-bold text-foreground flex items-center justify-end gap-2">
                  <span>{section.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                    #{idx + 1}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {section.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-border flex justify-end">
          <Button
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-6"
          >
            حفظ وإغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
