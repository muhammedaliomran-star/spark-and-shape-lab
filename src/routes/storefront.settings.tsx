import { createFileRoute } from "@tanstack/react-router";
import StorefrontSettings from "@/pages/StorefrontSettings";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/storefront/settings")({
  ssr: false,
  beforeLoad: requireAuth,
  component: StorefrontSettings,
  head: () => ({ meta: [{ title: "إعدادات المتجر — سِجلّي" }, { name: "robots", content: "noindex, nofollow" }] }),
});