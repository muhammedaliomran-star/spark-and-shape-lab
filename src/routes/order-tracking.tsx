import { createFileRoute } from "@tanstack/react-router";
import OrderTracking from "@/pages/OrderTracking";

export const Route = createFileRoute("/order-tracking")({
  ssr: false,
  component: OrderTracking,
  head: () => ({ meta: [{ title: "تتبع الطلب — سِجلّي" }, { name: "robots", content: "noindex" }] }),
});
