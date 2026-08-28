// بوليصة الشحن ومانيفست المندوب — مستندات PDF قابلة للطباعة مع باركود Code39.
import { pdfDocument, openPdfDocument, esc, type PdfMeta } from "./pdf-doc";

const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw",
  "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn",
  F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn",
  P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn",
  Z: "nwwnwnnnn", "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn",
  $: "nwnwnwnnn", "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn", "*": "nwnnwnwnn",
};

/** يرسم باركود Code39 كـ SVG (يمكن قراءته بأي ماسح). */
export function code39Svg(raw: string, opts?: { height?: number }): string {
  const text = `*${String(raw).toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, "")}*`;
  const narrow = 2;
  const wide = 5;
  const height = opts?.height ?? 60;
  let x = 0;
  const bars: string[] = [];
  for (const ch of text) {
    const pattern = CODE39[ch];
    if (!pattern) continue;
    pattern.split("").forEach((w, i) => {
      const width = w === "w" ? wide : narrow;
      if (i % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${width}" height="${height}" fill="#0f172a"/>`);
      x += width;
    });
    x += narrow; // فاصل بين الحروف
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${x} ${height}" preserveAspectRatio="none" style="max-width:100%;height:${height}px">${bars.join("")}</svg>`;
}

export type LabelData = {
  tracking: string;
  recipientName: string;
  recipientPhone: string;
  address: string;
  carrierName: string;
  zoneName: string;
  codAmount: number;
  shippingCost: number;
  createdAt: string;
  invoiceRef?: string;
};

const money = (n: number) => `${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ج.م`;

/** بوليصة شحن جاهزة للطباعة والّصق على الطرد. */
export function printShipmentLabel(data: LabelData, paper: "a4" | "thermal" = "a4"): boolean {
  const body = `
  <section class="info">
    <div><b>المستلم:</b> ${esc(data.recipientName || "-")}</div>
    <div><b>الموبايل:</b> ${esc(data.recipientPhone || "-")}</div>
    <div style="grid-column:1/-1"><b>العنوان:</b> ${esc(data.address || "-")}</div>
    <div><b>المندوب:</b> ${esc(data.carrierName || "-")}</div>
    <div><b>المنطقة:</b> ${esc(data.zoneName || "-")}</div>
  </section>
  <div style="text-align:center;margin:14px 0 4px">${code39Svg(data.tracking || "NA")}</div>
  <div style="text-align:center;font-weight:700;letter-spacing:2px">${esc(data.tracking || "بدون رقم تتبع")}</div>
  <div class="total-bar"><span class="l">المطلوب تحصيله من العميل</span><span class="v">${money(data.codAmount)}</span></div>
  `;
  return openPdfDocument(
    pdfDocument({
      docTitle: `بوليصة شحن ${data.tracking || ""}`,
      badge: "بوليصة شحن",
      title: `شحنة ${data.tracking || "بدون رقم"}`,
      brandSub: "نظام الشحن والتوصيل",
      meta: [
        { label: "التاريخ", value: new Date(data.createdAt).toLocaleDateString("en-US") },
        ...(data.invoiceRef ? [{ label: "الفاتورة", value: data.invoiceRef } as PdfMeta] : []),
      ],
      kpis: [
        { label: "التحصيل (COD)", value: money(data.codAmount), tone: "brand" },
        { label: "تكلفة الشحن", value: money(data.shippingCost), tone: "warn" },
      ],
      body,
      paper,
      footerNote: "برجاء تسليم الطرد للمستلم بعد تحصيل المبلغ الموضح أعلاه.",
    }),
    { autoPrint: false },
  );
}

/** مانيفست المندوب: كل شحنات اليوم في ورقة واحدة. */
export function printCarrierManifest(opts: {
  carrierName: string;
  dateLabel: string;
  rows: Array<{ tracking: string; recipient: string; phone: string; address: string; cod: number; status: string }>;
}): boolean {
  const totalCod = opts.rows.reduce((s, r) => s + Number(r.cod || 0), 0);
  const body = `
  <table>
    <thead><tr><th>#</th><th>رقم التتبع</th><th>المستلم</th><th>الموبايل</th><th>العنوان</th><th>الحالة</th><th>التحصيل</th></tr></thead>
    <tbody>
      ${opts.rows
        .map(
          (r, i) => `<tr><td>${i + 1}</td><td>${esc(r.tracking || "-")}</td><td>${esc(r.recipient || "-")}</td><td>${esc(r.phone || "-")}</td><td>${esc(r.address || "-")}</td><td>${esc(r.status)}</td><td>${money(r.cod)}</td></tr>`,
        )
        .join("")}
    </tbody>
  </table>
  <div class="total-bar"><span class="l">إجمالي المطلوب تحصيله</span><span class="v">${money(totalCod)}</span></div>
  <div class="sig"><div>توقيع المندوب</div><div>توقيع المسئول</div></div>
  `;
  return openPdfDocument(
    pdfDocument({
      docTitle: `مانيفست ${opts.carrierName}`,
      badge: "مانيفست تسليم",
      title: `شحنات ${opts.carrierName}`,
      brandSub: "نظام الشحن والتوصيل",
      meta: [
        { label: "التاريخ", value: opts.dateLabel },
        { label: "عدد الشحنات", value: String(opts.rows.length) },
      ],
      kpis: [
        { label: "عدد الشحنات", value: String(opts.rows.length) },
        { label: "إجمالي التحصيل", value: money(totalCod), tone: "brand" },
      ],
      body,
      page: "A4",
    }),
    { autoPrint: false },
  );
}
