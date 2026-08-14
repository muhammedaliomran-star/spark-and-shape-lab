import { createFileRoute } from "@tanstack/react-router";
import Invoices from "@/pages/Invoices";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/invoices")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Invoices,
  head: () => ({
    meta: [
      { title: "الفواتير والأقساط — سِجلّي" },
      { name: "description", content: "إنشاء فواتير البيع بالتقسيط ومتابعة الأقساط والدفعات والمتبقي على كل عميل." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "الفواتير والأقساط — سِجلّي" },
      { property: "og:description", content: "إنشاء فواتير البيع بالتقسيط ومتابعة الأقساط والدفعات والمتبقي على كل عميل." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/invoices" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "الفواتير والأقساط — سِجلّي" },
      { name: "twitter:description", content: "إنشاء فواتير البيع بالتقسيط ومتابعة الأقساط والدفعات والمتبقي على كل عميل." },
    ],
    links: [{ rel: "canonical", href: "/invoices" }],
  }),
});
