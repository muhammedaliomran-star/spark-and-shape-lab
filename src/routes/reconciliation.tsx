import { createFileRoute } from "@tanstack/react-router";
import Reconciliation from "@/pages/Reconciliation";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/reconciliation")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Reconciliation,
  head: () => ({ meta: [{ title: "مركز المطابقة — سِجلّي" }, { name: "robots", content: "noindex, nofollow" }] }),
});
