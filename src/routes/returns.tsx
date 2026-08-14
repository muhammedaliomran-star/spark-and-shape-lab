import { createFileRoute } from "@tanstack/react-router";
import Returns from "@/pages/Returns";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/returns")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Returns,
  head: () => ({
    meta: [
      { title: "المرتجعات — سِجلّي" },
      { name: "description", content: "إدارة مرتجعات المبيعات والمشتريات والربط التلقائي مع المخازن." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "المرتجعات — سِجلّي" },
      { property: "og:description", content: "إدارة مرتجعات المبيعات والمشتريات والربط التلقائي مع المخازن." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/returns" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "المرتجعات — سِجلّي" },
      { name: "twitter:description", content: "إدارة مرتجعات المبيعات والمشتريات والربط التلقائي مع المخازن." },
    ],
    links: [{ rel: "canonical", href: "/returns" }],
  }),
});
