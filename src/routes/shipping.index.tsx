import { createFileRoute } from "@tanstack/react-router";
import Shipping from "@/pages/Shipping";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/shipping/")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Shipping,
  head: () => ({
    meta: [
      { title: "الشحن — سِجلّي" },
      { name: "description", content: "تتبع الشحنات وإدارة شركات التوصيل ومناطق التسليم." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "الشحن — سِجلّي" },
      { property: "og:description", content: "تتبع الشحنات وإدارة شركات التوصيل ومناطق التسليم." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/shipping" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "الشحن — سِجلّي" },
      { name: "twitter:description", content: "تتبع الشحنات وإدارة شركات التوصيل ومناطق التسليم." },
    ],
    links: [{ rel: "canonical", href: "/shipping" }],
  }),
});
