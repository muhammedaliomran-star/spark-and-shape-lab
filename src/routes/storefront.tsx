import { createFileRoute } from "@tanstack/react-router";
import Storefront from "@/pages/Storefront";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/storefront")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Storefront,
  head: () => ({ meta: [{ title: "المتجر الإلكتروني — سِجلّي" }, { name: "robots", content: "noindex, nofollow" }] }),
});
