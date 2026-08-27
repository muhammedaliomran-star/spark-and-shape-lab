import { createFileRoute } from "@tanstack/react-router";
import ShippingDay from "@/pages/ShippingDay";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/shipping/day")({
  ssr: false,
  beforeLoad: requireAuth,
  component: ShippingDay,
  head: () => ({ meta: [{ title: "يوم الشحن — الشحن — سِجلّي" }, { name: "robots", content: "noindex, nofollow" }] }),
});
