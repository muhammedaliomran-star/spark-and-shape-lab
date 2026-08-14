import { createFileRoute } from "@tanstack/react-router";
import ResetPassword from "@/pages/ResetPassword";

const TITLE = "تعيين كلمة سر جديدة — سِجلّي";
const DESC = "اختر كلمة سر جديدة لحسابك في سِجلّي.";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPassword,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/reset-password" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: "/reset-password" }],
  }),
});
