import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/reports/")({
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <AppShell>
      <PageTransition>
        <PageHeader 
          title="التقارير المالية" 
          subtitle="تحليل الأداء والأرباح والمصروفات."
          icon={<BarChart3 className="w-7 h-7" />}
        />
        <div className="text-center py-20 text-muted-foreground">
          جاري تطوير نظام التقارير المتقدمة...
        </div>
      </PageTransition>
    </AppShell>
  );
}
