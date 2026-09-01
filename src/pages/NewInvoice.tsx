import { useEffect, useMemo, useRef, useState } from "react";
import { format, addMonths } from "date-fns";
import { Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { StockProductPicker, type ProductRow } from "@/pages/Invoices";
import {
  useDB,
  db,
  fmt,
  customerBalance,
  useShopSettings,
  uid,
  type ProductVariant,
  type SplitPaymentDetail,
} from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { CustomerTypeBadge } from "@/components/CustomerTypeBadge";
import { findStockByBarcode } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivacy } from "@/lib/privacy";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus,
  AlertTriangle,
  ShieldAlert,
  Trash2,
  CalendarIcon,
  Package,
  ScanLine,
  Receipt,
  Banknote,
  ArrowRight,
  Eye,
  EyeOff,
  Truck,
  Undo2,
  Sparkles,
  CreditCard,
  Smartphone,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Printer,
  Layers,
  Search,
} from "lucide-react";
import { useParkedBills, playScanSound, playCashSound } from "@/lib/pos";
import { useSecurity, shouldRequireManagerPinForDiscount, shouldHideCostAndProfits } from "@/lib/security";
import { ManagerPinModal } from "@/components/ManagerPinModal";
import { ParkedBillsModal } from "@/components/ParkedBillsModal";
import { pdfDocument, openPdfDocument } from "@/lib/pdf-doc";

export default function Page() {
  return (
    <AppShell>
      <PageTransition>
        <NewInvoicePage />
      </PageTransition>
    </AppShell>
  );
}

function NewInvoicePage() {
  const data = useDB();
  const { settings: shop } = useShopSettings();
  const { privacy, toggle } = usePrivacy();
  const { isCashierMode } = useSecurity();
  const { parkedBills, parkBill } = useParkedBills();
  const navigate = useNavigate();

  const hideProfits = shouldHideCostAndProfits(shop, isCashierMode) || privacy;
  const blurCls = hideProfits ? "privacy-blur" : "privacy-clear";

  const [customerId, setCustomerId] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([
    { id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" },
  ]);
  const [down, setDown] = useState("0");
  const [monthly, setMonthly] = useState("");
  const [count, setCount] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [saleType, setSaleType] = useState<"cash" | "installments">("installments");
  const [cashPaid, setCashPaid] = useState("");
  const [step, setStep] = useState(1);
  const [discountPct, setDiscountPct] = useState("");
  const [discountAmt, setDiscountAmt] = useState("");
  const [taxPct, setTaxPct] = useState("");
  const [status, setStatus] = useState<"paid" | "pending" | "cancelled">("pending");
  const [shippingCarrierId, setShippingCarrierId] = useState("");
  const [shippingZoneId, setShippingZoneId] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  // Commercial POS Features
  const [quickBarcodeInput, setQuickBarcodeInput] = useState("");
  const [parkedModalOpen, setParkedModalOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingSubmitAction, setPendingSubmitAction] = useState<(() => void) | null>(null);

  // Split Payment (الدفع المجزأ)
  const [enableSplitPayment, setEnableSplitPayment] = useState(false);
  const [splitCash, setSplitCash] = useState("");
  const [splitElectronic, setSplitElectronic] = useState("");
  const [splitMethod, setSplitMethod] = useState<"instapay" | "vodafone_cash" | "visa" | "bank_transfer">("instapay");
  const [splitRef, setSplitRef] = useState("");

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const defaultFirstDue = () => {
    const day = Math.min(28, Math.max(1, shop.defaultDueDay || 1));
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, day);
  };

  useEffect(() => {
    setCount((c) => c || String(Math.max(1, shop.defaultInstallmentMonths || 6)));
    setDate((d) => d ?? defaultFirstDue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.defaultInstallmentMonths, shop.defaultDueDay]);

  const invoiceCode = `#${String((data.invoices?.length ?? 0) + 1).padStart(4, "0")}`;

  const customer = data.customers.find((c) => c.id === customerId);
  const blocked = customer && (customer.frozen || customer.status === "defaulter");

  const totalCost = products.reduce((s, p) => s + Number(p.cost || 0) * Number(p.quantity || 1), 0);
  const lineMetrics = (p: ProductRow) => {
    const gross = Number(p.price || 0) * Number(p.quantity || 1);
    const discount = gross * Math.min(100, Math.max(0, Number(p.discount || 0))) / 100;
    const taxable = Math.max(0, gross - discount);
    const tax = taxable * Math.max(0, Number(p.taxPct || 0)) / 100;
    return { gross, discount, tax, total: taxable + tax };
  };
  const subtotal = products.reduce((s, p) => s + lineMetrics(p).total, 0);
  const discountValue = Math.min(subtotal, Math.max(0, Number(discountAmt || 0)));
  const afterDiscount = Math.max(0, subtotal - discountValue);
  const taxValue = Math.max(0, (afterDiscount * Number(taxPct || 0)) / 100);
  const totalPrice = afterDiscount + taxValue;
  const remaining = Math.max(0, totalPrice - Number(down || 0));
  const profit = afterDiscount - totalCost;
  const profitPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  const downNum = Number(down || 0);
  const countNum = Number(count || 0);
  const monthlyNum = Number(monthly || 0);
  const cashPaidNum = Number(cashPaid || 0);
  const change = Math.max(0, cashPaidNum - totalPrice);
  const cashShort = Math.max(0, totalPrice - cashPaidNum);
  const isCashMode = saleType === "cash" || (totalPrice > 0 && downNum >= totalPrice);
  const totalDue = downNum + monthlyNum * countNum;

  // Split payment totals
  const splitCashNum = Number(splitCash || 0);
  const splitElecNum = Number(splitElectronic || 0);
  const splitTotal = splitCashNum + splitElecNum;
  const splitDiff = Math.abs(splitTotal - totalPrice);

  const handleScan = (code: string) => {
    setScanOpen(false);
    const found = findStockByBarcode(data.stockItems, code);
    if (!found) {
      toast.error(`لا يوجد منتج بالباركود: ${code}`, {
        description: "يمكنك إضافته كمنتج جديد للمخزن.",
        action: {
          label: "إضافة منتج جديد",
          onClick: async () => {
            try {
              await db.addStockItem({ name: `منتج ${code.slice(-4)}`, barcode: code });
              toast.success("تمت إضافة المنتج للمخزن — حدّث بياناته من صفحة المخزن");
            } catch (e: any) {
              toast.error(e?.message ?? "تعذر الإضافة");
            }
          },
        },
      });
      return;
    }

    playScanSound();
    setProducts((prev) => {
      const existingIdx = prev.findIndex((r) => r.stockId === found.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: String((Number(next[existingIdx].quantity) || 0) + 1),
        };
        return next;
      }
      const emptyIdx = prev.findIndex((r) => !r.name && !r.stockId);
      const newRow: ProductRow = {
        id: crypto.randomUUID(),
        stockId: found.id,
        name: found.name,
        cost: String(found.lastUnitCost || 0),
        price: String(found.salePrice || 0),
        quantity: "1",
      };
      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = { ...newRow, id: prev[emptyIdx].id };
        return next;
      }
      return [...prev, newRow];
    });
    toast.success(`تمت إضافة: ${found.name} ✓`);
  };

  // Continuous Fast Barcode Keydown Handler
  const handleQuickBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = quickBarcodeInput.trim();
    if (!code) return;
    setQuickBarcodeInput("");
    handleScan(code);
  };

  const schedule = useMemo(() => {
    if (isCashMode || !date || countNum <= 0 || monthlyNum <= 0) return [];
    const rows: { n: number; due: Date; amount: number }[] = [];
    let left = remaining;
    for (let i = 0; i < Math.min(countNum, 60); i++) {
      const amount =
        i === countNum - 1 ? Math.max(0, left) : Math.min(monthlyNum, Math.max(0, left));
      left -= amount;
      rows.push({ n: i + 1, due: addMonths(date, i), amount });
    }
    return rows;
  }, [isCashMode, date, countNum, monthlyNum, remaining]);

  const hasValidProduct = products.some(
    (p) => p.name.trim() && Number(p.price) > 0 && Number(p.quantity) > 0,
  );
  const blockReason = !customerId
    ? "اختر العميل أولًا (أو اضغط F1 لاختيار عميل نقدي سريع)"
    : blocked
      ? "العميل محظور من فتح فواتير جديدة"
      : !hasValidProduct
        ? "أضف منتج واحد على الأقل بسعر صحيح"
        : !isCashMode && (!monthlyNum || !date)
          ? "أكمل بيانات الأقساط (القسط الشهري وتاريخ أول قسط)"
          : !isCashMode && customer?.customerType === "cash"
            ? "العميل فوري (نقدي) — لا يسمح بالتقسيط"
            : enableSplitPayment && splitDiff > 0.01
              ? `مجموع الدفع المجزأ (${fmt(splitTotal)}) لا يساوي إجمالي الفاتورة (${fmt(totalPrice)})`
              : null;

  useEffect(() => {
    const n = Number(count);
    if (n > 0 && remaining > 0) setMonthly(String(Math.ceil(remaining / n)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, totalPrice, down]);

  const customerInfo = useMemo(() => {
    if (!customer) return null;
    const balance = customerBalance(data.invoices, customer.id, customer.openingBalance);
    const limit = customer.creditLimit || 0;
    const wouldExceed = limit > 0 && balance + remaining > limit;
    return { balance, limit, wouldExceed };
  }, [customer, data.invoices, remaining]);

  const addProduct = () =>
    setProducts((p) => [
      ...p,
      { id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" },
    ]);
  const removeProduct = (id: string) =>
    setProducts((p) => (p.length > 1 ? p.filter((x) => x.id !== id) : p));
  const updateProduct = (id: string, patch: Partial<ProductRow>) =>
    setProducts((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const selectDefaultCashCustomer = () => {
    const cashCust =
      data.customers.find((c) => c.customerType === "cash" || c.name.includes("نقدي")) ||
      data.customers[0];
    if (cashCust) {
      setCustomerId(cashCust.id);
      setSaleType("cash");
      setDown("0");
      setMonthly("");
      setCount("");
      toast.success(`تم اختيار العميل: ${cashCust.name} (بيع فوري)`);
    } else {
      toast.error("لا يوجد عملاء مسجلين. أضف عميل أولاً.");
    }
  };

  const handleParkCurrentBill = () => {
    const validProducts = products.filter((p) => p.name.trim());
    if (validProducts.length === 0) {
      toast.error("لا توجد منتجات لتعليق الفاتورة");
      return;
    }
    parkBill({
      customerName: customer?.name || "عميل نقدي",
      customerId: customerId || undefined,
      totalAmount: totalPrice,
      products: validProducts,
      notes: notes || undefined,
      saleType,
    });
    toast.success("تم تعليق الفاتورة بنجاح (Parked Bill)");
    reset();
  };

  const handleResumeParkedBill = (bill: any) => {
    if (bill.customerId) setCustomerId(bill.customerId);
    if (bill.saleType) setSaleType(bill.saleType);
    if (bill.notes) setNotes(bill.notes);
    if (bill.products && bill.products.length > 0) {
      setProducts(bill.products);
    }
    setStep(2);
    toast.success(`تم استرجاع الفاتورة المعلقة للعميل: ${bill.customerName}`);
  };

  const reset = () => {
    setCustomerId("");
    setProducts([{ id: crypto.randomUUID(), name: "", cost: "", price: "", quantity: "1" }]);
    setDown("0");
    setMonthly("");
    setCount(String(Math.max(1, shop.defaultInstallmentMonths || 6)));
    setDate(defaultFirstDue());
    setNotes("");
    setSaleType("installments");
    setCashPaid("");
    setDiscountPct("");
    setDiscountAmt("");
    setTaxPct("");
    setStatus("pending");
    setShippingCarrierId("");
    setShippingZoneId("");
    setShippingAddress("");
    setTrackingNumber("");
    setEnableSplitPayment(false);
    setSplitCash("");
    setSplitElectronic("");
    setSplitRef("");
  };

  const executeSubmit = async (stay = false, printDirectThermal = false) => {
    if (!customerId) return toast.error("اختر عميل");
    if (blocked) return toast.error("هذا العميل محظور من فتح فواتير جديدة");
    const validProducts = products.filter(
      (p) => p.name.trim() && Number(p.price) > 0 && Number(p.quantity) > 0,
    );
    if (validProducts.length === 0) return toast.error("أضف منتج واحد على الأقل بسعر صحيح");
    for (const p of validProducts) {
      const serials = (p.serialNumbers || "").split(/[\n,]+/).map((value) => value.trim()).filter(Boolean);
      if (serials.length > Number(p.quantity || 0)) {
        return toast.error(`عدد أرقام السيريال للصنف «${p.name}» أكبر من الكمية`);
      }
      if (new Set(serials).size !== serials.length) {
        return toast.error(`يوجد رقم سيريال مكرر داخل الصنف «${p.name}»`);
      }
      if (!p.stockId) continue;
      const stock = data.stockItems.find((s) => s.id === p.stockId);
      const qty = Number(p.quantity || 0);
      if (!stock) return toast.error(`المنتج "${p.name}" غير موجود في المخزون`);
      if (stock.quantity <= 0) return toast.error(`المنتج "${stock.name}" نفد من المخزون`);
      if (stock.quantity < qty)
        return toast.error(`الكمية المتاحة من "${stock.name}" هي ${stock.quantity} فقط`);
    }
    const t = totalPrice;
    const d = Number(down);
    const isCash = saleType === "cash" || (t > 0 && d >= t);
    const m = isCash ? 0 : Number(monthly);
    if (!isCash && (!m || !date)) return toast.error("املأ بيانات الأقساط");
    if (!isCash && customer?.customerType === "cash") {
      return toast.error(
        "العميل مسجّل «فوري (نقدي)» — لازم تحصيل كامل المبلغ أو تغيّر نوعه لعميل قسط",
      );
    }
    if (customerInfo?.wouldExceed && !isCash) {
      return toast.error(
        `تجاوز سقف المديونية (${fmt(customerInfo.limit)} ج.م) — عدّل المقدم أو ارفع السقف`,
      );
    }

    const iso = isCash ? format(new Date(), "yyyy-MM-dd") : format(date as Date, "yyyy-MM-dd");
    const summary = validProducts
      .map((p) => `${p.name.trim()}${Number(p.quantity) > 1 ? ` ×${p.quantity}` : ""}`)
      .join("، ");
    const productNotes = `${summary}${notes ? ` — ${notes}` : ""}`;

    try {
      const userId = await uid();
      const { data: invData, error: invErr } = await supabase.from("invoices")
        .insert({
          user_id: userId,
          customer_id: customerId,
          total: t,
          down_payment: isCash ? t : d,
          monthly_installment: m,
          first_due_date: iso,
          notes: productNotes,
          paid: isCash ? t : d,
          discount_pct: Number(discountPct || 0),
          discount_amount: discountValue,
          tax_pct: Number(taxPct || 0),
          tax_amount: taxValue,
          status: isCash ? "paid" : status,
        })
        .select("id")
        .single();

      if (invErr) throw invErr;

      // Add Invoice Items
      if (validProducts.length > 0 && invData?.id) {
        const itemRows = validProducts.flatMap((p) => {
          const qty = Math.max(1, Number(p.quantity || 1));
          return [
            {
              user_id: userId,
              invoice_id: invData.id,
              name: p.name.trim(),
              cost: Number(p.cost || 0),
              price: Number(p.price || 0),
              quantity: qty,
              discount_pct: Math.min(100, Math.max(0, Number(p.discount || 0))),
              discount_amount: lineMetrics(p).discount,
              tax_pct: Math.max(0, Number(p.taxPct || 0)),
              tax_amount: lineMetrics(p).tax,
              line_total: lineMetrics(p).total,
              serial_numbers: (p.serialNumbers || "").split(/[\n,]+/).map((value) => value.trim()).filter(Boolean),
            },
          ];
        });
        const { error: itemsErr } = await supabase.from("invoice_items").insert(itemRows);
        if (itemsErr) throw itemsErr;
      }

      // Add Shipment if carrier selected
      if (shippingCarrierId && invData?.id) {
        const { error: shipErr } = await (supabase.from as any)("shipments").insert({
          user_id: await uid(),
          invoice_id: invData.id,
          carrier_id: shippingCarrierId,
          zone_id: shippingZoneId || null,
          tracking_number: trackingNumber || null,
          status: "pending",
          recipient_name: customer?.name,
          recipient_phone: customer?.phone,
          delivery_address: shippingAddress || customer?.address,
        });
        if (shipErr) throw shipErr;
      }

      const deductions = validProducts
        .filter((p) => p.stockId)
        .flatMap((p) => p.stockId ? [{ stockId: p.stockId, quantity: Number(p.quantity || 0) }] : []);
      if (deductions.length > 0) await db.deductStock(deductions);

      playCashSound();

      // Print direct thermal receipt if requested or configured
      if (printDirectThermal || shop.autoPrintOnSave) {
        const cur = shop.currency || "ج.م";
        const body = `
<div class="info">
  <div class="box"><b>العميل:</b> ${customer?.name || "عميل نقدي"}</div>
  <div class="box"><b>الهاتف:</b> ${customer?.phone || "—"}</div>
</div>
<div class="t-wrap"><table>
  <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
  <tbody>
    ${validProducts.map((p) => `<tr><td>${p.name}</td><td>${p.quantity}</td><td class="num">${p.price}</td><td class="num">${Number(p.price) * Number(p.quantity)} ${cur}</td></tr>`).join("")}
  </tbody>
</table></div>
<div class="total-bar"><span>الإجمالي الصافي:</span><span class="v">${fmt(t)} ${cur}</span></div>
${enableSplitPayment ? `<div style="font-size:11px;padding:4px 0;border-bottom:1px dashed #ccc;">كاش: ${fmt(splitCashNum)} ${cur} | إلكتروني (${splitMethod}): ${fmt(splitElecNum)} ${cur}</div>` : ""}
<div style="text-align:center;font-size:10px;margin-top:8px;color:#555;">شكراً لزيارتكم!</div>`;

        const html = pdfDocument({
          docTitle: `فاتورة ${invoiceCode}`,
          badge: isCash ? "فاتورة مبيعات نقدية" : "فاتورة مبيعات تقسيط",
          title: shop.shopName || "فاتورة ضريبية مبسطة",
          brandSub: shop.shopName || undefined,
          meta: [
            { label: "رقم الفاتورة", value: invoiceCode },
            { label: "التاريخ", value: format(new Date(), "yyyy/MM/dd HH:mm") },
            ...(shop.taxNumber ? [{ label: "الرقم الضريبي", value: shop.taxNumber }] : []),
          ],
          kpis: [{ label: "الإجمالي", value: `${fmt(t)} ${cur}`, tone: "brand" }],
          body,
          paper: shop.printPaper || "thermal",
          thermalWidth: shop.thermalPaperWidth || "80mm",
          kickCashDrawer: shop.openCashDrawerOnPrint ?? true,
          barcodeValue: invoiceCode.replace("#", ""),
        });
        openPdfDocument(html, {
          autoPrint: true,
          features: "width=420,height=760",
        });
      }

      toast.success(isCash ? "تم إنشاء فاتورة البيع النقدي ✓ وطباعة الإيصال" : "تم إنشاء الفاتورة بنجاح ✓");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر إنشاء الفاتورة");
      return;
    }
    reset();
    if (!stay) navigate({ to: "/invoices" });
  };

  const submit = (stay = false, printDirectThermal = false) => {
    // Check Manager PIN for high discounts
    const pct = Number(discountPct || 0);
    if (shouldRequireManagerPinForDiscount(pct, shop, isCashierMode)) {
      setPendingSubmitAction(() => () => executeSubmit(stay, printDirectThermal));
      setPinModalOpen(true);
      return;
    }
    executeSubmit(stay, printDirectThermal);
  };

  // Keyboard Hotkeys: F1 (Cash Customer), F2 (Barcode Focus), F4 (Park Bill), F8 (Parked Bills), F9 (Fast Cash Pay & Print), Alt+N (Add Row), Ctrl+S (Save)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        selectDefaultCashCustomer();
      } else if (e.key === "F2") {
        e.preventDefault();
        setStep(2);
        barcodeInputRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        handleParkCurrentBill();
      } else if (e.key === "F8") {
        e.preventDefault();
        setParkedModalOpen(true);
      } else if (e.key === "F9") {
        e.preventDefault();
        if (!blockReason) {
          submit(true, true);
        } else {
          toast.error(blockReason);
        }
      } else if (e.altKey && (e.key === "n" || e.key === "ن")) {
        e.preventDefault();
        setStep(2);
        addProduct();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "س")) {
        e.preventDefault();
        if (!blockReason) submit(false);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "h" || e.key === "ا")) {
        e.preventDefault();
        toggle();
        toast.info(privacy ? "تم إظهار بيانات الربح" : "تم إخفاء بيانات الربح (وضع الخصوصية)");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <PageHeader
        eyebrow="نظام الكاشير ونقاط البيع (POS & Billing)"
        title="شاشة الكاشير وإصدار الفواتير"
        subtitle="مسح باركود متتالي سريع، تعليق فواتير، ودفع مجزأ نقدياً وإلكترونياً."
        icon={<Receipt className="h-7 w-7" />}
        action={
          <div className="flex items-center gap-2">
            {/* زر الفواتير المعلقة */}
            <Button
              variant="outline"
              onClick={() => setParkedModalOpen(true)}
              className="relative rounded-full gap-1.5 h-10 px-3.5 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              title="الفواتير المعلقة (F8)"
            >
              <PauseCircle className="h-4 w-4" />
              <span className="hidden sm:inline">المعلقة</span>
              {parkedBills.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                  {parkedBills.length}
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className={cn(
                "h-10 w-10 rounded-full transition-colors",
                privacy
                  ? "bg-warning/10 text-warning hover:bg-warning/20"
                  : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10",
              )}
              title={privacy ? "إظهار الأرباح (Ctrl+H)" : "إخفاء الأرباح (Ctrl+H)"}
            >
              {privacy ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
            <span className="rounded-full border border-border/30 bg-foreground/[0.06] px-4 py-2 font-mono text-sm font-bold tracking-wider text-foreground">
              {invoiceCode}
            </span>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/invoices">
                <ArrowRight className="me-1.5 h-4 w-4" />
                رجوع للفواتير
              </Link>
            </Button>
          </div>
        }
      />

      {/* شريط الاختصارات السريعة للكاشير */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-foreground/[0.03] border border-foreground/5 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-foreground flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> اختصارات الكاشير:
          </span>
          <span className="px-2 py-0.5 rounded-md bg-foreground/5 border border-foreground/10 font-mono">
            F1 عميل فوري
          </span>
          <span className="px-2 py-0.5 rounded-md bg-foreground/5 border border-foreground/10 font-mono">
            F2 تركيز الباركود
          </span>
          <span className="px-2 py-0.5 rounded-md bg-foreground/5 border border-foreground/10 font-mono">
            F4 تعليق الفاتورة
          </span>
          <span className="px-2 py-0.5 rounded-md bg-foreground/5 border border-foreground/10 font-mono">
            F8 استرجاع المعلقة
          </span>
          <span className="px-2 py-0.5 rounded-md bg-success/20 text-success border border-success/30 font-mono font-bold">
            F9 بيع وطباعة سريعة
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={selectDefaultCashCustomer}
            className="text-[11px] font-bold text-primary hover:underline"
          >
            اختيار عميل فوري سريع
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ===== العمود الرئيسي ===== */}
        <div className="order-2 space-y-4 text-right lg:order-1">
          {/* الخطوات */}
          <div className="plate flex items-center gap-1.5 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-1.5">
            {[
              { n: 1, label: "العميل والنوع" },
              { n: 2, label: `المنتجات والباركود (${products.length})` },
              { n: 3, label: "الشحن" },
              { n: 4, label: "الدفع والأقساط" },
            ].map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={() => setStep(s.n)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  step === s.n
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-foreground/[0.05]",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black",
                    step === s.n ? "bg-foreground text-background" : "bg-foreground/10",
                  )}
                >
                  {s.n}
                </span>
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              {/* العميل */}
              <div className="rounded-[1.75rem] border border-border/30 p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={selectDefaultCashCustomer}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    + اختيار عميل فوري سريع (F1)
                  </button>
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    العميل
                  </Label>
                </div>
                <Select
                  value={customerId}
                  onValueChange={(v) => {
                    setCustomerId(v);
                    const c = data.customers.find((x) => x.id === v);
                    if (c?.customerType === "cash") {
                      setSaleType("cash");
                      setDown("0");
                      setMonthly("");
                      setCount("");
                    } else if (c) {
                      setSaleType("installments");
                      if (!date) setDate(addMonths(new Date(), 1));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر العميل" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {c.customerType === "cash" ? "فوري" : "قسط"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {customer && customerInfo && (
                  <div className="flex flex-wrap items-center gap-2 animate-[fade-in_0.2s_ease-out]">
                    <CustomerTypeBadge type={customer.customerType} />
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 font-bold",
                        customerInfo.balance > 0
                          ? "bg-danger/10 text-danger border-danger/40"
                          : "bg-foreground/[0.06] text-foreground ring-border",
                      )}
                    >
                      مديونية حالية: {fmt(customerInfo.balance)} ج.م
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-foreground/[0.06] text-muted-foreground ring-border font-bold"
                    >
                      سقف الائتمان:{" "}
                      {customerInfo.limit > 0 ? `${fmt(customerInfo.limit)} ج.م` : "بدون حد"}
                    </Badge>
                    {customerInfo.wouldExceed && (
                      <Badge
                        variant="outline"
                        className="bg-warning/15 text-warning border-warning/40 gap-1"
                      >
                        <ShieldAlert className="w-3 h-3" /> سيتجاوز السقف الائتماني
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {blocked && (
                <div className="rounded-2xl border-2 border-danger/40 bg-danger/10 p-3 text-sm text-danger flex items-start gap-2 animate-[scale-in_0.2s_ease-out]">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <div>
                    هذا العميل {customer?.frozen ? "مجمد" : "مماطل"}. النظام لا يسمح بفتح فاتورة
                    جديدة قبل تسوية حسابه.
                  </div>
                </div>
              )}

              {/* نوع الفاتورة */}
              <div className="rounded-[1.75rem] border border-border/30 p-5 space-y-3">
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  نوع الفاتورة
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: "installments" as const, label: "أقساط", hint: "دفع على دفعات شهرية" },
                    { key: "cash" as const, label: "فوري (نقدي)", hint: "سداد كامل الآن" },
                  ].map((opt) => {
                    const active = saleType === opt.key;
                    const locked = opt.key === "installments" && customer?.customerType === "cash";
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          if (locked) {
                            toast.error(
                              "هذا عميل فوري (نقدي) — غيّر نوع العميل لقسط أولًا لو عايز تقسيط",
                            );
                            return;
                          }
                          setSaleType(opt.key);
                          if (opt.key === "installments" && !date)
                            setDate(addMonths(new Date(), 1));
                          if (opt.key === "cash") setDown("0");
                        }}
                        aria-pressed={active}
                        className={cn(
                          "relative flex flex-col items-center justify-center rounded-2xl p-4 transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                          active
                            ? "bg-foreground text-background"
                            : "bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]",
                          locked && "cursor-not-allowed opacity-40 hover:bg-transparent",
                        )}
                      >
                        <span className="text-lg font-black mb-1">{opt.label}</span>
                        <span className="text-[10px] font-medium opacity-60 leading-tight">
                          {locked ? "غير متاح لعميل فوري" : opt.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {/* ماسح الباركود السريع المتتالي */}
              <form
                onSubmit={handleQuickBarcodeSubmit}
                className="p-3.5 rounded-2xl bg-primary/[0.04] border border-primary/20 flex items-center gap-2"
              >
                <ScanLine className="w-5 h-5 text-primary shrink-0 animate-pulse" />
                <Input
                  ref={barcodeInputRef}
                  value={quickBarcodeInput}
                  onChange={(e) => setQuickBarcodeInput(e.target.value)}
                  placeholder="امسح أو اكتب الباركود واضغط Enter للبيع المتتالي السريع (F2)..."
                  className="h-10 border-primary/20 bg-background text-sm font-mono"
                  autoFocus
                />
                <Button type="submit" size="sm" className="h-10 px-4 shrink-0 font-bold">
                  إضافة
                </Button>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addProduct}
                    className="gap-1.5 rounded-full border border-border/30 px-4 text-muted-foreground hover:bg-foreground/[0.05]"
                  >
                    <Plus className="w-4 h-4" /> إضافة صنف آخر
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setScanOpen(true)}
                    className="gap-1.5 rounded-full border border-border/30 px-4 text-muted-foreground hover:bg-foreground/[0.05]"
                  >
                    <ScanLine className="w-4 h-4" /> كاميرا الباركود
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleParkCurrentBill}
                    className="gap-1.5 rounded-full border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  >
                    <PauseCircle className="w-4 h-4" /> تعليق الفاتورة (F4)
                  </Button>
                </div>
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  المنتجات ({products.length})
                </Label>
              </div>

              <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-[1.75rem] border border-border/30 p-5 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {products.map((p, idx) => {
                    const s = p.stockId
                      ? data.stockItems.find((x) => x.id === p.stockId)
                      : undefined;
                    const qty = Number(p.quantity || 0);
                    const metrics = lineMetrics(p);
                    const lineTotal = metrics.total;
                    const hasVariants = s && s.variants && s.variants.length > 0;

                    return (
                      <motion.div
                        key={p.id}
                        layout
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                        className="divide-y divide-border/30 px-3 py-2.5 rounded-2xl bg-foreground/[0.015] border border-foreground/5"
                      >
                        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_76px_96px_96px_32px]">
                          <div className="min-w-0">
                            {idx === 0 && (
                              <Label className="mb-1 block text-[10px] text-muted-foreground">
                                اسم المنتج
                              </Label>
                            )}
                            <StockProductPicker
                              value={p.stockId}
                              name={p.name}
                              stockItems={data.stockItems}
                              onPick={(item) =>
                                updateProduct(p.id, {
                                  stockId: item.id,
                                  name: item.name,
                                  cost: String(item.lastUnitCost || 0),
                                  price: p.price || (item.salePrice ? String(item.salePrice) : ""),
                                })
                              }
                              onClear={() => updateProduct(p.id, { stockId: undefined, name: "" })}
                            />
                          </div>
                          <div>
                            {idx === 0 && (
                              <Label className="mb-1 block text-[10px] text-muted-foreground">
                                الكمية
                              </Label>
                            )}
                            <Input
                              type="number"
                              min="1"
                              value={p.quantity}
                              onChange={(e) => updateProduct(p.id, { quantity: e.target.value })}
                              className="h-9 bg-white/5 border-white/10 text-center font-bold"
                            />
                          </div>
                          <div>
                            {idx === 0 && (
                              <Label className="mb-1 block text-[10px] text-muted-foreground">
                                التكلفة
                              </Label>
                            )}
                            <Input
                              type="number"
                              value={p.cost}
                              onChange={(e) => updateProduct(p.id, { cost: e.target.value })}
                              className={cn(
                                blurCls,
                                "h-9 bg-white/5 border-white/10 text-center font-bold",
                              )}
                              disabled={hideProfits}
                            />
                          </div>
                          <div>
                            {idx === 0 && (
                              <Label className="mb-1 block text-[10px] text-muted-foreground">
                                سعر البيع
                              </Label>
                            )}
                            <Input
                              type="number"
                              value={p.price}
                              onChange={(e) => updateProduct(p.id, { price: e.target.value })}
                              className="h-9 bg-white/5 border-white/10 text-center font-bold"
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => removeProduct(p.id)}
                              disabled={products.length === 1}
                              className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-danger/10 hover:text-danger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* محدد المقاس / اللون (Variants) إذا كان المنتج يحتوي على تنوعات */}
                        {hasVariants && (
                          <div className="mt-2 pt-2 flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5 text-primary" /> المقاس / اللون:
                            </span>
                            <Select
                              value={p.variantId || ""}
                              onValueChange={(val) => {
                                const matchedVar = s.variants?.find((v) => v.id === val);
                                if (matchedVar) {
                                  updateProduct(p.id, {
                                    variantId: matchedVar.id,
                                    name: `${s.name} (${[matchedVar.size, matchedVar.color].filter(Boolean).join(" - ")})`,
                                    price: String(matchedVar.salePrice || s.salePrice || 0),
                                    cost: String(matchedVar.costPrice || s.lastUnitCost || 0),
                                  });
                                  toast.success(`تم اختيار تنوع: ${matchedVar.size || ""} ${matchedVar.color || ""}`);
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs max-w-[220px]">
                                <SelectValue placeholder="اختر المقاس / اللون..." />
                              </SelectTrigger>
                              <SelectContent>
                                {s.variants?.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {[v.size, v.color].filter(Boolean).join(" / ")} — {v.salePrice} ج.م (متوفر: {v.quantity})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="mt-2 grid grid-cols-1 gap-2 border-t border-border/30 pt-3 sm:grid-cols-[110px_110px_minmax(0,1fr)]">
                          <div>
                            <Label className="mb-1 block text-[10px] text-muted-foreground">خصم البند %</Label>
                            <Input type="number" min="0" max="100" value={p.discount || ""} onChange={(e) => updateProduct(p.id, { discount: e.target.value })} className="h-9 text-center" placeholder="0" />
                          </div>
                          <div>
                            <Label className="mb-1 block text-[10px] text-muted-foreground">ضريبة البند %</Label>
                            <Input type="number" min="0" value={p.taxPct || ""} onChange={(e) => updateProduct(p.id, { taxPct: e.target.value })} className="h-9 text-center" placeholder="0" />
                          </div>
                          <div>
                            <Label className="mb-1 block text-[10px] text-muted-foreground">السيريال / IMEI (افصل بفاصلة)</Label>
                            <Input value={p.serialNumbers || ""} onChange={(e) => updateProduct(p.id, { serialNumbers: e.target.value })} className="h-9 font-mono text-xs" dir="ltr" placeholder="3569… , 3569…" />
                          </div>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="font-bold text-muted-foreground">
                            الصافي: {fmt(lineTotal)} ج.م
                            {(metrics.discount > 0 || metrics.tax > 0) && <span className="mr-2 font-normal">(خصم {fmt(metrics.discount)} • ضريبة {fmt(metrics.tax)})</span>}
                          </span>
                          {s && (
                            <span
                              className={cn(
                                "flex items-center gap-1",
                                s.quantity >= qty && qty > 0 ? "text-success" : "text-danger",
                              )}
                            >
                              <Package className="h-3 w-3" /> المتوفر: {s.quantity}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* الخصم والضريبة */}
              <div className="rounded-[1.75rem] border border-border/30 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-bold",
                      discountValue > 0 ? "text-foreground" : "text-muted-foreground/50",
                    )}
                  >
                    − {fmt(discountValue)} ج.م
                  </span>
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    الخصم
                  </Label>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">بالنسبة %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={discountPct}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDiscountPct(v);
                        const pct = Math.min(100, Math.max(0, Number(v || 0)));
                        setDiscountAmt(v === "" ? "" : String(Math.round((subtotal * pct) / 100)));
                      }}
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-center"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">بالمبلغ (ج.م)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={discountAmt}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDiscountAmt(v);
                        const amt = Math.max(0, Number(v || 0));
                        setDiscountPct(
                          v === "" || subtotal <= 0 ? "" : ((amt / subtotal) * 100).toFixed(1),
                        );
                      }}
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-center"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setDiscountPct(String(n));
                        setDiscountAmt(String(Math.round((subtotal * n) / 100)));
                      }}
                      className="rounded-xl bg-white/[0.05] px-4 py-2 text-[10px] font-black tracking-widest text-muted-foreground/80 hover:bg-foreground/[0.06] hover:text-foreground active:scale-95"
                    >
                      {n}%
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountPct("");
                      setDiscountAmt("");
                    }}
                    className="rounded-xl bg-white/[0.05] px-4 py-2 text-[10px] font-black tracking-widest text-muted-foreground/80 hover:bg-danger/10 hover:text-danger active:scale-95"
                  >
                    مسح
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-white/5 pt-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">معدل الضريبة %</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={taxPct}
                      onChange={(e) => setTaxPct(e.target.value)}
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-center"
                    />
                  </div>
                  <div className="flex flex-col justify-end gap-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{fmt(subtotal)} ج.م</span>
                      <span className="text-muted-foreground">الإجمالي قبل الخصم</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{fmt(taxValue)} ج.م</span>
                      <span className="text-muted-foreground">قيمة الضريبة</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/5 pt-2">
                      <span className="text-base font-black text-foreground">
                        {fmt(totalPrice)} ج.م
                      </span>
                      <span className="text-muted-foreground">الإجمالي النهائي</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-[1.75rem] border border-border/30 p-5 space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <Badge className="gap-1.5 border border-border/30 bg-foreground/[0.06] px-3 py-1 text-muted-foreground">
                    <Truck className="h-3.5 w-3.5" /> تفاصيل الشحن
                  </Badge>
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    اختياري
                  </Label>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">شركة الشحن</Label>
                    <Select value={shippingCarrierId} onValueChange={setShippingCarrierId}>
                      <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-white/[0.04]">
                        <SelectValue placeholder="اختر الشركة" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.carriers
                          .filter((c: any) => c.active)
                          .map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">المنطقة / المحافظة</Label>
                    <Select
                      value={shippingZoneId}
                      onValueChange={setShippingZoneId}
                      disabled={!shippingCarrierId}
                    >
                      <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-white/[0.04]">
                        <SelectValue placeholder="اختر المنطقة" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.zones
                          .filter((z: any) => z.carrierId === shippingCarrierId)
                          .map((z: any) => (
                            <SelectItem key={z.id} value={z.id}>
                              {z.name} ({z.deliveryCost} ج.م)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">عنوان التوصيل</Label>
                  <Input
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder={customer?.address || "اكتب العنوان هنا..."}
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">رقم التتبع (إن وجد)</Label>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="رقم البوليصة"
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04]"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-[1.75rem] border border-border/30 p-5">
                <AnimatePresence mode="wait" initial={false}>
                  {isCashMode ? (
                    <motion.div
                      key="pay-cash"
                      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Badge className="gap-1.5 border border-border/30 bg-foreground/[0.06] px-3 py-1 text-muted-foreground">
                          <Banknote className="h-3.5 w-3.5" /> بيع نقدي
                        </Badge>
                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          تفاصيل السداد
                        </Label>
                      </div>

                      <div className="flex items-baseline justify-between gap-3 rounded-2xl bg-foreground/[0.06] px-4 py-3">
                        <span className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold leading-none tracking-tight text-foreground">
                          {fmt(totalPrice)} ج.م
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          المطلوب دفعه الآن
                        </span>
                      </div>

                      {/* خيار الدفع المجزأ (Split Payment) */}
                      <div className="p-3.5 rounded-2xl bg-foreground/[0.02] border border-foreground/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-primary" />
                            تعدد طرق الدفع (الدفع المجزأ: كاش + إلكتروني)
                          </div>
                          <Switch
                            checked={enableSplitPayment}
                            onCheckedChange={setEnableSplitPayment}
                          />
                        </div>

                        {enableSplitPayment && (
                          <div className="space-y-3 pt-2 border-t border-foreground/5 animate-[fade-in_0.2s_ease-out]">
                            <div className="grid sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs flex items-center gap-1.5">
                                  <Banknote className="w-3.5 h-3.5 text-success" /> المبلغ النقدي (كاش)
                                </Label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={splitCash}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSplitCash(val);
                                    const c = Number(val || 0);
                                    if (totalPrice > c) {
                                      setSplitElectronic(String(Math.round(totalPrice - c)));
                                    }
                                  }}
                                  className="font-bold"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs flex items-center gap-1.5">
                                  <Smartphone className="w-3.5 h-3.5 text-primary" /> المبلغ الإلكتروني
                                </Label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={splitElectronic}
                                  onChange={(e) => setSplitElectronic(e.target.value)}
                                  className="font-bold"
                                />
                              </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">طريقة التحصيل الإلكتروني</Label>
                                <Select
                                  value={splitMethod}
                                  onValueChange={(v) => setSplitMethod(v as any)}
                                >
                                  <SelectTrigger className="h-10">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="instapay">انستاباي (InstaPay)</SelectItem>
                                    <SelectItem value="vodafone_cash">فودافون كاش / محفظة ذكية</SelectItem>
                                    <SelectItem value="visa">فيزا / ماستركارد (POS Card)</SelectItem>
                                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs">الرقم المرجعي / هاتف المحفظة</Label>
                                <Input
                                  value={splitRef}
                                  onChange={(e) => setSplitRef(e.target.value)}
                                  placeholder="رقم العملية أو الهاتف..."
                                  className="h-10 text-xs"
                                />
                              </div>
                            </div>

                            <div className={cn(
                              "p-2 rounded-xl text-xs font-bold flex items-center justify-between",
                              splitDiff < 0.01 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                            )}>
                              <span>مجموع الدفع: {fmt(splitTotal)} ج.م</span>
                              <span>{splitDiff < 0.01 ? "المبلغ متطابق تماماً ✓" : `فرق: ${fmt(splitDiff)} ج.م`}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {!enableSplitPayment && (
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                            المبلغ المستلم من العميل (ج.م)
                          </Label>
                          <Input
                            type="number"
                            value={cashPaid}
                            onChange={(e) => setCashPaid(e.target.value)}
                            placeholder={`${totalPrice || 0}`}
                          />
                          <div className="flex flex-wrap gap-1.5">
                            {[totalPrice, 50, 100, 200, 500]
                              .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
                              .map((v, i) => (
                                <button
                                  key={`${v}-${i}`}
                                  type="button"
                                  onClick={() =>
                                    setCashPaid(String(i === 0 ? v : Number(cashPaid || 0) + v))
                                  }
                                  className="rounded-full bg-foreground/[0.05] px-3 py-1 text-[11px] font-bold text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground active:scale-[0.96]"
                                >
                                  {i === 0 ? "المبلغ بالظبط" : `+ ${fmt(v)}`}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                      {!enableSplitPayment && cashPaidNum > 0 && (
                        <div
                          className={cn(
                            "flex items-baseline justify-between gap-3 rounded-2xl px-4 py-3",
                            cashShort > 0 ? "bg-warning/10" : "bg-success/10",
                          )}
                        >
                          <span
                            className={cn(
                              "text-[clamp(1.1rem,3.5vw,1.5rem)] font-extrabold leading-none tracking-tight",
                              cashShort > 0 ? "text-warning" : "text-success",
                            )}
                          >
                            {fmt(cashShort > 0 ? cashShort : change)} ج.م
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                            {cashShort > 0 ? "ناقص من المبلغ" : "الفكّة للعميل"}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="pay-inst"
                      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          المقدم (ج.م)
                        </Label>
                        <Input
                          type="number"
                          value={down}
                          onChange={(e) => setDown(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                          {[
                            { pct: 0, label: "بدون مقدم" },
                            { pct: 10, label: "10%" },
                            { pct: 25, label: "25%" },
                            { pct: 50, label: "50%" },
                          ].map((btn) => (
                            <button
                              key={btn.pct}
                              type="button"
                              onClick={() =>
                                setDown(String(Math.round((totalPrice * btn.pct) / 100)))
                              }
                              className="rounded-xl bg-white/[0.05] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 hover:bg-foreground/[0.08] hover:text-foreground active:scale-95"
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between gap-3 rounded-2xl bg-foreground/[0.06] px-4 py-3">
                        <span className="text-[clamp(1.25rem,4vw,1.75rem)] font-extrabold leading-none tracking-tight text-foreground">
                          {fmt(remaining)} ج.م
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          المتبقي للتقسيط
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <Label className="text-xs">عدد الأقساط</Label>
                          <Input
                            type="number"
                            value={count}
                            onChange={(e) => setCount(e.target.value)}
                            placeholder="مثال: 6"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">القسط الشهري (ج.م)</Label>
                          <Input
                            type="number"
                            value={monthly}
                            onChange={(e) => setMonthly(e.target.value)}
                            className={cn(countNum > 0 && "border-border/30")}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">تاريخ أول قسط</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-between font-normal text-right",
                                  !date && "text-muted-foreground",
                                )}
                              >
                                {date ? (
                                  <span dir="ltr">{format(date, "dd/MM/yyyy")}</span>
                                ) : (
                                  <span>DD/MM/YYYY</span>
                                )}
                                <CalendarIcon className="h-4 w-4 opacity-60" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      {schedule.length > 0 && (
                        <div className="space-y-2 rounded-2xl border border-border/30 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-muted-foreground">
                              إجمالي المستحق:{" "}
                              <span className="text-foreground">{fmt(totalDue)} ج.م</span>
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                              معاينة جدول الأقساط
                            </span>
                          </div>
                          <div className="max-h-52 space-y-1 overflow-y-auto pl-1 custom-scrollbar">
                            {schedule.map((row) => (
                              <div
                                key={row.n}
                                className="flex items-center justify-between rounded-xl bg-background/60 px-3 py-1.5 text-xs"
                              >
                                <span className="font-extrabold text-foreground">
                                  {fmt(row.amount)} ج.م
                                </span>
                                <span className="text-muted-foreground">
                                  قسط {row.n} —{" "}
                                  <span dir="ltr">{format(row.due, "dd/MM/yyyy")}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ملاحظات */}
              <div className="rounded-[1.75rem] border border-border/30 p-5">
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2 block">
                  ملاحظات إضافية
                </Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات..."
                  maxLength={200}
                  className="bg-transparent border-white/10"
                />
              </div>

              {/* تتبع الربح (مخفي في وضع أمان الكاشير أو الخصوصية) */}
              {!hideProfits && (
                <div className="rounded-[2rem] border border-border/30 p-5 space-y-4 animate-[fade-in_0.2s_ease-out]">
                  <div className="grid grid-cols-2 gap-y-6 gap-x-4 divide-y divide-border/30">
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                        إجمالي التكلفة
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className={cn("text-xl font-bold tracking-tight", blurCls)}>
                          {fmt(totalCost)}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground/40">ج.م</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                        إجمالي سعر البيع
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold tracking-tight">{fmt(totalPrice)}</span>
                        <span className="text-[10px] font-bold text-muted-foreground/40">ج.م</span>
                      </div>
                    </div>
                    <div className="space-y-1 pt-4 border-t border-border/30">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                        صافي الربح
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={cn(
                            "text-3xl font-black tracking-tighter",
                            blurCls,
                            profit > 0
                              ? "text-success"
                              : profit < 0
                                ? "text-danger"
                                : "text-muted-foreground",
                          )}
                        >
                          {fmt(profit)}
                        </span>
                        <span className="text-xs font-bold text-muted-foreground/40">ج.م</span>
                      </div>
                    </div>
                    <div className="space-y-1 pt-4 border-t border-border/30">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                        نسبة الربح
                      </span>
                      <span
                        className={cn(
                          "block text-3xl font-black tracking-tighter",
                          blurCls,
                          profit > 0
                            ? "text-success"
                            : profit < 0
                              ? "text-danger"
                              : "text-muted-foreground",
                        )}
                      >
                        {profitPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* تنقل الخطوات */}
          <div className="hidden items-center justify-between gap-3 lg:flex">
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-6 font-bold"
              disabled={step === 4}
              onClick={() => setStep((s) => Math.min(4, s + 1))}
            >
              الخطوة التالية
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full px-6 text-muted-foreground"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              الخطوة السابقة
            </Button>
          </div>
        </div>

        {/* ===== العمود الجانبي ===== */}
        <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-24 lg:self-start">
          {/* ملخص الفاتورة */}
          <div className="rounded-[2rem] border border-border/30 p-5 space-y-4 text-right">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[10px] font-bold",
                  blockReason
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border border-border/30 bg-foreground/[0.06] text-foreground",
                )}
              >
                {blockReason ? "غير مكتملة" : "جاهزة للحفظ"}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                ملخص الفاتورة
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <Row
                label="عدد الأصناف"
                value={String(products.filter((p) => p.name.trim()).length)}
              />
              <Row label="الإجمالي قبل الخصم" value={`${fmt(subtotal)} ج.م`} />
              {discountValue > 0 && <Row label="الخصم" value={`− ${fmt(discountValue)} ج.م`} />}
              {taxValue > 0 && (
                <Row label={`الضريبة (${Number(taxPct || 0)}%)`} value={`${fmt(taxValue)} ج.م`} />
              )}
              <Row label="إجمالي الفاتورة" value={`${fmt(totalPrice)} ج.م`} />
              <Row
                label={isCashMode ? "المدفوع الآن" : "المقدم"}
                value={`${fmt(isCashMode ? totalPrice : downNum)} ج.م`}
              />
              {!isCashMode && <Row label="المتبقي للتقسيط" value={`${fmt(remaining)} ج.م`} />}
            </div>

            <div className="rounded-2xl bg-foreground/[0.06] px-4 py-4">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {isCashMode ? "المطلوب سداده" : "المقدم الآن"}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black leading-none tracking-tighter text-foreground">
                  {fmt(isCashMode ? totalPrice : downNum)}
                </span>
                <span className="text-xs font-bold text-foreground">ج.م</span>
              </div>
            </div>
          </div>

          {/* الإجراءات السريعة */}
          <div className="rounded-[2rem] border border-border/30 p-5 space-y-3 text-right">
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              الإجراءات
            </span>
            {blockReason && <div className="text-[11px] font-bold text-warning">{blockReason}</div>}

            {/* زر بيع نقدي وطباعة إيصال فوري F9 */}
            <Button
              type="button"
              onClick={() => submit(true, true)}
              disabled={!!blockReason}
              className="h-14 w-full rounded-2xl bg-success text-success-foreground hover:bg-success/90 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-success/20 transition-all active:scale-[0.98]"
            >
              <Printer className="w-5 h-5" />
              <span>دفع فوري وطباعة إيصال (F9)</span>
            </Button>

            <Button
              onClick={() => submit(false, false)}
              disabled={!!blockReason}
              className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-black text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>حفظ الفاتورة (Ctrl+S)</span>
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handleParkCurrentBill}
                className="h-11 rounded-2xl border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-bold"
              >
                <PauseCircle className="w-4 h-4 ml-1" /> تعليق (F4)
              </Button>
              <Button
                variant="outline"
                onClick={() => setParkedModalOpen(true)}
                className="h-11 rounded-2xl text-xs font-bold"
              >
                المعلقة ({parkedBills.length})
              </Button>
            </div>

            <Button
              asChild
              variant="ghost"
              className="h-10 w-full rounded-2xl text-xs text-muted-foreground"
            >
              <Link to="/invoices">إلغاء والعودة</Link>
            </Button>
          </div>
        </aside>
      </div>

      {/* شريط الإجراءات السفلي — للشاشات الصغيرة */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => (step < 4 ? setStep(step + 1) : submit(false))}
            disabled={step === 4 && !!blockReason}
            className="h-12 flex-1 rounded-2xl font-black"
          >
            {step < 4 ? "التالي" : "حفظ الفاتورة"}
          </Button>
          <Button
            onClick={() => submit(true, true)}
            disabled={!!blockReason}
            className="h-12 px-3 rounded-2xl bg-success text-success-foreground font-black"
            title="دفع وطباعة"
          >
            <Printer className="w-5 h-5" />
          </Button>
          <div className="text-right">
            <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              الإجمالي
            </span>
            <span className="text-lg font-black leading-none text-foreground">
              {fmt(totalPrice)}
            </span>
          </div>
        </div>
      </div>
      <div className="h-20 lg:hidden" />

      {/* باركود مودال */}
      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={handleScan}
        title="مسح باركود — إضافة منتج للفاتورة"
      />

      {/* الفواتير المعلقة */}
      <ParkedBillsModal
        open={parkedModalOpen}
        onOpenChange={setParkedModalOpen}
        onSelectBill={handleResumeParkedBill}
      />

      {/* موافقة المدير بالرقم السري للخصومات العالية */}
      <ManagerPinModal
        open={pinModalOpen}
        onOpenChange={setPinModalOpen}
        title="موافقة المدير على الخصم"
        description={`نسبة الخصم (${discountPct}%) تتجاوز الحد المسموح للكاشير (${shop.maxDiscountWithoutPin ?? 5}%). يرجى إدخال الرقم السري للمدير.`}
        onSuccess={() => {
          if (pendingSubmitAction) {
            pendingSubmitAction();
            setPendingSubmitAction(null);
          }
        }}
      />
    </>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-foreground/5 pb-2 last:border-0 last:pb-0">
      <span className={cn("font-extrabold text-foreground", valueClass)}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
