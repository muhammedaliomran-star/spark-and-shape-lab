import { createFileRoute } from "@tanstack/react-router";
import PublicProduct from "@/pages/PublicProduct";

export const Route = createFileRoute("/shop/$slug/$product")({
  ssr: false,
  component: () => <PublicProduct slug={Route.useParams().slug} productSlug={Route.useParams().product} />,
  head: () => ({ meta: [{ title: "المنتج — المتجر" }, { name: "description", content: "تفاصيل المنتج وخيارات التقسيط." }] }),
});