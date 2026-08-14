import { createFileRoute } from "@tanstack/react-router";
import AddProduct from "@/pages/AddProduct";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/inventory_/new")({
  ssr: false,
  beforeLoad: requireAuth,
  component: AddProduct,
  head: () => ({
    meta: [
      { title: "إضافة منتج جديد — سِجلّي" },
      { name: "description", content: "صفحة كاملة لإضافة منتج للمخزن: الاسم والمقاس والنوع والكمية والأسعار والباركود والحد الأدنى." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "إضافة منتج جديد — سِجلّي" },
      { property: "og:description", content: "أضف منتجًا جديدًا بالتسعير والباركود وحساب الربح الفوري." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "إضافة منتج جديد — سِجلّي" },
      { name: "twitter:description", content: "أضف منتجًا جديدًا بالتسعير والباركود وحساب الربح الفوري." },
    ],
    links: [{ rel: "canonical", href: "/inventory/new" }],
  }),
});
