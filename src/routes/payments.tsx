import { createFileRoute } from "@tanstack/react-router";
import PaymentsPage from "@/pages/Payments";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/payments")({
  ssr: false,
  beforeLoad: requireAuth,
  component: PaymentsPage,
});
