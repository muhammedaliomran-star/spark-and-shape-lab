import { createFileRoute } from "@tanstack/react-router";
import PublicStorefront from "@/pages/PublicStorefrontV2";

export const Route = createFileRoute("/shop/$slug")({
  ssr: false,
  component: () => <PublicStorefront slug={Route.useParams().slug} />,
  head: () => ({ meta: [{ title: "المتجر — سِجلّي" }, { name: "description", content: "تسوّق واطلب مباشرة من المتجر." }] }),
});
