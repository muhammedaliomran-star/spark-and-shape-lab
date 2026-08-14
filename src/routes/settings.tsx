import { createFileRoute } from "@tanstack/react-router";
import Settings from "@/pages/Settings";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/settings")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Settings,
  head: () => ({
    meta: [
      { title: "الإعدادات — سِجلّي" },
      { name: "description", content: "بيانات المحل التي تظهر على الفواتير المطبوعة وإعدادات الحساب وكلمة السر." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "الإعدادات — سِجلّي" },
      { property: "og:description", content: "بيانات المحل التي تظهر على الفواتير المطبوعة وإعدادات الحساب وكلمة السر." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/settings" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "الإعدادات — سِجلّي" },
      { name: "twitter:description", content: "بيانات المحل التي تظهر على الفواتير المطبوعة وإعدادات الحساب وكلمة السر." },
    ],
    links: [{ rel: "canonical", href: "/settings" }],
  }),
});
