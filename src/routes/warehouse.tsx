import { createFileRoute } from "@tanstack/react-router";
import Warehouse from "@/pages/Warehouse";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/warehouse")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Warehouse,
  head: () => ({
    meta: [
      { title: "المخزن — سِجلّي" },
      { name: "description", content: "قيمة المخزن بالتكلفة والبيع، توزيع الكميات، والأصناف تحت الحد أو المنتهية." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "المخزن — سِجلّي" },
      { property: "og:description", content: "قيمة المخزن بالتكلفة والبيع، توزيع الكميات، والأصناف تحت الحد أو المنتهية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "المخزن — سِجلّي" },
      { name: "twitter:description", content: "قيمة المخزن بالتكلفة والبيع، توزيع الكميات، والأصناف تحت الحد أو المنتهية." },
    ],
    links: [{ rel: "canonical", href: "/warehouse" }],
  }),
});
