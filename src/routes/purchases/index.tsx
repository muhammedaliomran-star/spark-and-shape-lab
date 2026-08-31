import { createFileRoute } from "@tanstack/react-router";
import { PurchasesPage } from "@/pages/purchases/Purchases";

export const Route = createFileRoute("/purchases/")({
  component: PurchasesPage,
});
