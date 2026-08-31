import { createFileRoute } from "@tanstack/react-router";
import AdminLicenses from "@/pages/AdminLicenses";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: requireAuth,
  component: AdminLicenses,
  head: () => ({
    meta: [
      { title: "إدارة التراخيص والمشتركين — سِجلّي" },
      {
        name: "description",
        content: "لوحة تحكم المشرف العام لإدارة العملاء المشتركين وتوليد التراخيص ومتابعة الإيرادات.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: "/admin" }],
  }),
});
