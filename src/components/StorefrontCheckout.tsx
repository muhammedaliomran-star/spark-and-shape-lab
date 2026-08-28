import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { validateStorefrontCoupon } from "@/lib/storefront-commercial";
import { submitStoreOrder, type OrderType, type ShippingOption, type StorefrontProduct } from "@/lib/storefront";
import { Loader2, Minus, Plus, Tag, Truck, X, Copy, MessageCircle, MapPin } from "lucide-react";
import { renderOrderConfirmation, trackUrlFor, waLink } from "@/lib/whatsapp-templates";

type CartLine = { product: StorefrontProduct; quantity: number };
type Fulfillment = "pickup" | "delivery";
const money = (value: number) => new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(value);
type Coupon = Awaited<ReturnType<typeof validateStorefrontCoupon>>;

export default function StorefrontCheckout({ store, options, cart, onClose, onQuantity }: { store: { id: string; name: string; minimumOrder?: number }; options: ShippingOption[]; cart: CartLine[]; onClose: () => void; onQuantity: (id: string, quantity: number) => void }) {
  const [form, setForm] = useState({ name: "", phone: "", area: "", address: "", notes: "", type: "cash_on_delivery" as OrderType, shippingZoneId: "" });
  const [fulfillment, setFulfillment] = useState<Fulfillment>(options.length ? "delivery" : "pickup");
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<Coupon>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const subtotal = cart.reduce((sum, line) => sum + line.product.display_price * line.quantity, 0);
  const shipping = options.find((option) => option.id === form.shippingZoneId);
  const discount = coupon?.valid ? Math.min(coupon.discount_amount, subtotal) : 0;
  const shippingFee = fulfillment === "delivery" ? shipping?.delivery_cost ?? 0 : 0;
  const total = Math.max(0, subtotal - discount) + shippingFee;
  const belowMinimum = Boolean(store.minimumOrder && subtotal < store.minimumOrder);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponBusy(true); setError("");
    try {
      const result = await validateStorefrontCoupon(store.id, couponCode, subtotal);
      if (!result?.valid) throw new Error("الكوبون غير صالح أو لا ينطبق على الطلب");
      setCoupon(result);
    } catch (reason: any) { setCoupon(null); setError(reason.message ?? "تعذر التحقق من الكوبون"); }
    finally { setCouponBusy(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!cart.length) return;
    if (belowMinimum) return setError(`الحد الأدنى للطلب هو ${money(store.minimumOrder ?? 0)} ج.م`);
    if (fulfillment === "delivery" && !form.shippingZoneId) return setError(options.length ? "اختار منطقة التوصيل الأول" : "التوصيل غير متاح حاليًا، اختار الاستلام من المحل");
    setSending(true); setError("");
    try {
       const result = await submitStoreOrder({ storefrontId: store.id, customerName: form.name, customerPhone: form.phone, deliveryAddress: fulfillment === "delivery" ? form.address : "استلام من المحل", deliveryArea: fulfillment === "delivery" ? form.area : undefined, notes: form.notes, orderType: form.type, idempotencyKey, shippingZoneId: fulfillment === "delivery" ? form.shippingZoneId : undefined, couponCode: coupon?.valid ? couponCode : undefined, items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })) });
      setDone(result.public_number);
    } catch (reason: any) { setError(reason.message ?? "حصلت مشكلة، جرب تاني."); }
    finally { setSending(false); }
  };

  return <div className="fixed inset-0 z-30 overflow-y-auto bg-[#040806]/95 p-4 text-white backdrop-blur-sm"><div className="mx-auto my-5 max-w-xl rounded-3xl border border-white/10 bg-[#0a1713] p-5 sm:p-7">
    {done ? (() => {
      const trackUrl = trackUrlFor(done, form.phone);
      const waMsg = renderOrderConfirmation({
        shop: { shopName: store.name },
        customerName: form.name,
        customerPhone: form.phone,
        publicNumber: done,
        address: fulfillment === "delivery" ? form.address : "استلام من المحل",
        area: form.area,
        total: money(total),
        subtotal: money(subtotal),
        shippingFee: money(shippingFee),
        shippingZone: shipping?.name,
        estimatedDays: shipping?.estimated_days,
      });
      return <div className="py-8 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-300 text-[#07110e]"><MapPin className="h-7 w-7" /></div><h2 className="mt-4 text-2xl font-black">تم تأكيد طلبك ✅</h2><p className="mt-2 text-sm text-slate-400">رقم الطلب</p><p className="text-xl font-black text-emerald-300 tracking-widest">{done}</p><div className="mt-5 rounded-2xl bg-white/5 p-4 text-right text-sm leading-6"><p>• العنوان: <b>{fulfillment === "delivery" ? `${form.area ? form.area + " - " : ""}${form.address}` : "استلام من المحل"}</b></p>{shipping && <p>• {shipping.name} — {money(shipping.delivery_cost)} ج.م · {shipping.estimated_days} أيام</p>}<p>• الإجمالي: <b className="text-emerald-300">{money(total)} ج.م</b></p></div><div className="mt-5 grid gap-2"><Button asChild className="gap-2 bg-emerald-300 text-[#07110e] hover:bg-emerald-200"><a href={waLink(form.phone, waMsg)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> إرسال تأكيد واتساب</a></Button><div className="grid grid-cols-2 gap-2"><Button variant="outline" className="gap-2 border-white/10 bg-white/5 text-white" onClick={() => { navigator.clipboard.writeText(trackUrl); }}><Copy className="h-4 w-4" /> نسخ رابط التتبع</Button><Button variant="outline" className="gap-2 border-white/10 bg-white/5 text-white" onClick={() => window.open(trackUrl, "_blank")}><Truck className="h-4 w-4" /> تتبع مباشر</Button></div><Button variant="ghost" className="w-full text-slate-300" onClick={onClose}>رجوع للمتجر</Button></div><p className="mt-3 text-center text-xs text-slate-500">رابط التتبع: <span dir="ltr" className="font-mono text-[11px] break-all">{trackUrl}</span></p></div>;
    })() : <form onSubmit={submit}>
      <div className="flex items-center justify-between"><h2 className="text-xl font-black">تأكيد الطلب</h2><button type="button" onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5 text-slate-400" /></button></div>
      <div className="mt-5 grid gap-3">{cart.map((line) => <div key={line.product.id} className="flex items-center justify-between rounded-2xl bg-white/5 p-3"><span>{line.product.title} × {line.quantity}</span><div className="flex items-center gap-2"><button type="button" aria-label="تقليل الكمية" onClick={() => onQuantity(line.product.id, line.quantity - 1)}><Minus className="h-4 w-4" /></button><button type="button" aria-label="زيادة الكمية" onClick={() => onQuantity(line.product.id, line.quantity + 1)}><Plus className="h-4 w-4" /></button></div></div>)}</div>
      <div className="mt-5 grid grid-cols-2 gap-2"><Button type="button" variant={fulfillment === "pickup" ? "default" : "outline"} onClick={() => { setFulfillment("pickup"); setForm({ ...form, shippingZoneId: "" }); }}>استلام من المحل</Button><Button type="button" variant={fulfillment === "delivery" ? "default" : "outline"} disabled={!options.length} onClick={() => setFulfillment("delivery")}><Truck className="h-4 w-4" /> توصيل</Button></div>
      {fulfillment === "delivery" && (options.length ? <label className="mt-5 grid gap-2"><span className="text-sm text-slate-300">منطقة التوصيل</span><select required value={form.shippingZoneId} onChange={(event) => setForm({ ...form, shippingZoneId: event.target.value })} className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-white"><option value="" className="bg-[#0a1713]">اختار المنطقة</option>{options.map((option) => <option key={option.id} value={option.id} className="bg-[#0a1713]">{option.name} - {money(option.delivery_cost)} ج.م · {option.estimated_days} أيام</option>)}</select></label> : <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-200">التوصيل غير متاح حاليًا — تواصل مع المحل.</p>)}
      <div className="mt-5 grid gap-3"><Field label="الاسم" value={form.name} required onChange={(name) => setForm({ ...form, name })} /><Field label="رقم الموبايل" value={form.phone} required onChange={(phone) => setForm({ ...form, phone })} />{fulfillment === "delivery" && <><Field label="المنطقة بالتفصيل" value={form.area} onChange={(area) => setForm({ ...form, area })} /><Field label="العنوان" value={form.address} required onChange={(address) => setForm({ ...form, address })} /></>}<Textarea placeholder="ملاحظات إضافية (اختياري)" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
      <div className="mt-4 flex gap-2"><Input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="كود الخصم" /><Button type="button" variant="outline" disabled={couponBusy} onClick={() => void applyCoupon()}>{couponBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />} تطبيق</Button></div>
      {belowMinimum && <p className="mt-3 text-sm text-amber-200">الحد الأدنى للطلب {money(store.minimumOrder ?? 0)} ج.م.</p>}
      <div className="mt-5 grid gap-1 border-t border-white/10 pt-4 text-sm"><div className="flex justify-between"><span>المنتجات</span><span>{money(subtotal)} ج.م</span></div><div className="flex justify-between"><span>الخصم</span><span>- {money(discount)} ج.م</span></div><div className="flex justify-between"><span>التوصيل</span><span>{money(shippingFee)} ج.م</span></div><div className="mt-2 flex justify-between text-lg font-black"><span>الإجمالي</span><span>{money(total)} ج.م</span></div></div>
      {error && <p className="mt-4 rounded-xl bg-rose-300/10 p-3 text-sm text-rose-200">{error}</p>}
      <Button className="mt-5 w-full" disabled={sending || belowMinimum}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إرسال الطلب"}</Button>
    </form>}
  </div></div>;
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <div><Label className="text-slate-300">{label}</Label><Input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 border-white/10 bg-white/5 text-white" /></div>; }
