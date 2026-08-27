import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { getPublicStorefront, type ShippingOption, type StorefrontProduct } from "@/lib/storefront";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search, ShoppingBag, Store, Truck } from "lucide-react";
import { trackStorefrontEvent } from "@/lib/storefront-analytics";
import Checkout from "@/components/StorefrontCheckout";

type CartLine = { product: StorefrontProduct; quantity: number };
const money = (value: number) => new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(value);

export default function PublicStorefrontV2({ slug }: { slug: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getPublicStorefront>>>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    getPublicStorefront(slug).then(setData).catch((error: any) => setLoadError(error.message ?? "تعذر تحميل المتجر، حاول تاني.")).finally(() => setLoading(false));
  }, [slug]);
  useEffect(() => { if (data) void trackStorefrontEvent(data.storefront.id, "store_view"); }, [data]);
  useEffect(() => {
    if (!data) return;
    document.title = data.storefront.seo_title || data.storefront.name;
    document.documentElement.dataset.storefrontTheme = data.storefront.theme_key || "emerald";
    document.documentElement.style.setProperty("--storefront-banner", data.storefront.banner_url ? `url(${data.storefront.banner_url})` : "none");
    return () => { delete document.documentElement.dataset.storefrontTheme; document.documentElement.style.removeProperty("--storefront-banner"); };
  }, [data]);
  useEffect(() => {
    if (!data) return;
    setCart((current) => current.flatMap((line) => {
      const product = data.products.find((item) => item.id === line.product.id);
      const available = product?.available_quantity ?? 0;
      return product && available > 0 ? [{ product, quantity: Math.min(line.quantity, available) }] : [];
    }));
  }, [data]);

  const products = useMemo(() => (data?.products ?? []).filter((item) => item.title.includes(query) || (item.description ?? "").includes(query)), [data, query]);
  const add = (product: StorefrontProduct) => setCart((current) => { const line = current.find((item) => item.product.id === product.id); return line ? current.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.available_quantity ?? item.quantity + 1) } : item) : [...current, { product, quantity: 1 }]; });
  const setQuantity = (productId: string, quantity: number) => setCart((current) => quantity < 1 ? current.filter((item) => item.product.id !== productId) : current.map((item) => item.product.id === productId ? { ...item, quantity: Math.min(quantity, item.product.available_quantity ?? quantity) } : item));

  if (loading) return <Frame><Loader2 className="mx-auto mt-32 h-8 w-8 animate-spin text-emerald-300" /></Frame>;
  if (loadError) return <Frame><Empty title="حصلت مشكلة في تحميل المتجر" detail={loadError} /></Frame>;
  if (!data) return <Frame><Empty title="المتجر ده مش متاح دلوقتي" /> </Frame>;

  return <Frame><header className="sticky top-0 z-20 border-b border-white/10 bg-[#07110e]/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><Link to="/landing" className="flex items-center gap-2 font-black text-emerald-300"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-300 text-[#07110e]"><Store className="h-5 w-5" /></span>{data.storefront.name}</Link><Button variant="outline" onClick={() => setCheckout(true)}><ShoppingBag className="h-4 w-4" /> السلة ({cart.reduce((sum, line) => sum + line.quantity, 0)})</Button></div></header><main className="mx-auto max-w-6xl px-4 pb-24"><section className="grid gap-8 py-12 lg:grid-cols-[1.3fr_.7fr]"><div><p className="font-bold text-emerald-300">تسوق من {data.storefront.name}</p><h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">{data.storefront.description || "اختار اللي يناسبك، والباقي علينا."}</h1></div><ShippingPanel policy={data.storefront.shipping_policy} options={data.shippingOptions} /></section><div className="relative mb-7"><Search className="absolute right-4 top-3.5 h-5 w-5 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بتدور على إيه؟" className="h-12 border-white/10 bg-white/5 pr-12 text-white" /></div><section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <article key={product.id} className="rounded-3xl border border-white/10 bg-white/[.035] p-5"><div className="grid aspect-[4/3] place-items-center rounded-2xl bg-emerald-300/10 text-5xl">{product.images[0] ? <img src={product.images[0]} alt={product.title} className="h-full w-full rounded-2xl object-cover" /> : <Store className="h-10 w-10 text-emerald-200" />}</div><h2 className="mt-5 text-lg font-bold">{product.title}</h2><p className="mt-1 text-sm text-slate-400">{product.description || "متاح للطلب من المتجر."}</p><div className="mt-5 flex items-center justify-between gap-3"><strong className="text-xl text-emerald-300">{money(product.display_price)} ج.م</strong><Button onClick={() => add(product)}><Plus className="h-4 w-4" /> أضف</Button></div></article>)}</section>{products.length === 0 && <p className="py-16 text-center text-slate-400">مفيش منتجات مطابقة للبحث دلوقتي.</p>}</main>{checkout && <Checkout store={{ id: data.storefront.id, name: data.storefront.name, minimumOrder: data.storefront.minimum_order }} options={data.shippingOptions} cart={cart} onClose={() => setCheckout(false)} onQuantity={setQuantity} />}</Frame>;
}

function ShippingPanel({ policy, options }: { policy: string | null; options: ShippingOption[] }) { return <div className="rounded-3xl border border-emerald-300/15 bg-emerald-300/5 p-6"><Truck className="h-7 w-7 text-emerald-300" /><p className="mt-4 font-bold">التوصيل والاستلام</p><p className="mt-2 text-sm leading-6 text-slate-300">{policy || "اختار منطقتك وشوف تكلفة ومدة التوصيل قبل تأكيد الطلب."}</p>{options.length ? <div className="mt-5 grid gap-2">{options.map((option) => <div key={option.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"><span>{option.name}</span><span className="text-emerald-200">{money(option.delivery_cost)} ج.م · {option.estimated_days} أيام</span></div>)}</div> : <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-200">التوصيل غير متاح حاليًا — تواصل مع المحل.</p>}</div>; }
function Empty({ title, detail }: { title: string; detail?: string }) { return <div className="mx-auto mt-32 max-w-md px-6 text-center"><Store className="mx-auto h-10 w-10 text-emerald-300" /><h1 className="mt-4 text-2xl font-bold">{title}</h1>{detail && <p className="mt-2 text-slate-400">{detail}</p>}</div>; }
function Frame({ children }: { children: ReactNode }) { return <div dir="rtl" className="min-h-screen bg-[#07110e] bg-[image:var(--storefront-banner)] bg-[length:100%_auto] bg-no-repeat text-white">{children}</div>; }
