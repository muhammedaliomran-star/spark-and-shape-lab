import { createFileRoute } from "@tanstack/react-router";
import StorefrontOperations from "@/pages/StorefrontOperations";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/storefront/operations")({
  ssr: false,
  beforeLoad: requireAuth,
  component: StorefrontOperations,
  head: () => ({ meta: [{ title: "عمليات المتجر — سِجلّي" }, { name: "robots", content: "noindex, nofollow" }] }),
});