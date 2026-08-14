import type { CustomerStatus } from "@/lib/store";
import { ShieldCheck, AlertCircle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

const map: Record<CustomerStatus, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
  committed: { label: "ملتزم", cls: "bg-success/12 text-success ring-success/25", Icon: ShieldCheck },
  neutral: { label: "عادي", cls: "bg-warning/12 text-warning ring-warning/25", Icon: CircleDot },
  defaulter: { label: "مماطل", cls: "bg-danger/12 text-danger ring-danger/25", Icon: AlertCircle },
};

export function StatusBadge({ status }: { status: CustomerStatus }) {
  const { label, cls, Icon } = map[status];
  return (
    <span className={cn("press inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.01em] ring-1", cls)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
