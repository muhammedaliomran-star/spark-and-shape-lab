import { createFileRoute } from "@tanstack/react-router";
import AuditLogPage from "@/pages/AuditLog";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/audit")({
  ssr: false,
  beforeLoad: requireAuth,
  component: AuditLogPage,
  head: () => ({
    meta: [
      { title: "سجل حركات النظام والتدقيق — سِجلّي" },
      { name: "description", content: "سجل رقابي لتتبع كافة التعديلات، الحذف، والمبيعات لمنع التلاعب." },
    ],
  }),
});
