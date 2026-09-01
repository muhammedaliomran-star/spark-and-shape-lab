import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getPublicReceipt = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .select("id,created_at,total,paid,down_payment,monthly_installment,first_due_date,discount_amount,tax_amount,status,user_id,customer_id,invoice_items(name,price,quantity,discount_pct,discount_amount,tax_pct,tax_amount,line_total,serial_numbers),customers(name)")
      .eq("receipt_token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!invoice) return null;

    const { data: settings } = await supabaseAdmin
      .from("shop_settings")
      .select("shop_name,phone,address,logo_url,currency,tax_number,footer_note")
      .eq("user_id", invoice.user_id)
      .maybeSingle();

    return {
      invoice: {
        number: invoice.id.slice(0, 6).toUpperCase(),
        createdAt: invoice.created_at,
        total: Number(invoice.total), paid: Number(invoice.paid),
        downPayment: Number(invoice.down_payment), monthlyInstallment: Number(invoice.monthly_installment),
        firstDueDate: invoice.first_due_date, discountAmount: Number(invoice.discount_amount),
        taxAmount: Number(invoice.tax_amount), status: invoice.status,
      },
      customer: { name: invoice.customers?.name ?? "عميل" },
      shop: {
        name: settings?.shop_name || "سِجلّي", phone: settings?.phone || null,
        address: settings?.address || null, logoUrl: settings?.logo_url || null,
        currency: settings?.currency || "ج.م", taxNumber: settings?.tax_number || null,
        footerNote: settings?.footer_note || null,
      },
      items: invoice.invoice_items.map((item) => ({
        name: item.name, price: Number(item.price), quantity: Number(item.quantity),
        discountPct: Number(item.discount_pct), discountAmount: Number(item.discount_amount),
        taxPct: Number(item.tax_pct), taxAmount: Number(item.tax_amount),
        lineTotal: Number(item.line_total), serialNumbers: item.serial_numbers,
      })),
    };
  });