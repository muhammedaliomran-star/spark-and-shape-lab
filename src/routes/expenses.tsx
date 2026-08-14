import { createFileRoute } from "@tanstack/react-router";
import Expenses from "@/pages/Expenses";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/expenses")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Expenses,
  head: () => ({
    meta: [
      { title: "المصروفات — سِجلّي" },
      { name: "description", content: "تسجيل مصروفات المحل حسب البند ومتابعة إجماليها شهريًا." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "المصروفات — سِجلّي" },
      { property: "og:description", content: "تسجيل مصروفات المحل حسب البند ومتابعة إجماليها شهريًا." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/expenses" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "المصروفات — سِجلّي" },
      { name: "twitter:description", content: "تسجيل مصروفات المحل حسب البند ومتابعة إجماليها شهريًا." },
    ],
    links: [{ rel: "canonical", href: "/expenses" }],
  }),
});
