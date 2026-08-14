import { createFileRoute } from "@tanstack/react-router";
import Alerts from "@/pages/Alerts";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/alerts")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Alerts,
  head: () => ({
    meta: [
      { title: "المنبه — سِجلّي" },
      { name: "description", content: "تنبيهات الأقساط المستحقة والمتأخرة والأصناف الناقصة في المخزن." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "المنبه — سِجلّي" },
      { property: "og:description", content: "تنبيهات الأقساط المستحقة والمتأخرة والأصناف الناقصة في المخزن." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/alerts" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "المنبه — سِجلّي" },
      { name: "twitter:description", content: "تنبيهات الأقساط المستحقة والمتأخرة والأصناف الناقصة في المخزن." },
    ],
    links: [{ rel: "canonical", href: "/alerts" }],
  }),
});
