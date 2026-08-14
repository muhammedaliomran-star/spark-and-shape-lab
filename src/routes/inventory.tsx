import { createFileRoute } from "@tanstack/react-router";
import Inventory from "@/pages/Inventory";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/inventory")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Inventory,
  head: () => ({
    meta: [
      { title: "المنتجات — سِجلّي" },
      { name: "description", content: "متابعة الأصناف والكميات وأسعار الشراء والبيع والتسويات اليدوية والنواقص." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "المنتجات — سِجلّي" },
      { property: "og:description", content: "متابعة الأصناف والكميات وأسعار الشراء والبيع والتسويات اليدوية والنواقص." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/inventory" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "المنتجات — سِجلّي" },
      { name: "twitter:description", content: "متابعة الأصناف والكميات وأسعار الشراء والبيع والتسويات اليدوية والنواقص." },
    ],
    links: [{ rel: "canonical", href: "/inventory" }],
  }),
});
