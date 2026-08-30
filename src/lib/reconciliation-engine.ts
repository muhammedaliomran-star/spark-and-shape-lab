import { DBState, Invoice, Customer, Supplier, StockItem, Shipment, ReturnRecord, fmt, db } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { pdfDocument, openPdfDocument, esc } from "@/lib/pdf-doc";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export type ReconciliationCategory =
  | "all"
  | "invoices"
  | "customers"
  | "suppliers"
  | "stock"
  | "shipments"
  | "returns";

export type ReconciliationSeverity = "critical" | "warning" | "notice";

export type ReconciliationFixType =
  | "recompute_invoice_paid"
  | "set_invoice_status_paid"
  | "set_invoice_status_pending"
  | "fix_stock_cost"
  | "settle_shipment"
  | "edit_target";

export interface ReconciliationFinding {
  id: string;
  category: ReconciliationCategory;
  severity: ReconciliationSeverity;
  title: string;
  description: string;
  impact: string;
  differenceAmount?: number;
  targetId: string;
  targetType: "invoice" | "customer" | "supplier" | "stock_item" | "shipment" | "return";
  targetLabel: string;
  autoFixable: boolean;
  fixType?: ReconciliationFixType;
  fixPayload?: any;
  details?: Record<string, string | number | null | undefined>;
}

export interface ReconciliationSummary {
  findings: ReconciliationFinding[];
  healthScore: number;
  totalDiscrepancyAmount: number;
  criticalCount: number;
  warningCount: number;
  noticeCount: number;
  autoFixableCount: number;
  categoryCounts: Record<ReconciliationCategory, number>;
  totalAuditedRecords: {
    invoices: number;
    payments: number;
    customers: number;
    suppliers: number;
    stockItems: number;
    shipments: number;
    returns: number;
  };
}

export function runComprehensiveReconciliation(
  data: DBState,
  movements?: Array<{ stock_item_id: string; quantity: number }>
): ReconciliationSummary {
  const findings: ReconciliationFinding[] = [];

  // ==========================================
  // 1. تدقيق الفواتير والدفعات (Invoices & Payments)
  // ==========================================
  const paymentsByInvoice = new Map<string, number>();
  for (const payment of data.payments) {
    paymentsByInvoice.set(
      payment.invoiceId,
      (paymentsByInvoice.get(payment.invoiceId) ?? 0) + Number(payment.amount || 0)
    );
  }

  const customerMap = new Map<string, Customer>();
  for (const c of data.customers) customerMap.set(c.id, c);

  for (const invoice of data.invoices) {
    const customer = customerMap.get(invoice.customerId);
    const customerName = customer?.name || "عميل غير معروف";
    const invoiceLabel = `فاتورة #${invoice.id.slice(0, 8)} (${customerName})`;

    const downPayment = Number(invoice.downPayment || 0);
    const recordedPaid = Number(invoice.paid || 0);
    const actualPaymentsSum = paymentsByInvoice.get(invoice.id) ?? 0;
    const expectedPaid = downPayment + actualPaymentsSum;
    const invoiceTotal = Number(invoice.total || 0);

    // فرق تحصيل المبلغ المسدد
    if (Math.abs(recordedPaid - expectedPaid) > 0.01) {
      const diff = Math.abs(recordedPaid - expectedPaid);
      findings.push({
        id: `inv-paid-mismatch-${invoice.id}`,
        category: "invoices",
        severity: "critical",
        title: `فرق تحصيل مسجل في الفاتورة #${invoice.id.slice(0, 8)}`,
        description: `المبلغ المسدد المسجل على الفاتورة (${fmt(recordedPaid)} ج.م) لا يطابق مجموع الدفعات الفعلية + المقدم (${fmt(expectedPaid)} ج.م).`,
        impact: `تشويه صافي أرباح الفاتورة والمديونية الحقيقية بفارق ${fmt(diff)} ج.م.`,
        differenceAmount: diff,
        targetId: invoice.id,
        targetType: "invoice",
        targetLabel: invoiceLabel,
        autoFixable: true,
        fixType: "recompute_invoice_paid",
        fixPayload: { invoiceId: invoice.id, expectedPaid },
        details: {
          "المسدد الحالي": `${fmt(recordedPaid)} ج.م`,
          "المقدم": `${fmt(downPayment)} ج.م`,
          "مجموع إيصالات السداد": `${fmt(actualPaymentsSum)} ج.م`,
          "المفروض حسابه": `${fmt(expectedPaid)} ج.م`,
        },
      });
    }

    // عدم تطابق حالة الفاتورة (مدفوعة بالكامل لكن حالتها pending)
    if (
      invoice.status !== "cancelled" &&
      recordedPaid >= invoiceTotal &&
      invoiceTotal > 0 &&
      invoice.status !== "paid"
    ) {
      findings.push({
        id: `inv-status-paid-${invoice.id}`,
        category: "invoices",
        severity: "notice",
        title: `فاتورة مسددة بالكامل لكن حالتها ما زالت «معلقة»`,
        description: `تم سداد كامل قيمة الفاتورة (${fmt(recordedPaid)} من ${fmt(invoiceTotal)} ج.م) ولكن لم يتم تحديث حالتها إلى «مسددة».`,
        impact: "تظهر الفاتورة بالخطأ في قوائم التحصيل والمتابعة.",
        targetId: invoice.id,
        targetType: "invoice",
        targetLabel: invoiceLabel,
        autoFixable: true,
        fixType: "set_invoice_status_paid",
        fixPayload: { invoiceId: invoice.id, status: "paid" },
      });
    }

    // عدم تطابق حالة الفاتورة (متبقي عليها مبالغ لكن حالتها paid)
    if (
      invoice.status !== "cancelled" &&
      recordedPaid < invoiceTotal &&
      invoice.status === "paid"
    ) {
      const remaining = invoiceTotal - recordedPaid;
      findings.push({
        id: `inv-status-pending-${invoice.id}`,
        category: "invoices",
        severity: "warning",
        title: `فاتورة مسجلة كـ «مسددة» وعليها متبقي مالي`,
        description: `الفاتورة تحمل حالة «مسددة» على الرغم من وجود متبقي مستحق قدره ${fmt(remaining)} ج.م.`,
        impact: "خطر ضياع مديونية وتوقف إشعارات المتابعة والتحصيل.",
        differenceAmount: remaining,
        targetId: invoice.id,
        targetType: "invoice",
        targetLabel: invoiceLabel,
        autoFixable: true,
        fixType: "set_invoice_status_pending",
        fixPayload: { invoiceId: invoice.id, status: "pending" },
      });
    }

    // تحصيل فائض أكبر من الإجمالي
    if (invoice.status !== "cancelled" && recordedPaid > invoiceTotal + 0.05) {
      const overpaid = recordedPaid - invoiceTotal;
      findings.push({
        id: `inv-overpaid-${invoice.id}`,
        category: "invoices",
        severity: "warning",
        title: `تحصيل زائد في الفاتورة #${invoice.id.slice(0, 8)}`,
        description: `إجمالي التحصيلات (${fmt(recordedPaid)} ج.م) يتجاوز إجمالي الفاتورة (${fmt(invoiceTotal)} ج.م) بمقدار ${fmt(overpaid)} ج.م.`,
        impact: "رصيد معلق للعميل يحتاج مراجعة أو تسوية سند قبض.",
        differenceAmount: overpaid,
        targetId: invoice.id,
        targetType: "invoice",
        targetLabel: invoiceLabel,
        autoFixable: false,
        fixType: "edit_target",
      });
    }

    // بنود الفاتورة وفحص التكلفة
    const items = data.invoiceItems.filter((it) => it.invoiceId === invoice.id);
    if (invoice.status !== "cancelled") {
      if (items.length === 0) {
        findings.push({
          id: `inv-no-items-${invoice.id}`,
          category: "invoices",
          severity: "warning",
          title: `فاتورة بدون تفاصيل أصناف #${invoice.id.slice(0, 8)}`,
          description: "الفاتورة مسجلة بدون بنود أصناف تفصيلية، مما يمنع احتساب تكلفة البضاعة المباعة بدقة.",
          impact: "استبعاد الفاتورة جزئياً من تحليلات الربحية والمخزون.",
          targetId: invoice.id,
          targetType: "invoice",
          targetLabel: invoiceLabel,
          autoFixable: false,
          fixType: "edit_target",
        });
      } else {
        const zeroCostItems = items.filter((it) => Number(it.cost || 0) <= 0);
        if (zeroCostItems.length > 0) {
          findings.push({
            id: `inv-zero-cost-${invoice.id}`,
            category: "invoices",
            severity: "warning",
            title: `أصناف بتكلفة صفرية في الفاتورة #${invoice.id.slice(0, 8)}`,
            description: `يوجد ${zeroCostItems.length} صنف مسجل بتكلفة 0 ج.م (${zeroCostItems.map((i) => i.name).join("، ")}).`,
            impact: "تضخيم هامش الربح المحاسبي بصورة غير واقعية.",
            targetId: invoice.id,
            targetType: "invoice",
            targetLabel: invoiceLabel,
            autoFixable: false,
            fixType: "edit_target",
          });
        }
      }
    }
  }

  // ==========================================
  // 2. تدقيق حسابات العملاء والأقساط (Customers)
  // ==========================================
  for (const customer of data.customers) {
    const custInvoices = data.invoices.filter(
      (inv) => inv.customerId === customer.id && inv.status !== "cancelled"
    );
    const totalInvoiced = custInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const totalPaid = custInvoices.reduce((sum, inv) => sum + Number(inv.paid || 0), 0);
    const openingBalance = Number(customer.openingBalance || 0);
    const currentDebt = Math.max(0, openingBalance + totalInvoiced - totalPaid);

    // سقف الائتمان المتجاوز
    const limit = Number(customer.creditLimit || 0);
    if (limit > 0 && currentDebt > limit) {
      const overLimit = currentDebt - limit;
      findings.push({
        id: `cust-credit-limit-${customer.id}`,
        category: "customers",
        severity: "warning",
        title: `تجاوز سقف الائتمان للعميل «${customer.name}»`,
        description: `المديونية الحالية (${fmt(currentDebt)} ج.م) تتجاوز الحد الائتماني المصرح (${fmt(limit)} ج.م) بمقدار ${fmt(overLimit)} ج.م.`,
        impact: "خطر ائتماني يستوجب تجميد المبيعات الآجلة الإضافية.",
        differenceAmount: overLimit,
        targetId: customer.id,
        targetType: "customer",
        targetLabel: customer.name,
        autoFixable: false,
        fixType: "edit_target",
        details: {
          "المديونية الحالية": `${fmt(currentDebt)} ج.م`,
          "سقف الائتمان": `${fmt(limit)} ج.م`,
          "المبلغ المتجاوز": `${fmt(overLimit)} ج.م`,
        },
      });
    }

    // عميل نقدي (فوري) ولديه مديونية مفتوحة
    if (customer.customerType === "cash" && currentDebt > 1) {
      findings.push({
        id: `cust-cash-debt-${customer.id}`,
        category: "customers",
        severity: "warning",
        title: `عميل فوري (نقدي) لديه مديونية معلقة`,
        description: `العميل «${customer.name}» مصنف كعميل نقدي، لكن حسابه يسجل مديونية غير محصلة قدرها ${fmt(currentDebt)} ج.م.`,
        impact: "مخالفة لسياسة البيع النقدي المباشر.",
        differenceAmount: currentDebt,
        targetId: customer.id,
        targetType: "customer",
        targetLabel: customer.name,
        autoFixable: false,
        fixType: "edit_target",
      });
    }

    // عميل مجمد ولديه فواتير نشطة غير مسددة
    if (customer.frozen && currentDebt > 0) {
      findings.push({
        id: `cust-frozen-active-${customer.id}`,
        category: "customers",
        severity: "notice",
        title: `عميل مجمّد وعليه مديونية معلقة «${customer.name}»`,
        description: `حساب العميل مجمّد حالياً وعليه متبقي مستحق قدره ${fmt(currentDebt)} ج.م.`,
        impact: "يجب تحصيل المتبقي قبل إعادة تفعيل الحساب.",
        differenceAmount: currentDebt,
        targetId: customer.id,
        targetType: "customer",
        targetLabel: customer.name,
        autoFixable: false,
        fixType: "edit_target",
      });
    }
  }

  // ==========================================
  // 3. تدقيق الموردين والمشتريات (Suppliers)
  // ==========================================
  const supplierPaymentsMap = new Map<string, number>();
  for (const sp of data.supplierPayments) {
    supplierPaymentsMap.set(
      sp.supplierId,
      (supplierPaymentsMap.get(sp.supplierId) ?? 0) + Number(sp.amount || 0)
    );
  }

  for (const supplier of data.suppliers) {
    const suppPurchases = data.purchases.filter((p) => p.supplierId === supplier.id);
    const creditPurchasesTotal = suppPurchases
      .filter((p) => p.paymentType === "credit")
      .reduce((sum, p) => sum + Number(p.total || 0), 0);
    const openingBalance = Number(supplier.openingBalance || 0);
    const totalPayments = supplierPaymentsMap.get(supplier.id) ?? 0;
    const balanceDue = openingBalance + creditPurchasesTotal - totalPayments;

    // رصيد سالب للمورد (تم سداد مبالغ أكبر من المشتريات الآجلة)
    if (balanceDue < -0.5) {
      const overpaid = Math.abs(balanceDue);
      findings.push({
        id: `supp-negative-balance-${supplier.id}`,
        category: "suppliers",
        severity: "warning",
        title: `رصيد دائن للمنشأة لدى المورد «${supplier.name}»`,
        description: `مجموع سدادات المورد (${fmt(totalPayments)} ج.م) تتجاوز إجمالي المشتريات الآجلة والرصيد الافتتاحي (${fmt(openingBalance + creditPurchasesTotal)} ج.م) بفارق ${fmt(overpaid)} ج.م.`,
        impact: "لنا رصيد معلق أو إشعار خصم/مرتجع لم يُسجل كفاتورة تسوية.",
        differenceAmount: overpaid,
        targetId: supplier.id,
        targetType: "supplier",
        targetLabel: supplier.name,
        autoFixable: false,
        fixType: "edit_target",
      });
    }
  }

  // ==========================================
  // 4. تدقيق المخزون والتكاليف (Stock & Inventory)
  // ==========================================
  const barcodeTracker = new Map<string, string[]>();

  for (const item of data.stockItems) {
    const itemCost = Number(item.lastUnitCost || 0);
    const itemQty = Number(item.quantity || 0);

    // صنف بتكلفة صفرية في كتالوج المخزون
    if (itemCost <= 0) {
      findings.push({
        id: `stock-zero-cost-${item.id}`,
        category: "stock",
        severity: "critical",
        title: `صنف مخزني بتكلفة صفرية: «${item.name}»`,
        description: `الصنف مسجل بتكلفة 0 ج.م، مما يتسبب في حساب أرباح مبيعات غير دقيقة وتقدير خاطئ لقيمة المخزون الإجمالية.`,
        impact: "تشويه التكلفة وتقدير رأس المال العامل.",
        targetId: item.id,
        targetType: "stock_item",
        targetLabel: item.name,
        autoFixable: false,
        fixType: "fix_stock_cost",
        details: {
          "الكمية الحالية": `${itemQty} قطعة`,
          "سعر البيع": `${fmt(item.salePrice)} ج.م`,
          "التكلفة المسجلة": "0 ج.م",
        },
      });
    }

    // رصيد مخزني سالب
    if (itemQty < 0) {
      findings.push({
        id: `stock-negative-qty-${item.id}`,
        category: "stock",
        severity: "critical",
        title: `رصيد مخزني سالب: «${item.name}»`,
        description: `الكمية الحالية في النظام (${itemQty}) بالسالب، ناتج عن عمليات بيع أو صرف بدون إدخال أذون شراء أولاً.`,
        impact: "خطأ صريح في الجرد والمطابقة المخزنية.",
        targetId: item.id,
        targetType: "stock_item",
        targetLabel: item.name,
        autoFixable: false,
        fixType: "edit_target",
      });
    }

    // رصيد أقل من الحد الأدنى الحرج
    if (item.minStock > 0 && itemQty > 0 && itemQty <= item.minStock) {
      findings.push({
        id: `stock-low-${item.id}`,
        category: "stock",
        severity: "notice",
        title: `صنف قارب على النفاد: «${item.name}»`,
        description: `الرصيد المتاح (${itemQty}) وصل إلى أو أقل من حد الطلب الأدنى (${item.minStock}).`,
        impact: "احتمالية تعطل المبيعات ونفاد الكمية.",
        targetId: item.id,
        targetType: "stock_item",
        targetLabel: item.name,
        autoFixable: false,
        fixType: "edit_target",
      });
    }

    // تعقب تكرار الباركود
    if (item.barcode && item.barcode.trim()) {
      const code = item.barcode.trim();
      const list = barcodeTracker.get(code) ?? [];
      list.push(item.name);
      barcodeTracker.set(code, list);
    }
  }

  // كشف تكرار الباركود
  for (const [code, items] of barcodeTracker) {
    if (items.length > 1) {
      findings.push({
        id: `stock-duplicate-barcode-${code}`,
        category: "stock",
        severity: "warning",
        title: `باركود مكرر (${code})`,
        description: `تم تعيين نفس الباركود لأكثر من صنف: (${items.join("، ")}).`,
        impact: "خطأ عند مسح الباركود بنقطة البيع واختيار الصنف غير المقصود.",
        targetId: code,
        targetType: "stock_item",
        targetLabel: code,
        autoFixable: false,
        fixType: "edit_target",
      });
    }
  }

  // تدقيق حركات المخزون مع الرصيد (إن وُجدت)
  if (movements && movements.length > 0) {
    const movementTotals = new Map<string, number>();
    for (const mov of movements) {
      movementTotals.set(
        mov.stock_item_id,
        (movementTotals.get(mov.stock_item_id) ?? 0) + mov.quantity
      );
    }
    for (const item of data.stockItems) {
      const movTotal = movementTotals.get(item.id);
      if (movTotal !== undefined && Math.abs(item.quantity - movTotal) > 0.001) {
        findings.push({
          id: `stock-mov-mismatch-${item.id}`,
          category: "stock",
          severity: "warning",
          title: `فرق حركة المخزون: «${item.name}»`,
          description: `الرصيد المحسوب من سجل الحركات (${fmt(movTotal)}) يختلف عن رصيد بطاقة الصنف (${fmt(item.quantity)}).`,
          impact: "وجود حركات يدوية أو تعديلات مباشرة بدون قيد مخزني.",
          targetId: item.id,
          targetType: "stock_item",
          targetLabel: item.name,
          autoFixable: false,
          fixType: "edit_target",
        });
      }
    }
  }

  // ==========================================
  // 5. تدقيق الشحنات ومتحصلات COD (Shipments)
  // ==========================================
  for (const shp of data.shipments) {
    const cod = Number(shp.codAmount || 0);
    // شحنة مسلّمة لكن التحصيل معلق أو لم يُسوّى
    if (shp.status === "delivered" && cod > 0 && shp.collectionStatus !== "settled") {
      findings.push({
        id: `shipment-unsettled-cod-${shp.id}`,
        category: "shipments",
        severity: "warning",
        title: `متحصلات شحنة مسلّمة غير مسواة (${fmt(cod)} ج.م)`,
        description: `الشحنة #${shp.trackingNumber || shp.id.slice(0, 8)} تم تسليمها للمستلم ولكن لم يتم تسوية وتوريد مبلغ الدفع عند الاستلام من المندوب/الشركة.`,
        impact: "سيولة نقدية معلقة خارج الخزينة الرئيسية.",
        differenceAmount: cod,
        targetId: shp.id,
        targetType: "shipment",
        targetLabel: shp.trackingNumber || `شحنة #${shp.id.slice(0, 8)}`,
        autoFixable: true,
        fixType: "settle_shipment",
        fixPayload: { shipmentId: shp.id },
      });
    }
  }

  // ==========================================
  // 6. تدقيق المرتجعات (Returns)
  // ==========================================
  for (const ret of data.returns) {
    const hasItems = data.returnItems.some((it) => it.returnId === ret.id);
    if (!hasItems) {
      findings.push({
        id: `return-empty-items-${ret.id}`,
        category: "returns",
        severity: "warning",
        title: `مرتجع بدون بنود تفصيلية #${ret.id.slice(0, 8)}`,
        description: `سجل المرتجع بإجمالي ${fmt(ret.totalAmount)} ج.م لا يحتوي على أي بنود أصناف مسجلة تحته.`,
        impact: "تعذر عكس كميات المخزون المسترجعة بدقة.",
        targetId: ret.id,
        targetType: "return",
        targetLabel: `مرتجع #${ret.id.slice(0, 8)}`,
        autoFixable: false,
        fixType: "edit_target",
      });
    }
  }

  // ==========================================
  // حساب المؤشرات العامة والصحة المالية
  // ==========================================
  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;
  const noticeCount = findings.filter((f) => f.severity === "notice").length;
  const autoFixableCount = findings.filter((f) => f.autoFixable).length;

  const totalDiscrepancyAmount = findings.reduce(
    (sum, f) => sum + (f.differenceAmount || 0),
    0
  );

  const categoryCounts: Record<ReconciliationCategory, number> = {
    all: findings.length,
    invoices: findings.filter((f) => f.category === "invoices").length,
    customers: findings.filter((f) => f.category === "customers").length,
    suppliers: findings.filter((f) => f.category === "suppliers").length,
    stock: findings.filter((f) => f.category === "stock").length,
    shipments: findings.filter((f) => f.category === "shipments").length,
    returns: findings.filter((f) => f.category === "returns").length,
  };

  // حاسبة الصحة (Health Score):
  // تبدأ من 100% ويخصم 7% لكل خطأ حرج، 3% لكل تحذير، 1% لكل تنبيه
  const deductions = criticalCount * 7 + warningCount * 3 + noticeCount * 1;
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - deductions)));

  return {
    findings,
    healthScore,
    totalDiscrepancyAmount,
    criticalCount,
    warningCount,
    noticeCount,
    autoFixableCount,
    categoryCounts,
    totalAuditedRecords: {
      invoices: data.invoices.length,
      payments: data.payments.length,
      customers: data.customers.length,
      suppliers: data.suppliers.length,
      stockItems: data.stockItems.length,
      shipments: data.shipments.length,
      returns: data.returns.length,
    },
  };
}

/**
 * تنفيذ عملية الإصلاح الفردية
 */
export async function executeReconciliationFix(finding: ReconciliationFinding): Promise<boolean> {
  try {
    if (finding.fixType === "recompute_invoice_paid") {
      await db.reconcileInvoicePaid(finding.targetId);
      toast.success("تمت إعادة مزامنة وتصحيح رصيد الفاتورة بنجاح");
      return true;
    }

    if (finding.fixType === "set_invoice_status_paid") {
      await db.updateInvoiceStatus(finding.targetId, "paid");
      toast.success("تم تحديث حالة الفاتورة إلى «مسددة» بنجاح");
      return true;
    }

    if (finding.fixType === "set_invoice_status_pending") {
      await db.updateInvoiceStatus(finding.targetId, "pending");
      toast.success("تم تحديث حالة الفاتورة إلى «معلقة» بنجاح");
      return true;
    }

    if (finding.fixType === "settle_shipment") {
      const { error } = await (supabase.from as any)("shipments")
        .update({ collection_status: "settled", settled_at: new Date().toISOString() })
        .eq("id", finding.targetId);
      if (error) throw error;
      await db.invalidate();
      toast.success("تمت تسوية وتوريد متحصلات الشحنة إلى الخزينة");
      return true;
    }

    return false;
  } catch (error: any) {
    console.error("Reconciliation Fix Error:", error);
    toast.error(error.message || "حدث خطأ أثناء تنفيذ الإصلاح");
    return false;
  }
}

/**
 * تنفيذ الإصلاح الشامل التلقائي لكافة المشاكل الحسابية الآمنة
 */
export async function executeAutoFixAll(findings: ReconciliationFinding[]): Promise<{
  successCount: number;
  failCount: number;
}> {
  const fixables = findings.filter((f) => f.autoFixable);
  let successCount = 0;
  let failCount = 0;

  for (const finding of fixables) {
    try {
      if (finding.fixType === "recompute_invoice_paid") {
        await db.reconcileInvoicePaid(finding.targetId);
        successCount++;
      } else if (finding.fixType === "set_invoice_status_paid") {
        await db.updateInvoiceStatus(finding.targetId, "paid");
        successCount++;
      } else if (finding.fixType === "set_invoice_status_pending") {
        await db.updateInvoiceStatus(finding.targetId, "pending");
        successCount++;
      } else if (finding.fixType === "settle_shipment") {
        await (supabase.from as any)("shipments")
          .update({ collection_status: "settled", settled_at: new Date().toISOString() })
          .eq("id", finding.targetId);
        successCount++;
      }
    } catch (err) {
      failCount++;
    }
  }

  await db.invalidate();
  return { successCount, failCount };
}

/**
 * تصدير تقرير التدقيق والمطابقة إلى Excel
 */
export function exportReconciliationToExcel(summary: ReconciliationSummary) {
  const rows = summary.findings.map((f, index) => ({
    "م": index + 1,
    "مستوى الخطورة":
      f.severity === "critical" ? "حرج 🔴" : f.severity === "warning" ? "تحذير 🟡" : "تنبيه 🔵",
    "القسم":
      f.category === "invoices"
        ? "فواتير وتحصيلات"
        : f.category === "customers"
        ? "عملاء وأقساط"
        : f.category === "suppliers"
        ? "موردين ومشتريات"
        : f.category === "stock"
        ? "مخزون وتكاليف"
        : f.category === "shipments"
        ? "شحنات COD"
        : "مرتجعات",
    "المشكلة المكتشفة": f.title,
    "التفاصيل المحاسبية": f.description,
    "الأثر المالي / الرقابي": f.impact,
    "قيمة الفرق (ج.م)": f.differenceAmount || 0,
    "العنصر المتأثر": f.targetLabel,
    "إصلاح تلقائي متاح": f.autoFixable ? "نعم" : "يتطلب مراجعة",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير المطابقة والتدقيق");
  XLSX.writeFile(
    workbook,
    `تقرير_المطابقة_والرقابة_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
  toast.success("تم تصدير تقرير التدقيق إلى ملف Excel بنجاح");
}

/**
 * تصدير وطباعة تقرير المطابقة الرسمي بتنسيق PDF احترافي
 */
export function exportReconciliationToPdf(summary: ReconciliationSummary) {
  const severityBadge = (sev: ReconciliationSeverity) => {
    if (sev === "critical") return `<span style="color:#be123c;font-weight:700;">🔴 حرج</span>`;
    if (sev === "warning") return `<span style="color:#b45309;font-weight:700;">🟡 تحذير</span>`;
    return `<span style="color:#0284c7;font-weight:700;">🔵 تنبيه</span>`;
  };

  const categoryName = (cat: ReconciliationCategory) => {
    switch (cat) {
      case "invoices":
        return "فواتير وتحصيلات";
      case "customers":
        return "عملاء وأقساط";
      case "suppliers":
        return "موردين ومشتريات";
      case "stock":
        return "مخزون وتكاليف";
      case "shipments":
        return "شحنات COD";
      case "returns":
        return "مرتجعات";
      default:
        return "عام";
    }
  };

  const rowsHtml = summary.findings
    .map(
      (f, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 0 ? "background:#f8fafc;" : ""}">
        <td style="padding: 8px 10px; font-weight: 600; text-align:center;">${idx + 1}</td>
        <td style="padding: 8px 10px;">${severityBadge(f.severity)}</td>
        <td style="padding: 8px 10px; font-weight:600;">${categoryName(f.category)}</td>
        <td style="padding: 8px 10px;">
          <div style="font-weight:700; color:#0f172a;">${esc(f.title)}</div>
          <div style="font-size:10px; color:#475569; margin-top:2px;">${esc(f.description)}</div>
        </td>
        <td style="padding: 8px 10px; font-size:10.5px; color:#64748b;">${esc(f.targetLabel)}</td>
        <td style="padding: 8px 10px; text-align:left; font-weight:700; color:${
          f.differenceAmount ? "#be123c" : "#64748b"
        };">
          ${f.differenceAmount ? `${fmt(f.differenceAmount)} ج.م` : "—"}
        </td>
      </tr>
    `
    )
    .join("");

  const kpis = [
    {
      label: "مؤشر صحة الحسابات",
      value: `${summary.healthScore}%`,
      tone: summary.healthScore >= 90 ? "pos" : summary.healthScore >= 70 ? "warn" : "neg",
    } as any,
    {
      label: "إجمالي المشاكل",
      value: `${summary.findings.length}`,
      tone: summary.findings.length === 0 ? "pos" : "neg",
    },
    {
      label: "المشاكل الحرجة",
      value: `${summary.criticalCount}`,
      tone: summary.criticalCount > 0 ? "neg" : "pos",
    },
    {
      label: "إجمالي مبالغ الفروق",
      value: `${fmt(summary.totalDiscrepancyAmount)} ج.م`,
      tone: summary.totalDiscrepancyAmount > 0 ? "warn" : "plain",
    },
  ];

  const body = `
    <div style="margin-top: 16px;">
      <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 10px; color: #0f172a;">سجل الفروق والتوصيات الرقابية</h3>
      <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 11px;">
        <thead>
          <tr style="background: #059669; color: #fff;">
            <th style="padding: 9px 10px; text-align:center; width: 35px;">#</th>
            <th style="padding: 9px 10px; width: 75px;">الخطورة</th>
            <th style="padding: 9px 10px; width: 100px;">القسم</th>
            <th style="padding: 9px 10px;">المشكلة والتفاصيل</th>
            <th style="padding: 9px 10px; width: 120px;">العنصر</th>
            <th style="padding: 9px 10px; text-align:left; width: 90px;">قيمة الفرق</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="6" style="padding: 24px; text-align: center; color: #059669; font-weight: 700;">لا توجد أي فروق محاسبية أو مخزنية مكتشفة. الحسابات سليمة 100%!</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  const html = pdfDocument({
    docTitle: `تقرير المطابقة والرقابة المالية - ${new Date().toLocaleDateString("ar-EG")}`,
    title: "تقرير المطابقة والمراجعة المحاسبية والرقابة",
    badge: "مستند تدقيق رسمي",
    lede: "تقرير شامل عن صحة البيانات ومطابقة الفواتير والتحصيلات وأرصدة العملاء والموردين وحركة المخزون.",
    meta: [
      { label: "تاريخ الفحص", value: new Date().toLocaleDateString("ar-EG") },
      { label: "عدد السجلات المفحوصة", value: `${summary.totalAuditedRecords.invoices + summary.totalAuditedRecords.stockItems + summary.totalAuditedRecords.customers} سجل` },
      { label: "حالة النظام", value: summary.findings.length === 0 ? "متطابق تماماً ✅" : "يتطلب إجراءات تسوية ⚠️" },
    ],
    kpis,
    body,
    footerNote: "تم إنشاء هذا التقرير عبر محرك المطابقة والتدقيق الذكي لنظام سِجلّي المحاسبي.",
  });

  openPdfDocument(html, { autoPrint: true });
}
