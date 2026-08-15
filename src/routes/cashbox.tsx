import { createFileRoute } from '@tanstack/react-router';
import CashboxPage from '@/pages/Cashbox';

export const Route = createFileRoute('/cashbox')({
  component: CashboxPage,
});
