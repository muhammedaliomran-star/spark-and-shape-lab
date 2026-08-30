import { createFileRoute } from "@tanstack/react-router";
import CourierPortal from "@/pages/CourierPortal";

export const Route = createFileRoute("/courier")({
  ssr: false,
  component: CourierPortal,
  head: () => ({
    meta: [
      { title: "بوابة المندوب (موبايل) — سِجلّي" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
