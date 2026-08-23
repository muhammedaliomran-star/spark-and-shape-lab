import { supabase } from "@/integrations/supabase/client";

export interface StockDeductionItem {
  stockId: string;
  name?: string;
  quantity: number;
}

export interface StockOperationResult {
  success: boolean;
  deductedItems: Array<{ stockId: string; quantity: number; previousQuantity: number }>;
  error?: string;
}

/**
 * فحص توفر كميات المنتجات في المخزون
 */
export async function validateStockAvailability(
  items: StockDeductionItem[]
): Promise<{ available: boolean; error?: string }> {
  for (const item of items) {
    if (!item.stockId || item.quantity <= 0) continue;

    const { data: stock, error } = await supabase
      .from("stock_items")
      .select("id, name, quantity")
      .eq("id", item.stockId)
      .maybeSingle();

    if (error || !stock) {
      return {
        available: false,
        error: `المنتج "${item.name || "المحدد"}" غير موجود في المخزون`,
      };
    }

    const currentQty = Number(stock.quantity) || 0;
    if (currentQty < item.quantity) {
      return {
        available: false,
        error: `الكمية المتاحة من "${stock.name}" هي ${currentQty} فقط (المطلوب: ${item.quantity})`,
      };
    }
  }

  return { available: true };
}

/**
 * خصم المخزون مع حفظ الحالة السابقة لدعم الـ Rollback في حال فشل الفاتورة
 */
export async function executeStockDeduction(
  items: StockDeductionItem[]
): Promise<StockOperationResult> {
  const deducted: Array<{ stockId: string; quantity: number; previousQuantity: number }> = [];

  try {
    for (const item of items) {
      if (!item.stockId || item.quantity <= 0) continue;

      const { data: current, error: fetchErr } = await supabase
        .from("stock_items")
        .select("quantity")
        .eq("id", item.stockId)
        .single();

      if (fetchErr || !current) {
        throw new Error(`تعذر قراءة رصيد الصنف ${item.stockId}`);
      }

      const prevQty = Number(current.quantity) || 0;
      const nextQty = Math.max(0, prevQty - item.quantity);

      const { error: updateErr } = await supabase
        .from("stock_items")
        .update({ quantity: nextQty })
        .eq("id", item.stockId);

      if (updateErr) {
        throw updateErr;
      }

      deducted.push({
        stockId: item.stockId,
        quantity: item.quantity,
        previousQuantity: prevQty,
      });
    }

    return {
      success: true,
      deductedItems: deducted,
    };
  } catch (err: any) {
    // التراجع عن أي عناصر تم خصمها بنجاح قبل وقوع الخطأ
    await rollbackStockDeduction(deducted);
    return {
      success: false,
      deductedItems: [],
      error: err?.message || "فشل خصم المخزون",
    };
  }
}

/**
 * التراجع عن خصم المخزون (Rollback)
 */
export async function rollbackStockDeduction(
  deductedItems: Array<{ stockId: string; quantity?: number; previousQuantity?: number }>
): Promise<void> {
  for (const item of deductedItems) {
    if (!item.stockId) continue;
    
    if (typeof item.previousQuantity === "number") {
      await supabase
        .from("stock_items")
        .update({ quantity: item.previousQuantity })
        .eq("id", item.stockId);
    } else if (item.quantity && item.quantity > 0) {
      // إذا لم تكن الكمية السابقة مسجلة، نزيد الكمية
      const { data: curr } = await supabase
        .from("stock_items")
        .select("quantity")
        .eq("id", item.stockId)
        .single();
      if (curr) {
        await supabase
          .from("stock_items")
          .update({ quantity: (Number(curr.quantity) || 0) + item.quantity })
          .eq("id", item.stockId);
      }
    }
  }
}

/**
 * إرجاع منتجات للمخزن (عند المرتجعات أو إلغاء الفاتورة)
 */
export async function restoreStock(
  items: Array<{ stockId: string; quantity: number }>
): Promise<boolean> {
  try {
    for (const item of items) {
      if (!item.stockId || item.quantity <= 0) continue;

      const { data: curr } = await supabase
        .from("stock_items")
        .select("quantity")
        .eq("id", item.stockId)
        .single();

      const currentQty = Number(curr?.quantity) || 0;
      await supabase
        .from("stock_items")
        .update({ quantity: currentQty + item.quantity })
        .eq("id", item.stockId);
    }
    return true;
  } catch {
    return false;
  }
}
