import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Banknote } from "lucide-react";

export default function PaymentsPage() {
  return (
    <AppShell>
      <PageTransition>
        <PageHeader title="الدفعات" icon={<Banknote className="h-7 w-7" />} subtitle="إدارة الدفعات والتحصيلات" />
        <div className="py-20 text-center text-muted-foreground">قريباً: إدارة الدفعات</div>
      </PageTransition>
    </AppShell>
  );
}
