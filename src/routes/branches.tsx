import { createFileRoute } from "@tanstack/react-router";
import BranchesPage from "@/pages/Branches";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/branches")({
  ssr: false,
  beforeLoad: requireAuth,
  component: BranchesPage,
});
