import { createFileRoute } from "@tanstack/react-router";
import BlockedPage from "@/pages/BlockedPage";

export const Route = createFileRoute("/")({
  ssr: false,
  component: BlockedPage,
  head: () => ({
    meta: [
      { title: "ESTA EXTENSÃO FOI PIRATEADA" },
      { name: "description", content: "Acesso bloqueado por uso não autorizado." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
