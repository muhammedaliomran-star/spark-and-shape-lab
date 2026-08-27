import { createFileRoute } from "@tanstack/react-router";
import RescueOrders from "@/pages/RescueOrders";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/shipping/rescue")({
  ssr: false,
  beforeLoad: requireAuth,
  component: RescueOrders,
  head: () => ({ meta: [{ title: "إنقاذ الطلبات — الشحن — سِجلّي" }, { name: "robots", content: "noindex, nofollow" }] }),
});
