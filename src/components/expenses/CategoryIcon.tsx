import {
  Receipt,
  Building2,
  Zap,
  Users,
  Truck,
  Wrench,
  Megaphone,
  Package,
  Coffee,
  FileCheck,
  Sparkles,
  Wallet,
  Phone,
  Wifi,
  ShoppingBag,
  Car,
  Fuel,
  Shield,
  Landmark,
  Gift,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

const ICONS: Record<string, ComponentType<LucideProps>> = {
  Receipt,
  Building2,
  Zap,
  Users,
  Truck,
  Wrench,
  Megaphone,
  Package,
  Coffee,
  FileCheck,
  Sparkles,
  Wallet,
  Phone,
  Wifi,
  ShoppingBag,
  Car,
  Fuel,
  Shield,
  Landmark,
  Gift,
};

/** فئات ألوان التصنيفات — ثابتة حتى يلتقطها Tailwind وقت البناء */
export const CATEGORY_COLOR_CLASSES: Record<string, { soft: string; dot: string; text: string }> = {
  emerald: { soft: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", text: "text-emerald-600" },
  blue: { soft: "bg-blue-500/12 text-blue-700 dark:text-blue-300", dot: "bg-blue-500", text: "text-blue-600" },
  amber: { soft: "bg-amber-500/12 text-amber-700 dark:text-amber-300", dot: "bg-amber-500", text: "text-amber-600" },
  purple: { soft: "bg-purple-500/12 text-purple-700 dark:text-purple-300", dot: "bg-purple-500", text: "text-purple-600" },
  pink: { soft: "bg-pink-500/12 text-pink-700 dark:text-pink-300", dot: "bg-pink-500", text: "text-pink-600" },
  cyan: { soft: "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500", text: "text-cyan-600" },
  orange: { soft: "bg-orange-500/12 text-orange-700 dark:text-orange-300", dot: "bg-orange-500", text: "text-orange-600" },
  teal: { soft: "bg-teal-500/12 text-teal-700 dark:text-teal-300", dot: "bg-teal-500", text: "text-teal-600" },
  indigo: { soft: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500", text: "text-indigo-600" },
  slate: { soft: "bg-slate-500/12 text-slate-700 dark:text-slate-300", dot: "bg-slate-500", text: "text-slate-600" },
};

export function CategoryIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && ICONS[name]) || Receipt;
  return <Icon className={className} />;
}
