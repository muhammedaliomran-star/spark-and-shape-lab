import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/purchases/")({
  component: PurchasesPage,
});

function PurchasesPage() {
  return (
    <AppShell>
      <PageTransition>
        <PageHeader 
          title="فواتير المشتريات" 
          subtitle="سجل المشتريات والموردين."
          icon={<Truck className="w-7 h-7" />}
        />
        <div className="text-center py-20 text-muted-foreground">
          جاري تطوير نظام إدارة المشتريات...
        </div>
      </PageTransition>
    </AppShell>
  );
}
