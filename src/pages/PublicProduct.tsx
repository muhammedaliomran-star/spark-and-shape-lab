import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { getPublicStorefront, type StorefrontProduct } from "@/lib/storefront";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight, Store } from "lucide-react";

const money = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

export default function PublicProduct({ slug, productSlug }: { slug: string; productSlug: string }) {
  const [product, setProduct] = useState<StorefrontProduct | null>(null);
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState("12");
  const [image, setImage] = useState(0);
  useEffect(() => { getPublicStorefront(slug).then((data) => { const item = data?.products.find((value) => value.slug === productSlug); setProduct(item ?? null); setStoreName(data?.storefront.name ?? ""); }).finally(() => setLoading(false)); }, [slug, productSlug]);
  if (loading) return <main className="grid min-h-screen place-items-center bg-[#07110e] text-white"><Loader2 className="h-8 w-8 animate-spin text-emerald-300" /></main>;
  if (!product) return <main dir="rtl" className="grid min-h-screen place-items-center bg-[#07110e] px-6 text-center text-white"><div><Store className="mx-auto h-10 w-10 text-emerald-300" /><h1 className="mt-4 text-2xl font-black">المنتج غير متاح</h1><Link to={`/shop/${slug}`} className="mt-5 inline-block text-emerald-300">العودة للمتجر</Link></div></main>;
  const monthly = Math.max(0, (product.display_price - (product.down_payment_from ?? 0)) / Math.max(1, Number(months) || 1));
  return <main dir="rtl" className="min-h-screen bg-[#07110e] text-white"><header className="border-b border-white/10 px-4 py-4"><div className="mx-auto flex max-w-5xl items-center justify-between"><Link to={`/shop/${slug}`} className="flex items-center gap-2 font-bold text-emerald-300"><ArrowRight className="h-4 w-4" /> العودة إلى {storeName}</Link><span className="text-sm text-slate-400">صفحة المنتج</span></div></header><div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-2"><section><div className="aspect-square overflow-hidden rounded-3xl border border-white/10 bg-white/5">{product.images[image] ? <img src={product.images[image]} alt={product.title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-7xl text-emerald-300">◈</div>}</div>{product.images.length > 1 && <div className="mt-3 grid grid-cols-5 gap-2">{product.images.map((url, index) => <button key={url} type="button" onClick={() => setImage(index)} className={`aspect-square overflow-hidden rounded-xl border ${image === index ? "border-emerald-300" : "border-white/10"}`}><img src={url} alt="" className="h-full w-full object-cover" /></button>)}</div>}</section><section><p className="text-sm font-bold text-emerald-300">{storeName}</p><h1 className="mt-3 text-4xl font-black">{product.title}</h1><p className="mt-5 whitespace-pre-wrap leading-8 text-slate-300">{product.description || "متاح للطلب من المتجر."}</p><p className="mt-7 text-3xl font-black text-emerald-300">{money(product.display_price)} ج.م</p>{product.show_installments && <div className="mt-7 rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-5"><h2 className="font-bold">حاسبة التقسيط</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm"><span>عدد الشهور</span><Input type="number" min="1" value={months} onChange={(event) => setMonths(event.target.value)} className="border-white/10 bg-white/5 text-white" /></label><div className="rounded-xl bg-black/20 p-3"><span className="block text-xs text-slate-400">القسط التقريبي</span><strong className="mt-1 block text-xl text-emerald-300">{money(monthly)} ج.م / شهر</strong></div></div><p className="mt-3 text-xs text-slate-400">المقدم من {money(product.down_payment_from ?? 0)} ج.م. القيمة النهائية يحددها المتجر بعد المراجعة.</p></div>}<Button asChild className="mt-7 w-full"><Link to={`/shop/${slug}`}>اطلب من المتجر</Link></Button></section></div></main>;
}
