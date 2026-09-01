import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, ReceiptText, Share2 } from "lucide-react";
import { toPng } from "html-to-image";
import { Route } from "@/routes/receipt.$token";
import { getPublicReceipt } from "@/lib/public-receipt.functions";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/store";
import { toast } from "sonner";

type ReceiptData = NonNullable<Awaited<ReturnType<typeof getPublicReceipt>>>;

export default function PublicReceipt() {
  const { token } = Route.useParams();
  const fetchReceipt = useServerFn(getPublicReceipt);
  const [receipt, setReceipt] = useState<ReceiptData | null | undefined>();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReceipt({ data: { token } }).then(setReceipt).catch(() => setReceipt(null));
  }, [fetchReceipt, token]);

  if (receipt === undefined) return <main className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>;
  if (!receipt) return <main className="grid min-h-screen place-items-center bg-background px-6 text-center"><div><ReceiptText className="mx-auto h-10 w-10 text-muted-foreground"/><h1 className="mt-4 text-xl font-bold">الإيصال غير متاح</h1><p className="mt-2 text-sm text-muted-foreground">تأكد من صحة الرابط أو اطلب رابطًا جديدًا من المتجر.</p></div></main>;

  const remaining = Math.max(0, receipt.invoice.total - receipt.invoice.paid);
  const downloadImage = async () => {
    if (!cardRef.current) return;
    const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
    const link = document.createElement("a"); link.download = `receipt-${receipt.invoice.number}.png`; link.href = dataUrl; link.click();
  };
  const share = async () => {
    if (navigator.share) await navigator.share({ title: `فاتورة #${receipt.invoice.number}`, url: window.location.href });
    else { await navigator.clipboard.writeText(window.location.href); toast.success("تم نسخ رابط الإيصال"); }
  };

  return <main className="min-h-screen bg-muted/30 px-4 py-8 text-right" dir="rtl">
    <div className="mx-auto mb-4 flex max-w-2xl items-center justify-between gap-2">
      <Button variant="outline" onClick={share} className="gap-2"><Share2 className="h-4 w-4"/> مشاركة</Button>
      <Button onClick={downloadImage} className="gap-2"><Download className="h-4 w-4"/> حفظ كصورة</Button>
    </div>
    <div ref={cardRef} className="mx-auto max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-xl">
      <header className="border-b border-border bg-foreground p-7 text-background">
        <div className="flex items-center justify-between gap-5">
          <div className="text-left"><p className="text-xs opacity-70">رقم الفاتورة</p><p className="font-mono text-lg font-bold">#{receipt.invoice.number}</p></div>
          <div><h1 className="text-2xl font-black">{receipt.shop.name}</h1><p className="mt-1 text-xs opacity-70">إيصال مبيعات رقمي معتمد</p></div>
        </div>
      </header>
      <section className="space-y-6 p-6 sm:p-8">
        <div className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-muted-foreground">التاريخ</p><p className="font-bold" dir="ltr">{new Date(receipt.invoice.createdAt).toLocaleDateString("ar-EG")}</p></div><div><p className="text-muted-foreground">العميل</p><p className="font-bold">{receipt.customer.name}</p></div></div>
        <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[540px] text-sm"><thead className="bg-muted/60 text-muted-foreground"><tr><th className="p-3 text-right">الصنف</th><th className="p-3">الكمية</th><th className="p-3">السعر</th><th className="p-3">الصافي</th></tr></thead><tbody className="divide-y divide-border">{receipt.items.map((item, index) => <tr key={`${item.name}-${index}`}><td className="p-3 font-semibold">{item.name}{item.serialNumbers.length > 0 && <p className="mt-1 font-mono text-[10px] text-muted-foreground" dir="ltr">IMEI/SN: {item.serialNumbers.join(" • ")}</p>}{(item.discountPct > 0 || item.taxPct > 0) && <p className="mt-1 text-[10px] text-muted-foreground">خصم {fmt(item.discountPct)}% • ضريبة {fmt(item.taxPct)}%</p>}</td><td className="p-3 text-center">{item.quantity}</td><td className="p-3 text-center">{fmt(item.price)}</td><td className="p-3 text-center font-bold">{fmt(item.lineTotal)}</td></tr>)}</tbody></table></div>
        <div className="mr-auto grid max-w-sm gap-2 text-sm"><div className="flex justify-between gap-8"><span className="font-bold">{fmt(receipt.invoice.total)} {receipt.shop.currency}</span><span className="text-muted-foreground">الإجمالي</span></div><div className="flex justify-between gap-8"><span className="font-bold text-success">{fmt(receipt.invoice.paid)} {receipt.shop.currency}</span><span className="text-muted-foreground">المدفوع</span></div><div className="flex justify-between gap-8 border-t border-border pt-3 text-base"><span className="font-black text-danger">{fmt(remaining)} {receipt.shop.currency}</span><span className="font-bold">المتبقي</span></div></div>
        <footer className="border-t border-dashed border-border pt-5 text-center text-xs text-muted-foreground">{receipt.shop.footerNote || "شكرًا لتعاملكم معنا"}{receipt.shop.phone && <span className="block mt-1" dir="ltr">{receipt.shop.phone}</span>}</footer>
      </section>
    </div>
  </main>;
}