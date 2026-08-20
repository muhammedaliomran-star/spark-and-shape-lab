import { createFileRoute } from "@tanstack/react-router";
import ReportsPage from "@/pages/Reports";

export const Route = createFileRoute("/reports/")({
  component: ReportsPage,
});
