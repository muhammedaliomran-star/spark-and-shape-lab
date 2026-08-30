import { createFileRoute } from "@tanstack/react-router";
import PosPage from "@/pages/Pos";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/pos")({
  ssr: false,
  beforeLoad: requireAuth,
  component: PosPage,
  head: () => ({
    meta: [
      { title: "نقطة البيع السريعة (POS) — سِجلّي" },
      { name: "description", content: "شاشة كاشير سريعة لإصدار فواتير البيع النقدي وإدارة السلات المعلقة وطباعة البونات." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "نقطة البيع السريعة (POS) — سِجلّي" },
      { property: "og:description", content: "شاشة كاشير سريعة لإصدار فواتير البيع النقدي وإدارة السلات المعلقة وطباعة البونات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "نقطة البيع السريعة (POS) — سِجلّي" },
      { name: "twitter:description", content: "شاشة كاشير سريعة لإصدار فواتير البيع النقدي وإدارة السلات المعلقة وطباعة البونات." },
    ],
  }),
});
