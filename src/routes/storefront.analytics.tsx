import { createFileRoute } from "@tanstack/react-router";
import StorefrontAnalytics from "@/pages/StorefrontAnalytics";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/storefront/analytics")({
  ssr: false,
  beforeLoad: requireAuth,
  component: StorefrontAnalytics,
  head: () => ({ meta: [{ title: "تحليلات المتجر — سِجلّي" }, { name: "robots", content: "noindex, nofollow" }] }),
});