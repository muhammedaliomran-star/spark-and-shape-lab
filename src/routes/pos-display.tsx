import { createFileRoute } from "@tanstack/react-router";
import PosDisplayPage from "@/pages/PosDisplay";

export const Route = createFileRoute("/pos-display")({
  ssr: false,
  component: PosDisplayPage,
  head: () => ({
    meta: [
      { title: "شاشة عرض العميل — سِجلّي" },
      { name: "description", content: "شاشة عرض أسعار ومشتريات العميل لحظياً." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
