import { createFileRoute } from "@tanstack/react-router";
import Reports from "@/pages/Reports";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/reports")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Reports,
  head: () => ({
    meta: [
      { title: "التقارير — سِجلّي" },
      { name: "description", content: "تقارير الأرباح والتحصيلات الشهرية وأفضل العملاء وأكثر الأصناف مبيعًا." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "التقارير — سِجلّي" },
      { property: "og:description", content: "تقارير الأرباح والتحصيلات الشهرية وأفضل العملاء وأكثر الأصناف مبيعًا." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/reports" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "التقارير — سِجلّي" },
      { name: "twitter:description", content: "تقارير الأرباح والتحصيلات الشهرية وأفضل العملاء وأكثر الأصناف مبيعًا." },
    ],
    links: [{ rel: "canonical", href: "/reports" }],
  }),
});
