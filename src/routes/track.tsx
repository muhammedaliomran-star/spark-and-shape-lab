import { createFileRoute } from "@tanstack/react-router";
import OrderTracking from "@/pages/OrderTracking";

export const Route = createFileRoute("/track")({
  ssr: false,
  component: OrderTracking,
  head: () => ({
    meta: [
      { title: "تتبع الشحنة والطلب — سِجلّي" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
