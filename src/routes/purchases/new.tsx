import { createFileRoute } from "@tanstack/react-router";
import { NewPurchasePage } from "@/pages/purchases/NewPurchase";

export const Route = createFileRoute("/purchases/new")({
  component: NewPurchasePage,
});
