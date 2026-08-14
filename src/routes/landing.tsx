import { createFileRoute } from "@tanstack/react-router";
import Landing from "@/pages/Landing";

export const Route = createFileRoute("/landing")({
  ssr: false,
  component: Landing,
  head: () => ({
    meta: [
      { title: "سِجلّي — إدارة فواتير وأقساط المحلات" },
      {
        name: "description",
        content:
          "نظام عربي لإدارة العملاء والفواتير والأقساط والمخزون والمصروفات لمحلات البيع بالتقسيط في مصر.",
      },
      { property: "og:title", content: "سِجلّي — إدارة فواتير وأقساط المحلات" },
      {
        property: "og:description",
        content:
          "من الفاتورة لآخر قسط — عملاء ومخزون ومصروفات، محسوبة بالمليم.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/landing" },
      { property: "og:image", content: "https://id-preview--78c0b7d5-7020-4705-a792-27e1ee2336b1.lovable.app/og-segilly.jpg" },
      { name: "twitter:image", content: "https://id-preview--78c0b7d5-7020-4705-a792-27e1ee2336b1.lovable.app/og-segilly.jpg" },

      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "سِجلّي — إدارة فواتير وأقساط المحلات" },
      {
        name: "twitter:description",
        content:
          "من الفاتورة لآخر قسط — عملاء ومخزون ومصروفات، محسوبة بالمليم.",
      },
    ],
    links: [{ rel: "canonical", href: "/landing" }],
  }),
});
