import { createFileRoute } from "@tanstack/react-router";
import OwnerCockpit from "@/pages/OwnerCockpit";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/owner")({
  ssr: false,
  beforeLoad: requireAuth,
  component: OwnerCockpit,
  head: () => ({
    meta: [
      { title: "لوحة المالك التنفيذية — سِجلّي" },
      { name: "description", content: "شاشة صاحب المحل لمتابعة نبض السيولة والأرباح ورادار التحصيل والرقابة." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "لوحة المالك التنفيذية — سِجلّي" },
      { property: "og:description", content: "شاشة صاحب المحل لمتابعة نبض السيولة والأرباح ورادار التحصيل والرقابة." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/owner" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "لوحة المالك التنفيذية — سِجلّي" },
      { name: "twitter:description", content: "شاشة صاحب المحل لمتابعة نبض السيولة والأرباح ورادار التحصيل والرقابة." },
    ],
    links: [{ rel: "canonical", href: "/owner" }],
  }),
});
