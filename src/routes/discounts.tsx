import { createFileRoute } from "@tanstack/react-router";
import Discounts from "@/pages/Discounts";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/discounts")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Discounts,
  head: () => ({
    meta: [
      { title: "الخصومات والعروض الترويجية — سِجلّي" },
      { name: "description", content: "إدارة قسائم وأكواد الخصم، العروض الموسمية، ومتابعة أثرها على الأرباح والمبيعات." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "الخصومات والعروض الترويجية — سِجلّي" },
      { property: "og:description", content: "إدارة قسائم وأكواد الخصم، العروض الموسمية، ومتابعة أثرها على الأرباح والمبيعات." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/discounts" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "الخصومات والعروض الترويجية — سِجلّي" },
      { name: "twitter:description", content: "إدارة قسائم وأكواد الخصم، العروض الموسمية، ومتابعة أثرها على الأرباح والمبيعات." },
    ],
    links: [{ rel: "canonical", href: "/discounts" }],
  }),
});
