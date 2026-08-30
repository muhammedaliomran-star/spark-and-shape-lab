import { useEffect, useMemo, useRef, useState } from "react";
import { format, addMonths } from "date-fns";
import { Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";
import {
  useDB, db, fmt, customerBalance, useShopSettings, uid, invoiceNumber,
  findStockByBarcode, type StockItem, type Customer
} from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { CustomerTypeBadge } from "@/components/CustomerTypeBadge";
import { usePrivacy } from "@/lib/privacy";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { pdfDocument, openPdfDocument, esc } from "@/lib/pdf-doc";
import { openWhatsAppReceipt } from "@/lib/whatsapp";
import { useHeldInvoices, type HeldInvoiceItem } from "@/lib/held-invoices";
import { ShiftManagerDialog } from "@/components/ShiftManagerDialog";
import { getActiveShift } from "@/lib/shifts";
import { PosSplitPaymentModal, type SplitPaymentDetail } from "@/components/PosSplitPaymentModal";
import { PosQuickRefundModal } from "@/components/PosQuickRefundModal";
import { PosKeyboardHUD } from "@/components/PosKeyboardHUD";
import { broadcastCustomerDisplay } from "@/lib/customer-display";
import {
  Plus, Minus, Trash2, Search, ScanLine, Printer, UserPlus,
  ArrowRight, Eye, EyeOff, Check, X, Sparkles, PauseCircle,
  PlayCircle, MessageCircle, AlertTriangle, Package, Zap,
  Calculator, User, Receipt, Layers, RefreshCw, ShoppingCart,
  Clock, ShieldAlert, Percent, Tag, Tv, Undo2, HeartHandshake
} from "lucide-react";

interface PosCartItem {
  id: string;
  stockId?: string;
  name: string;
  cost: number;
  price: number;
  quantity: number;
  maxStock?: number;
  barcode?: string;
}

export default function PosPageWrapper() {
  return (
    <AppShell>
      <PageTransition>
        <PosPage />
      </PageTransition>
    </AppShell>
  );
}

function PosPage() {
  const data = useDB();
  const { settings: shop } = useShopSettings();
  const { privacy, toggle } = usePrivacy();
  const navigate = useNavigate();
  const { heldList, count: heldCount, saveHeld, removeHeld, clearAll } = useHeldInvoices();

  // Search & Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [scanOpen, setScanOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cart & Active Sale State
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [discountType, setDiscountType] = useState<"pct" | "amt">("amt");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Dialogs
  const [quickCustOpen, setQuickCustOpen] = useState(false);
  const [heldModalOpen, setHeldModalOpen] = useState(false);
  const [custSelectOpen, setCustSelectOpen] = useState(false);
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [completedInvoice, setCompletedInvoice] = useState<{
    id: string;
    code: string;
    total: number;
    paid: number;
    customerName: string;
    customerPhone: string;
    items: PosCartItem[];
    date: Date;
  } | null>(null);

  // Quick New Customer Form State
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");

  const customer = data.customers.find((c) => c.id === customerId);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    data.stockItems.forEach((s) => {
      if (s.itemType && s.itemType.trim()) set.add(s.itemType.trim());
    });
    return ["all", ...Array.from(set)];
  }, [data.stockItems]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let list = data.stockItems;
    if (selectedCategory !== "all") {
      list = list.filter((p) => (p.itemType || "").trim() === selectedCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.size && p.size.toLowerCase().includes(q))
      );
    }
    return list;
  }, [data.stockItems, selectedCategory, search]);

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, it) => sum + it.price * it.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const val = Number(discountValue || 0);
    if (val <= 0) return 0;
    if (discountType === "pct") {
      return Math.min(subtotal, Math.round((subtotal * Math.min(100, val)) / 100));
    }
    return Math.min(subtotal, val);
  }, [subtotal, discountType, discountValue]);

  const total = Math.max(0, subtotal - discountAmount);
  const totalCost = cart.reduce((sum, it) => sum + it.cost * it.quantity, 0);
  const profit = total - totalCost;
  const receivedNum = Number(cashReceived || 0);
  const change = Math.max(0, receivedNum - total);

  // Add Product to Cart
  const addToCart = (product: StockItem) => {
    if (product.quantity <= 0) {
      toast.error(`المنتج "${product.name}" نفد من المخزون!`);
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex((item) => item.stockId === product.id);
      if (idx >= 0) {
        const existing = prev[idx];
        const newQty = existing.quantity + 1;
        if (newQty > product.quantity) {
          toast.warning(`تنبيه: الكمية المطلوبة (${newQty}) أكبر من رصيد المخزن المتاح (${product.quantity})`);
        }
        const next = [...prev];
        next[idx] = { ...existing, quantity: newQty };
        return next;
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          stockId: product.id,
          name: product.name,
          cost: product.lastUnitCost || 0,
          price: product.salePrice || 0,
          quantity: 1,
          maxStock: product.quantity,
          barcode: product.barcode || undefined,
        },
      ];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((it) => {
          if (it.id === id) {
            const nextQty = Math.max(1, it.quantity + delta);
            if (it.maxStock !== undefined && nextQty > it.maxStock) {
              toast.warning(`تنبيه: الكمية (${nextQty}) تتجاوز رصيد المخزن (${it.maxStock})`);
            }
            return { ...it, quantity: nextQty };
          }
          return it;
        })
        .filter((it) => it.quantity > 0);
    });
  };

  const setItemQty = (id: string, qtyStr: string) => {
    const q = Math.max(1, Number(qtyStr) || 1);
    setCart((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          if (it.maxStock !== undefined && q > it.maxStock) {
            toast.warning(`تنبيه: الكمية (${q}) تتجاوز رصيد المخزن (${it.maxStock})`);
          }
          return { ...it, quantity: q };
        }
        return it;
      })
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((it) => it.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountValue("");
    setCashReceived("");
    setNotes("");
    setCustomerId("");
  };

  // Barcode Handler
  const handleBarcodeScanned = (code: string) => {
    setScanOpen(false);
    const found = findStockByBarcode(data.stockItems, code);
    if (!found) {
      toast.error(`لا يوجد منتج بالباركود: ${code}`);
      return;
    }
    addToCart(found);
    toast.success(`تمت إضافة: ${found.name}`);
  };

  // Hold / Park Cart
  const handleHoldCart = () => {
    if (cart.length === 0) {
      toast.error("السلة فارغة، لا يوجد ما يتم تعليقه");
      return;
    }

    const heldItemRows: HeldInvoiceItem[] = cart.map((c) => ({
      id: c.id,
      stockId: c.stockId,
      name: c.name,
      cost: String(c.cost),
      price: String(c.price),
      quantity: String(c.quantity),
    }));

    saveHeld({
      source: "pos",
      customerId: customerId || undefined,
      customerName: customer?.name || (customerId ? "عميل محدد" : "عميل نقدي"),
      customerPhone: customer?.phone || undefined,
      saleType: "cash",
      items: heldItemRows,
      total,
      discountAmt: String(discountAmount),
      notes: notes || undefined,
    });

    toast.success("تم تعليق الفاتورة بنجاح ويمكن استرجاعها في أي وقت");
    clearCart();
  };

  // Restore Held Cart
  const handleRestoreHeld = (held: any) => {
    const restoredItems: PosCartItem[] = held.items.map((it: HeldInvoiceItem) => {
      const stock = it.stockId ? data.stockItems.find((s) => s.id === it.stockId) : undefined;
      return {
        id: it.id || crypto.randomUUID(),
        stockId: it.stockId,
        name: it.name,
        cost: Number(it.cost || 0),
        price: Number(it.price || 0),
        quantity: Number(it.quantity || 1),
        maxStock: stock?.quantity,
      };
    });

    setCart(restoredItems);
    if (held.customerId) setCustomerId(held.customerId);
    if (held.discountAmt) {
      setDiscountType("amt");
      setDiscountValue(held.discountAmt);
    }
    if (held.notes) setNotes(held.notes);

    removeHeld(held.id);
    setHeldModalOpen(false);
    toast.success("تم استرجاع الفاتورة المعلقة إلى السلة");
  };

  // Print Receipt
  const handlePrint = (code: string, invItems: PosCartItem[], invTotal: number, invPaid: number, custName: string) => {
    const cur = shop.currency || "ج.م";
    const itemsRows = invItems.map((it, idx) => `
      <tr>
        <td style="padding:6px;text-align:center;color:#64748b;">${idx + 1}</td>
        <td style="padding:6px;font-weight:600;">${esc(it.name)}</td>
        <td style="padding:6px;text-align:center;">${it.quantity}</td>
        <td style="padding:6px;text-align:left;font-family:monospace;">${fmt(it.price)} ${cur}</td>
        <td style="padding:6px;text-align:left;font-weight:bold;font-family:monospace;">${fmt(it.price * it.quantity)} ${cur}</td>
      </tr>
    `).join("");

    const body = `
    <div style="background:#f8fafc;padding:10px 12px;border-radius:10px;margin-bottom:12px;border:1px solid #e2e8f0;font-size:12px;display:flex;justify-content:space-between;">
      <div><b>العميل:</b> ${esc(custName)}</div>
      <div><b>طريقة الدفع:</b> نقدي (كاش فوري)</div>
      <div><b>التاريخ:</b> ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:12px;">
      <thead>
        <tr style="background:#f1f5f9;border-bottom:2px solid #cbd5e1;color:#475569;">
          <th style="padding:6px;text-align:center;">#</th>
          <th style="padding:6px;text-align:right;">الصنف</th>
          <th style="padding:6px;text-align:center;">الكمية</th>
          <th style="padding:6px;text-align:left;">السعر</th>
          <th style="padding:6px;text-align:left;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
      <tfoot>
        <tr style="border-top:2px solid #cbd5e1;font-weight:bold;background:#f8fafc;">
          <td colspan="4" style="padding:8px;text-align:left;">الإجمالي المدفوع نقداً:</td>
          <td style="padding:8px;text-align:left;font-size:14px;color:#059669;">${fmt(invTotal)} ${cur}</td>
        </tr>
      </tfoot>
    </table>
    `;

    const html = pdfDocument({
      docTitle: `إيصال بيع نقدي ${code}`,
      badge: "إيصال بيع كاش فوري",
      title: `إيصال بيع نقدي ${code}`,
      lede: shop.shopName || "سِجلّي لنقاط البيع السريعة",
      meta: [
        { label: "رقم الإيصال", value: code },
        { label: "الوقت", value: format(new Date(), "HH:mm - dd/MM/yyyy") },
        ...(shop.phone ? [{ label: "الهاتف", value: shop.phone }] : []),
      ],
      kpis: [
        { label: "المبلغ الإجمالي", value: `${fmt(invTotal)} ${cur}`, tone: "brand" },
        { label: "المسدد نقداً", value: `${fmt(invPaid)} ${cur}`, tone: "brand" },
      ],
      body,
      footerNote: shop.footerNote || "شكراً لزيارتكم ونتمنى رؤيتكم مجدداً!",
      paper: shop.printPaper || "roll80",
    });

    openPdfDocument(html, { autoPrint: true, features: "width=880,height=760" });
  };

  // Instant Cash Checkout
  const handleInstantCashCheckout = async (printImmediately = true) => {
    if (cart.length === 0) {
      toast.error("السلة فارغة! اضغط على المنتجات لإضافتها أولاً.");
      return;
    }

    // Stock validation
    for (const it of cart) {
      if (it.stockId) {
        const stock = data.stockItems.find((s) => s.id === it.stockId);
        if (!stock || stock.quantity <= 0) {
          toast.error(`المنتج "${it.name}" غير متاح أو نفد من المخزون`);
          return;
        }
      }
    }

    setSaving(true);
    const invoiceCodeStr = `#${String((data.invoices?.length ?? 0) + 1).padStart(4, "0")}`;
    const custName = customer?.name || "عميل نقدي (كاش)";
    const custPhone = customer?.phone || "";

    try {
      // Find or create default cash customer if none selected
      let targetCustId = customerId;
      if (!targetCustId) {
        const defaultCashCust = data.customers.find(
          (c) => c.name.includes("نقدي") || c.name.includes("كاش") || c.customerType === "cash"
        );
        if (defaultCashCust) {
          targetCustId = defaultCashCust.id;
        } else if (data.customers.length > 0) {
          targetCustId = data.customers[0].id;
        } else {
          // create a quick cash customer
          const newCust = await db.addCustomer({
            name: "عميل نقدي سريع",
            customerType: "cash",
          });
          targetCustId = newCust?.id || "";
        }
      }

      const summary = cart.map((p) => `${p.name}${p.quantity > 1 ? ` ×${p.quantity}` : ""}`).join("، ");
      const itemNotes = `${summary}${notes ? ` — ${notes}` : ""}`;

      // Insert Invoice
      const { data: invData, error: invErr } = await (supabase.from as any)("invoices").insert({
        user_id: await uid(),
        customer_id: targetCustId,
        total: total,
        down_payment: total,
        monthly_installment: 0,
        first_due_date: format(new Date(), "yyyy-MM-dd"),
        notes: itemNotes,
        paid: total,
        discount_pct: discountType === "pct" ? Number(discountValue || 0) : 0,
        discount_amount: discountAmount,
        status: "paid",
        created_at: new Date().toISOString(),
      }).select("id, user_id").single();

      if (invErr) throw invErr;

      // Insert Items
      const itemRows = cart.map((p) => ({
        user_id: invData.user_id,
        invoice_id: invData.id,
        name: p.name,
        cost: p.cost,
        price: p.price,
        quantity: p.quantity,
      }));

      if (itemRows.length > 0) {
        const { error: itemsErr } = await supabase.from("invoice_items").insert(itemRows);
        if (itemsErr) throw itemsErr;
      }

      // Deduct stock
      const deductions = cart
        .filter((p) => p.stockId)
        .map((p) => ({ stockId: p.stockId!, quantity: p.quantity }));
      if (deductions.length > 0) {
        await db.deductStock(deductions);
      }

      toast.success(`تم حفظ فاتورة البيع النقدي ${invoiceCodeStr} بنجاح ✓`);

      const currentCart = [...cart];
      setCompletedInvoice({
        id: invData.id,
        code: invoiceCodeStr,
        total: total,
        paid: total,
        customerName: custName,
        customerPhone: custPhone,
        items: currentCart,
        date: new Date(),
      });

      if (printImmediately) {
        handlePrint(invoiceCodeStr, currentCart, total, total, custName);
      }

      clearCart();
    } catch (e: any) {
      toast.error(e?.message || "تعذر حفظ الفاتورة");
    } finally {
      setSaving(false);
    }
  };

  // Split Payment Checkout Handler
  const handleSplitPaymentConfirm = async (split: SplitPaymentDetail) => {
    if (cart.length === 0) return;
    try {
      setSaving(true);
      const invoiceCodeStr = `#${String((data.invoices?.length ?? 0) + 1).padStart(4, "0")}`;
      const custName = customer?.name || "عميل نقدي سريع";
      const custPhone = customer?.phone || "";

      let targetCustId = customerId;
      if (!targetCustId) {
        const defaultCashCust = data.customers.find((c) => c.name.includes("نقدي") || c.name.includes("كاش"));
        if (defaultCashCust) {
          targetCustId = defaultCashCust.id;
        } else if (data.customers.length > 0) {
          targetCustId = data.customers[0].id;
        } else {
          const newCust = await db.addCustomer({
            name: "عميل نقدي سريع",
            customerType: "cash",
          });
          targetCustId = newCust?.id || "";
        }
      }

      const summary = cart.map((p) => `${p.name}${p.quantity > 1 ? ` ×${p.quantity}` : ""}`).join("، ");
      const paymentParts: string[] = [];
      if (split.cash > 0) paymentParts.push(`كاش: ${fmt(split.cash)} ج.م`);
      if (split.instapay > 0) paymentParts.push(`إنستاباي: ${fmt(split.instapay)} ج.م`);
      if (split.wallet > 0) paymentParts.push(`محفظة: ${fmt(split.wallet)} ج.م`);
      if (split.card > 0) paymentParts.push(`فيزا: ${fmt(split.card)} ج.م`);
      if (split.credit > 0) paymentParts.push(`آجل: ${fmt(split.credit)} ج.م`);

      const splitSummaryStr = `[طرق الدفع: ${paymentParts.join(" + ")}]`;
      const itemNotes = `${summary} — ${splitSummaryStr}${notes ? ` — ${notes}` : ""}${
        split.referenceNotes ? ` (مرجع: ${split.referenceNotes})` : ""
      }`;

      const isFullyPaid = split.credit === 0;

      // Insert Invoice
      const { data: invData, error: invErr } = await (supabase.from as any)("invoices").insert({
        user_id: await uid(),
        customer_id: targetCustId,
        total: total,
        down_payment: split.paidTotal,
        monthly_installment: 0,
        first_due_date: format(new Date(), "yyyy-MM-dd"),
        notes: itemNotes,
        paid: split.paidTotal,
        discount_pct: discountType === "pct" ? Number(discountValue || 0) : 0,
        discount_amount: discountAmount,
        status: isFullyPaid ? "paid" : "pending",
        created_at: new Date().toISOString(),
      }).select("id, user_id").single();

      if (invErr) throw invErr;

      // Insert Items
      const itemRows = cart.map((p) => ({
        user_id: invData.user_id,
        invoice_id: invData.id,
        name: p.name,
        cost: p.cost,
        price: p.price,
        quantity: p.quantity,
      }));

      if (itemRows.length > 0) {
        const { error: itemsErr } = await supabase.from("invoice_items").insert(itemRows);
        if (itemsErr) throw itemsErr;
      }

      // Deduct stock
      const deductions = cart
        .filter((p) => p.stockId)
        .map((p) => ({ stockId: p.stockId!, quantity: p.quantity }));
      if (deductions.length > 0) {
        await db.deductStock(deductions);
      }

      toast.success(`تم حفظ فاتورة الدفع المتعدد ${invoiceCodeStr} بنجاح ✓`);

      const currentCart = [...cart];
      setCompletedInvoice({
        id: invData.id,
        code: invoiceCodeStr,
        total: total,
        paid: split.paidTotal,
        customerName: custName,
        customerPhone: custPhone,
        items: currentCart,
        date: new Date(),
      });

      handlePrint(invoiceCodeStr, currentCart, total, split.paidTotal, custName);
      clearCart();
    } catch (e: any) {
      toast.error(e?.message || "تعذر حفظ الفاتورة");
    } finally {
      setSaving(false);
    }
  };

  // Synchronize with Customer Facing Display (BroadcastChannel & localStorage)
  useEffect(() => {
    broadcastCustomerDisplay({
      shopName: shop.shopName || "سِجلّي",
      shopPhone: shop.phone,
      items: cart.map((c) => ({
        name: c.name,
        price: c.price,
        quantity: c.quantity,
        total: c.price * c.quantity,
      })),
      subtotal,
      discountAmount,
      total,
      customerName: customer?.name,
      status: completedInvoice ? "completed" : cart.length > 0 ? "active" : "idle",
      completedInvoiceCode: completedInvoice?.code,
      paidAmount: completedInvoice?.paid,
      changeDue: change,
      lastUpdated: Date.now(),
    });
  }, [cart, subtotal, discountAmount, total, customer, completedInvoice, change, shop]);

  const handleOpenCustomerDisplay = () => {
    const url = "/pos-display";
    window.open(url, "SegillyCustomerDisplay", "width=1024,height=768,menubar=no,toolbar=no,location=no,status=no");
  };

  // Keyboard Shortcuts (F2, F3, F4, F6, F8, F9, F10, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F3") {
        e.preventDefault();
        setRefundModalOpen(true);
      } else if (e.key === "F4" && cart.length > 0 && !saving) {
        e.preventDefault();
        handleInstantCashCheckout(true);
      } else if (e.key === "F6" && cart.length > 0 && !saving) {
        e.preventDefault();
        setSplitModalOpen(true);
      } else if (e.key === "F8" && cart.length > 0) {
        e.preventDefault();
        handleHoldCart();
      } else if (e.key === "F9") {
        e.preventDefault();
        setHeldModalOpen(true);
      } else if (e.key === "F10") {
        e.preventDefault();
        handleOpenCustomerDisplay();
      } else if (e.key === "Escape" && cart.length > 0) {
        e.preventDefault();
        clearCart();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-2.5rem)] -m-4 md:-m-6 overflow-hidden">
      {/* Top Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-card/80 backdrop-blur-md px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-black shadow-sm">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-base font-extrabold leading-tight text-foreground flex items-center gap-2">
                نقطة البيع السريعة (POS)
                <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary py-0">
                  كاشير سريع
                </Badge>
              </h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                اختيار الأصناف بنقرة واحدة، طباعة الفاتورة، وتعليق الطلبات فورياً.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Quick Refund (F3) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRefundModalOpen(true)}
            className="gap-1.5 rounded-xl border-danger/30 text-danger hover:bg-danger/10 font-bold h-9 text-xs"
            title="مرتجع سريع (F3)"
          >
            <Undo2 className="h-4 w-4" />
            <span className="hidden sm:inline">مرتجع سريع (F3)</span>
            <span className="sm:hidden">مرتجع</span>
          </Button>

          {/* Customer Facing Display (F10) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenCustomerDisplay}
            className="gap-1.5 rounded-xl border-blue-500/30 text-blue-600 hover:bg-blue-500/10 font-bold h-9 text-xs"
            title="فتح شاشة عرض العميل (F10)"
          >
            <Tv className="h-4 w-4" />
            <span className="hidden md:inline">شاشة العميل (F10)</span>
          </Button>

          {/* Shift Management (Z-Report) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShiftDialogOpen(true)}
            className="gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/10 font-bold h-9 text-xs"
          >
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">الوردية (Z-Report)</span>
            <span className="sm:hidden">الوردية</span>
          </Button>

          {/* Held Carts Button with Active Count */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHeldModalOpen(true)}
            className="relative gap-1.5 rounded-xl border-warning/40 text-warning hover:bg-warning/10 font-bold h-9 text-xs"
          >
            <PauseCircle className="h-4 w-4" />
            <span>معلّق (F9)</span>
            {heldCount > 0 && (
              <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-warning text-black text-[10px] font-black px-1 animate-pulse">
                {heldCount}
              </span>
            )}
          </Button>

          {/* Privacy Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className={cn(
              "h-9 w-9 rounded-xl transition-colors",
              privacy ? "bg-warning/10 text-warning" : "text-muted-foreground hover:bg-foreground/5"
            )}
            title={privacy ? "إظهار الأرباح" : "إخفاء الأرباح"}
          >
            {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>

          {/* Detailed Full Invoice Mode Link */}
          <Button asChild variant="outline" size="sm" className="rounded-xl font-bold h-9 text-xs gap-1.5">
            <Link to="/invoices/new">
              <Receipt className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">فاتورة أقساط</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Grid: Products (Left) + Cart Sidebar (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] flex-1 min-h-0 overflow-hidden">
        {/* Products Section */}
        <div className="flex flex-col min-h-0 border-b lg:border-b-0 lg:border-l border-border/40 bg-background/50 p-3 sm:p-4 overflow-hidden">
          {/* Search, Barcode & Category Filters */}
          <div className="space-y-2.5 shrink-0 mb-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث باسم المنتج، الباركود، المقاس... (F2)"
                  className="pr-10 pl-8 h-10 rounded-xl bg-card border-border/60 text-xs font-medium"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setScanOpen(true)}
                className="h-10 gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/10 px-3 shrink-0 font-bold text-xs"
              >
                <ScanLine className="h-4 w-4" />
                <span className="hidden sm:inline">مسح باركود</span>
              </Button>
            </div>

            {/* Category Pills */}
            {categories.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  const label = cat === "all" ? "جميع الأصناف" : cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "rounded-xl px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap shrink-0",
                        active
                          ? "bg-foreground text-background shadow-sm"
                          : "bg-card border border-border/40 text-muted-foreground hover:bg-foreground/[0.05]"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Products Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-3">
                <Package className="h-12 w-12 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-bold">لم يتم العثور على أي منتجات مطابقة</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    جرب البحث بكلمات أخرى أو أضف منتجات جديدة للمخزن.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredProducts.map((p) => {
                  const inCartItem = cart.find((it) => it.stockId === p.id);
                  const isOutOfStock = p.quantity <= 0;
                  const isLowStock = !isOutOfStock && p.quantity <= (p.minStock || 3);

                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => addToCart(p)}
                      className={cn(
                        "relative flex flex-col justify-between text-right p-3 rounded-2xl border transition-all duration-150 group",
                        isOutOfStock
                          ? "bg-muted/30 border-border/30 opacity-50 cursor-not-allowed"
                          : inCartItem
                            ? "bg-primary/[0.04] border-primary/40 ring-2 ring-primary/20 shadow-sm"
                            : "bg-card border-border/50 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5"
                      )}
                    >
                      {/* In-Cart Badge */}
                      {inCartItem && (
                        <span className="absolute top-2 left-2 grid h-6 min-w-[24px] place-items-center rounded-full bg-primary text-primary-foreground font-black text-xs px-1 shadow">
                          {inCartItem.quantity}
                        </span>
                      )}

                      {/* Top Info: Name & Barcode */}
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                          {p.name}
                        </div>
                        {p.size && (
                          <span className="inline-block mt-0.5 text-[10px] text-muted-foreground/80 bg-foreground/5 px-1.5 py-0.2 rounded">
                            مقاس: {p.size}
                          </span>
                        )}
                      </div>

                      {/* Bottom Info: Price & Stock Status */}
                      <div className="mt-3 pt-2 border-t border-border/30 flex items-end justify-between gap-1">
                        <div>
                          <div className="font-black text-sm sm:text-base font-mono text-primary">
                            {fmt(p.salePrice || 0)} <span className="text-[10px] font-normal text-muted-foreground">ج.م</span>
                          </div>
                          {!privacy && p.lastUnitCost > 0 && (
                            <div className="text-[9px] text-muted-foreground font-mono">
                              ت: {fmt(p.lastUnitCost)} ج.م
                            </div>
                          )}
                        </div>

                        {/* Live Stock Indicators */}
                        <div className="text-left shrink-0">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-danger bg-danger/10 px-1.5 py-0.5 rounded-md">
                              نفد
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-warning bg-warning/15 px-1.5 py-0.5 rounded-md animate-pulse">
                              باقي {p.quantity}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-medium">
                              المخزن: <b className="text-foreground">{p.quantity}</b>
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart & Fast Checkout Sidebar */}
        <div className="flex flex-col min-h-0 bg-card p-3.5 sm:p-4 space-y-3 shadow-lg">
          {/* Customer Selection Row */}
          <div className="p-2.5 rounded-2xl border border-border/40 bg-foreground/[0.02] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground truncate">
                  {customer ? customer.name : "عميل نقدي سريع"}
                </div>
                <div className="text-[10px] text-muted-foreground truncate" dir="ltr">
                  {customer?.phone || "مبيعات فورية نقدية"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCustSelectOpen(true)}
                className="h-8 text-xs font-bold px-2 rounded-xl text-primary hover:bg-primary/10"
              >
                {customer ? "تغيير" : "تحديد عميل"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuickCustOpen(true)}
                className="h-8 w-8 rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                title="إضافة عميل جديد سريع"
              >
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 custom-scrollbar pr-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground space-y-2 border-2 border-dashed border-border/40 rounded-2xl">
                <ShoppingCart className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-xs font-bold">السلة فارغة</p>
                <p className="text-[11px] text-muted-foreground/70">
                  اضغط على الأصناف لإضافتها مباشرة للفاتورة.
                </p>
              </div>
            ) : (
              cart.map((item) => {
                const itemTotal = item.price * item.quantity;
                const isShortage = item.maxStock !== undefined && item.quantity > item.maxStock;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "p-2.5 rounded-xl border bg-background space-y-1.5 transition-colors",
                      isShortage ? "border-danger/60 bg-danger/[0.02]" : "border-border/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-foreground truncate">{item.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {fmt(item.price)} ج.م للقطعة
                        </div>
                      </div>
                      <div className="font-black text-xs font-mono text-primary shrink-0">
                        {fmt(itemTotal)} ج.م
                      </div>
                    </div>

                    {isShortage && (
                      <div className="text-[10px] text-danger font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        الكمية المطلوبة تتجاوز المخزون ({item.maxStock} متاح)
                      </div>
                    )}

                    {/* Quantity & Delete Controls */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/20">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="h-6 w-6 rounded-lg bg-foreground/[0.06] text-foreground hover:bg-foreground/10 grid place-items-center transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => setItemQty(item.id, e.target.value)}
                          className="h-6 w-12 text-center rounded-lg border border-border/50 text-xs font-black font-mono bg-background"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="h-6 w-6 rounded-lg bg-foreground/[0.06] text-foreground hover:bg-foreground/10 grid place-items-center transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-muted-foreground hover:text-danger p-1 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Calculations & Quick Bills */}
          <div className="space-y-2.5 pt-2 border-t border-border/40 shrink-0">
            {/* Quick Discount Controls & Margin Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">الخصم:</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-16 h-7 text-center rounded-lg border border-border/50 text-xs font-mono bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => setDiscountType(discountType === "amt" ? "pct" : "amt")}
                    className="h-7 px-1.5 rounded-lg bg-foreground/5 text-[10px] font-bold border border-border/40"
                  >
                    {discountType === "amt" ? "ج.م" : "%"}
                  </button>
                </div>

                {/* Preset quick discount buttons */}
                <div className="flex items-center gap-1">
                  {[5, 10, 15].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setDiscountType("pct");
                        setDiscountValue(String(pct));
                      }}
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors",
                        discountType === "pct" && discountValue === String(pct)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 border-border/60 hover:bg-muted text-muted-foreground"
                      )}
                    >
                      {pct}%
                    </button>
                  ))}
                  {discountValue && (
                    <button
                      type="button"
                      onClick={() => setDiscountValue("")}
                      className="px-1 py-0.5 text-[10px] text-muted-foreground hover:text-danger"
                      title="إلغاء الخصم"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {discountAmount > 0 && (
                  <span className="text-xs font-bold text-danger">
                    − {fmt(discountAmount)} ج.م
                  </span>
                )}
              </div>

              {/* Floor Price Protection / Margin Alert (Hidden if privacy mode active) */}
              {!privacy && cart.length > 0 && (
                <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-muted/40 border border-border/40">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">هامش الربح:</span>
                    <span className={cn("font-bold font-mono", profit >= 0 ? "text-success" : "text-danger")}>
                      {fmt(profit)} ج.م {subtotal > 0 ? `(${Math.round((profit / subtotal) * 100)}%)` : ""}
                    </span>
                  </div>
                  {profit < 0 && (
                    <span className="text-[10px] font-bold text-danger flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      تنبيه: الخصم نزل عن سعر التكلفة!
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Total Big Display */}
            <div className="p-3 rounded-2xl bg-foreground text-background flex items-center justify-between shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-background/80">
                المجموع المستحق
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono">
                {fmt(total)} <span className="text-xs font-normal">ج.م</span>
              </span>
            </div>

            {/* Quick Cash Bills Helper */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  placeholder="المبلغ المدفوع كاش..."
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="h-8 text-xs font-mono text-center rounded-xl bg-background"
                />
                {change > 0 && (
                  <div className="text-xs font-bold text-success whitespace-nowrap px-2 py-1 bg-success/10 rounded-xl">
                    الباقي: {fmt(change)} ج.م
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {[50, 100, 200, 500].map((bill) => (
                  <button
                    key={bill}
                    type="button"
                    onClick={() => setCashReceived(String(bill))}
                    className="flex-1 py-1 rounded-lg bg-foreground/[0.04] hover:bg-foreground/10 text-[10px] font-bold font-mono text-muted-foreground transition-colors"
                  >
                    {bill}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCashReceived(String(total))}
                  className="flex-1 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-[10px] font-bold font-mono text-primary transition-colors"
                >
                  بالضبط
                </button>
              </div>
            </div>

            {/* Action Buttons: Instant Cash vs Split Payment vs Hold vs Clear */}
            <div className="space-y-1.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <Button
                  type="button"
                  disabled={cart.length === 0 || saving}
                  onClick={() => handleInstantCashCheckout(true)}
                  className="h-11 rounded-2xl bg-success hover:bg-success/90 text-white font-extrabold text-xs gap-1.5 shadow-md transition-all active:scale-[0.99]"
                >
                  <Zap className="h-4 w-4" />
                  <span>{saving ? "جاري الحفظ..." : "⚡ كاش فوري (F4)"}</span>
                </Button>

                <Button
                  type="button"
                  disabled={cart.length === 0 || saving}
                  onClick={() => setSplitModalOpen(true)}
                  className="h-11 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs gap-1.5 shadow-md transition-all active:scale-[0.99]"
                >
                  <Layers className="h-4 w-4" />
                  <span>دفع متعدد (F6)</span>
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cart.length === 0}
                  onClick={handleHoldCart}
                  className="rounded-xl border-warning/40 text-warning hover:bg-warning/10 font-bold h-8 text-xs gap-1"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  <span>تعليق (F8)</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={cart.length === 0}
                  onClick={clearCart}
                  className="rounded-xl text-muted-foreground hover:text-danger hover:bg-danger/10 font-bold h-8 text-xs gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>مسح (Esc)</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Bottom HUD */}
      <PosKeyboardHUD
        onSearchFocus={() => searchInputRef.current?.focus()}
        onInstantCheckout={() => cart.length > 0 && handleInstantCashCheckout(true)}
        onSplitPayment={() => cart.length > 0 && setSplitModalOpen(true)}
        onQuickRefund={() => setRefundModalOpen(true)}
        onHoldCart={handleHoldCart}
        onRecallHeld={() => setHeldModalOpen(true)}
        onCustomerDisplay={handleOpenCustomerDisplay}
        onClearCart={clearCart}
        heldCount={heldCount}
        cartCount={cart.length}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={handleBarcodeScanned}
      />

      {/* Quick Add Customer Dialog */}
      <Dialog open={quickCustOpen} onOpenChange={setQuickCustOpen}>
        <DialogContent className="max-w-md rounded-3xl text-right" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              تسجيل عميل جديد سريع
            </DialogTitle>
            <DialogDescription className="text-xs">
              أدخل بيانات العميل ليتم اختياره فورياً للفاتورة الحالية.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold">اسم العميل *</Label>
              <Input
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="مثال: محمد أحمد"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">رقم الهاتف</Label>
              <Input
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                placeholder="010XXXXXXXX"
                dir="ltr"
                className="h-10 rounded-xl font-mono text-right"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">العنوان أو المنطقة</Label>
              <Input
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                placeholder="مثال: وسط البلد"
                className="h-10 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuickCustOpen(false)}
              className="rounded-xl text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!newCustName.trim()) return toast.error("يرجى إدخال اسم العميل");
                try {
                  const created = await db.addCustomer({
                    name: newCustName.trim(),
                    phone: newCustPhone.trim(),
                    address: newCustAddress.trim(),
                    customerType: "cash",
                  });
                  if (created?.id) {
                    setCustomerId(created.id);
                  }
                  toast.success(`تم تسجيل واختيار العميل: ${newCustName}`);
                  setQuickCustOpen(false);
                  setNewCustName("");
                  setNewCustPhone("");
                  setNewCustAddress("");
                } catch (e: any) {
                  toast.error(e?.message || "تعذر إضافة العميل");
                }
              }}
              className="rounded-xl text-xs font-bold bg-primary text-primary-foreground"
            >
              حفظ واختيار العميل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Selection Modal */}
      <Dialog open={custSelectOpen} onOpenChange={setCustSelectOpen}>
        <DialogContent className="max-w-md rounded-3xl text-right" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              اختيار العميل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              className="h-10 rounded-xl text-xs"
            />
            <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
              <button
                type="button"
                onClick={() => {
                  setCustomerId("");
                  setCustSelectOpen(false);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-foreground/5 text-right font-bold text-xs"
              >
                <span>عميل نقدي سريع (افتراضي)</span>
                <Badge variant="secondary" className="text-[10px]">كاش</Badge>
              </button>
              {data.customers
                .filter(
                  (c) =>
                    !customerSearch.trim() ||
                    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                    c.phone?.includes(customerSearch)
                )
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCustomerId(c.id);
                      setCustSelectOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-foreground/5 text-right transition-colors"
                  >
                    <div>
                      <div className="font-bold text-xs text-foreground">{c.name}</div>
                      {c.phone && <div className="text-[10px] text-muted-foreground font-mono" dir="ltr">{c.phone}</div>}
                    </div>
                    <CustomerTypeBadge type={c.customerType} />
                  </button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Held Invoices Modal */}
      <Dialog open={heldModalOpen} onOpenChange={setHeldModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl text-right" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-warning" />
              الفواتير المعلقة ({heldCount})
            </DialogTitle>
            <DialogDescription className="text-xs">
              قائمة بسلات المشتريات المعلقة مؤقتاً. يمكنك استرجاع أي سلة لإكمال البيع.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto space-y-2 py-2 custom-scrollbar">
            {heldList.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                <PauseCircle className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p>لا توجد أي فواتير معلقة حالياً.</p>
              </div>
            ) : (
              heldList.map((held) => (
                <div
                  key={held.id}
                  className="p-3 rounded-2xl border border-border/50 bg-background flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-foreground flex items-center gap-2">
                      <span>{held.customerName || "عميل نقدي"}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {format(new Date(held.createdAt), "HH:mm - dd/MM")}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {held.items.length} أصناف • إجمالي: <b className="text-primary font-mono">{fmt(held.total)} ج.م</b>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleRestoreHeld(held)}
                      className="rounded-xl font-bold h-8 text-xs bg-primary text-primary-foreground gap-1"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      <span>استرجاع</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHeld(held.id)}
                      className="h-8 w-8 rounded-xl text-muted-foreground hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          {heldList.length > 0 && (
            <DialogFooter className="justify-between sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-xs text-danger hover:bg-danger/10"
              >
                مسح كل المعلق
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setHeldModalOpen(false)}
                className="rounded-xl text-xs"
              >
                إغلاق
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Shift Manager Dialog (Z-Report) */}
      <ShiftManagerDialog
        open={shiftDialogOpen}
        onOpenChange={setShiftDialogOpen}
      />

      {/* Invoice Completed Modal (Print + WhatsApp) */}
      <Dialog open={!!completedInvoice} onOpenChange={(open) => !open && setCompletedInvoice(null)}>
        <DialogContent className="max-w-md rounded-3xl text-right" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-success">
              <Check className="h-6 w-6 rounded-full bg-success/15 p-1 text-success" />
              تم حفظ فاتورة البيع {completedInvoice?.code} بنجاح!
            </DialogTitle>
            <DialogDescription className="text-xs">
              المبلغ المسدد نقداً: <b className="text-foreground font-mono">{fmt(completedInvoice?.total || 0)} ج.م</b>
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-2">
            <div className="p-3 rounded-2xl bg-foreground/[0.02] border border-border/40 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">العميل:</span>
                <span className="font-bold text-foreground">{completedInvoice?.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">عدد الأصناف:</span>
                <span className="font-bold font-mono">{completedInvoice?.items.length}</span>
              </div>
              <div className="flex justify-between font-bold text-primary pt-1 border-t border-border/30">
                <span>الإجمالي المدفوع:</span>
                <span className="font-mono">{fmt(completedInvoice?.total || 0)} ج.م</span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {/* WhatsApp Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!completedInvoice) return;
                openWhatsAppReceipt({
                  shopName: shop.shopName || "سِجلّي",
                  shopPhone: shop.phone,
                  invoiceCode: completedInvoice.code,
                  customerName: completedInvoice.customerName,
                  customerPhone: completedInvoice.customerPhone,
                  invoiceDate: completedInvoice.date,
                  isCash: true,
                  total: completedInvoice.total,
                  downPayment: completedInvoice.total,
                  remaining: 0,
                  items: completedInvoice.items.map((i) => ({
                    name: i.name,
                    quantity: i.quantity,
                    price: i.price,
                  })),
                });
              }}
              className="rounded-xl border-success/40 text-success hover:bg-success/10 font-bold text-xs gap-1.5 flex-1"
            >
              <MessageCircle className="h-4 w-4" />
              <span>إرسال واتساب</span>
            </Button>

            {/* Print Button */}
            <Button
              type="button"
              onClick={() => {
                if (!completedInvoice) return;
                handlePrint(
                  completedInvoice.code,
                  completedInvoice.items,
                  completedInvoice.total,
                  completedInvoice.paid,
                  completedInvoice.customerName
                );
              }}
              className="rounded-xl font-bold text-xs gap-1.5 flex-1 bg-primary text-primary-foreground"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة الإيصال</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Payment Modal (F6) */}
      <PosSplitPaymentModal
        open={splitModalOpen}
        onOpenChange={setSplitModalOpen}
        totalAmount={total}
        customerName={customer?.name}
        onConfirm={handleSplitPaymentConfirm}
      />

      {/* Quick Refund / Return Modal (F3) */}
      <PosQuickRefundModal
        open={refundModalOpen}
        onOpenChange={setRefundModalOpen}
        onRefundCompleted={() => {
          // optionally refresh data or state
        }}
      />
    </div>
  );
}
