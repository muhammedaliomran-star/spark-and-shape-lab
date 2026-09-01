import { createFileRoute } from "@tanstack/react-router";
import PublicReceipt from "@/pages/PublicReceipt";

export const Route = createFileRoute("/receipt/$token")({
  component: PublicReceipt,
  head: () => ({ meta: [
    { title: "إيصال فاتورة رقمي — سِجلّي" },
    { name: "description", content: "عرض وتنزيل إيصال الفاتورة الرقمي بأمان." },
    { property: "og:title", content: "إيصال فاتورة رقمي — سِجلّي" },
    { property: "og:description", content: "عرض وتنزيل إيصال الفاتورة الرقمي بأمان." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
});