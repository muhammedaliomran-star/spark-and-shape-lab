import { createFileRoute } from "@tanstack/react-router";
import NewInvoice from "@/pages/NewInvoice";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/invoices_/new")({
  ssr: false,
  beforeLoad: requireAuth,
  component: NewInvoice,
  head: () => ({
    meta: [
      { title: "إنشاء فاتورة جديدة — سِجلّي" },
      { name: "description", content: "صفحة كاملة لإنشاء فاتورة: العميل والمنتجات والمقدم والأقساط وملخص الربح." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "إنشاء فاتورة جديدة — سِجلّي" },
      { property: "og:description", content: "أنشئ فاتورة بيع نقدي أو أقساط بمساحة كاملة وملخص فوري للربح." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "إنشاء فاتورة جديدة — سِجلّي" },
      { name: "twitter:description", content: "أنشئ فاتورة بيع نقدي أو أقساط بمساحة كاملة وملخص فوري للربح." },
    ],
    links: [{ rel: "canonical", href: "/invoices/new" }],
  }),
});
