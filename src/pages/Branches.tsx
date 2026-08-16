import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { GitBranch } from "lucide-react";

export default function BranchesPage() {
  return (
    <AppShell>
      <PageTransition>
        <PageHeader title="الفروع" icon={<GitBranch className="h-7 w-7" />} subtitle="إدارة فروع المحل" />
        <div className="py-20 text-center text-muted-foreground">قريباً: إدارة الفروع</div>
      </PageTransition>
    </AppShell>
  );
}
