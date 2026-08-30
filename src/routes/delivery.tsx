import { createFileRoute } from "@tanstack/react-router";
import DeliveryPortal from "@/pages/DeliveryPortal";

export const Route = createFileRoute("/delivery")({
  ssr: false,
  component: DeliveryPortal,
  head: () => ({
    meta: [
      { title: "بوابة مندوب التوصيل — سِجلّي" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
