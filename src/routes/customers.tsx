import { createFileRoute } from "@tanstack/react-router";
import Customers from "@/pages/Customers";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/customers")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Customers,
  head: () => ({
    meta: [
      { title: "العملاء — سِجلّي" },
      { name: "description", content: "إدارة ملفات العملاء والأرصدة والتقييم والسقف الائتماني وحالة السداد." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "العملاء — سِجلّي" },
      { property: "og:description", content: "إدارة ملفات العملاء والأرصدة والتقييم والسقف الائتماني وحالة السداد." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/customers" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "العملاء — سِجلّي" },
      { name: "twitter:description", content: "إدارة ملفات العملاء والأرصدة والتقييم والسقف الائتماني وحالة السداد." },
    ],
    links: [{ rel: "canonical", href: "/customers" }],
  }),
});
