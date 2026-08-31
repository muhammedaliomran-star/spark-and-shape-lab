import { createFileRoute } from "@tanstack/react-router";
import OrderTracking from "@/pages/OrderTracking";

export const Route = createFileRoute("/order-tracking")({
  ssr: false,
  component: OrderTracking,
  head: () => ({ meta: [
    { title: "تتبع الطلب — سِجلّي" },
    { name: "description", content: "صفحة متوافقة لتتبع الطلبات السابقة باستخدام رقم الطلب ورقم الهاتف." },
    { property: "og:title", content: "تتبع الطلب — سِجلّي" },
    { property: "og:description", content: "صفحة متوافقة لتتبع الطلبات السابقة باستخدام رقم الطلب ورقم الهاتف." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
});
