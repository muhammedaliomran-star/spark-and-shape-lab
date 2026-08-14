import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/pages/Dashboard";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "لوحة التحكم — سِجلّي" },
      { name: "description", content: "نظرة سريعة على المبيعات والتحصيلات والأرباح والمخزون في محلك." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "لوحة التحكم — سِجلّي" },
      { property: "og:description", content: "نظرة سريعة على المبيعات والتحصيلات والأرباح والمخزون في محلك." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "لوحة التحكم — سِجلّي" },
      { name: "twitter:description", content: "نظرة سريعة على المبيعات والتحصيلات والأرباح والمخزون في محلك." },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});
