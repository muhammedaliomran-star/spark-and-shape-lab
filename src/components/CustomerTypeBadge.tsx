import type { CustomerType } from "@/lib/store";
import { CreditCard, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";

const map: Record<CustomerType, { label: string; cls: string; Icon: typeof CreditCard }> = {
  installment: { label: "عميل قسط", cls: "bg-primary/12 text-primary ring-primary/25", Icon: CreditCard },
  cash: { label: "عميل فوري", cls: "bg-success/12 text-success ring-success/25", Icon: Banknote },
};

export function CustomerTypeBadge({ type }: { type: CustomerType }) {
  const { label, cls, Icon } = map[type];
  return (
    <span className={cn("press inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.01em] ring-1", cls)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
