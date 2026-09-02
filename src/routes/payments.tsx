import { createFileRoute } from "@tanstack/react-router";
import PaymentsPage from "@/pages/Payments";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/payments")({
  ssr: false,
  beforeLoad: requireAuth,
  component: PaymentsPage,
  head: () => ({
    meta: [
      { title: "سندات القبض والصرف — سِجلّي" },
      { name: "description", content: "إدارة سندات التحصيل والصرف ومتابعة حركة الدفعات." },
      { property: "og:title", content: "سندات القبض والصرف — سِجلّي" },
      { property: "og:description", content: "إدارة سندات التحصيل والصرف ومتابعة حركة الدفعات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
