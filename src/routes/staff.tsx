import { createFileRoute } from "@tanstack/react-router";
import StaffAndShiftsPage from "@/pages/StaffAndShifts";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/staff")({
  ssr: false,
  beforeLoad: requireAuth,
  component: StaffAndShiftsPage,
  head: () => ({
    meta: [
      { title: "الموظفين والورديات — سِجلّي" },
      { name: "description", content: "إدارة الكاشير والورديات والصلاحيات وتقرير الـ Z-Report." },
    ],
  }),
});
