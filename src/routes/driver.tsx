import { createFileRoute } from "@tanstack/react-router";
import CourierPortal from "@/pages/CourierPortal";

export const Route = createFileRoute("/driver")({
  ssr: false,
  component: CourierPortal,
  head: () => ({
    meta: [
      { title: "بوابة المندوب — سِجلّي" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
