import { createFileRoute } from "@tanstack/react-router";
import { InfoPageLayout } from "@/components/InfoPageLayout";

function SupportPage() {
  return (
    <InfoPageLayout
      eyebrow="support"
      title="الدعم الفني"
      intro="فريق سِجلّي موجود معاك خطوة بخطوة — من أول تسجيل الحساب لحد إقفال آخر قسط. اختار الطريقة الأسهل ليك وإحنا نرد بسرعة."
      sections={[
        {
          heading: "قنوات التواصل",
          bullets: [
            "واتساب ومكالمات: 01066830834 — متاح من 10 ص لـ 10 م طول الأسبوع.",
            "البريد الإلكتروني: muhammedaliomran@gmail.com — الرد خلال 24 ساعة عمل.",
            "فيسبوك: صفحة devmohamedomran للاستفسارات السريعة والتحديثات.",
          ],
        },
        {
          heading: "أوقات الاستجابة",
          bullets: [
            "مشكلة حرجة تمنع البيع أو إصدار الفواتير: متابعة فورية خلال ساعة داخل أوقات العمل.",
            "استفسار أو طلب تعديل بسيط: خلال يوم عمل واحد.",
            "طلب ميزة جديدة: نرجع لك بخطة زمنية واضحة خلال 3 أيام عمل.",
          ],
        },
        {
          heading: "قبل ما تبعت لنا",
          bullets: [
            "اكتب اسم الشاشة اللي حصلت فيها المشكلة (فواتير، عملاء، مخزون…).",
            "ابعت صورة للشاشة إن أمكن — بتوفّر وقت كبير في التشخيص.",
            "وضّح آخر خطوة عملتها قبل ظهور المشكلة.",
          ],
        },
        {
          heading: "تدريب وتجهيز الحساب",
          body:
            "بنساعدك في إدخال بيانات العملاء والمخزون لأول مرة، وبنعمل جلسة شرح للنظام لك وللموظفين، مجانًا مع أي باقة مدفوعة.",
        },
      ]}
    />
  );
}

export const Route = createFileRoute("/support")({
  ssr: false,
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "الدعم الفني — سِجلّي" },
      {
        name: "description",
        content:
          "قنوات التواصل وأوقات الاستجابة والدعم والتدريب لمستخدمي سِجلّي لإدارة الفواتير والأقساط.",
      },
      { property: "og:title", content: "الدعم الفني — سِجلّي" },
      {
        property: "og:description",
        content: "واتساب وبريد إلكتروني ودعم سريع لمستخدمي سِجلّي.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/support" }],
  }),
});
