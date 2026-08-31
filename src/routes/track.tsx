import { createFileRoute } from "@tanstack/react-router";
import OrderTracking from "@/pages/OrderTracking";

export const Route = createFileRoute("/track")({
  ssr: false,
  component: OrderTracking,
  head: () => ({
    meta: [
      { title: "تتبع الشحنة والطلب — سِجلّي" },
      { name: "description", content: "تابع حالة شحنتك أو طلبك بأمان باستخدام رقم التتبع ورقم الهاتف." },
      { property: "og:title", content: "تتبع الشحنة والطلب — سِجلّي" },
      { property: "og:description", content: "تابع حالة شحنتك أو طلبك بأمان باستخدام رقم التتبع ورقم الهاتف." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
