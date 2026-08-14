import { createFileRoute } from "@tanstack/react-router";
import Auth from "@/pages/Auth";
import { redirectIfAuthed } from "@/lib/route-guards";

const TITLE = "تسجيل الدخول — سِجلّي";
const DESC = "ادخل على حسابك في سِجلّي أو أنشئ حساب جديد لإدارة عملاء محلك وفواتيره وأقساطه.";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: redirectIfAuthed,
  component: Auth,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/auth" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),
});
