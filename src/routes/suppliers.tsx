import { createFileRoute } from "@tanstack/react-router";
import Suppliers from "@/pages/Suppliers";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/suppliers")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Suppliers,
  head: () => ({
    meta: [
      { title: "الموردين والمشتريات — سِجلّي" },
      { name: "description", content: "تسجيل فواتير الشراء وأرصدة الموردين ودفعات السداد." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "الموردين والمشتريات — سِجلّي" },
      { property: "og:description", content: "تسجيل فواتير الشراء وأرصدة الموردين ودفعات السداد." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/suppliers" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "الموردين والمشتريات — سِجلّي" },
      { name: "twitter:description", content: "تسجيل فواتير الشراء وأرصدة الموردين ودفعات السداد." },
    ],
    links: [{ rel: "canonical", href: "/suppliers" }],
  }),
});
