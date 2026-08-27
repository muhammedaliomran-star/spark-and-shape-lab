import { createFileRoute } from "@tanstack/react-router";
import StorefrontCatalog from "@/pages/StorefrontCatalog";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/storefront/catalog")({
  ssr: false,
  beforeLoad: requireAuth,
  component: StorefrontCatalog,
  head: () => ({ meta: [{ title: "كتالوج المتجر — سِجلّي" }, { name: "robots", content: "noindex, nofollow" }] }),
});