// بوليصة الشحن ومانيفست المندوب — مستندات PDF قابلة للطباعة مع باركود Code39.
import { pdfDocument, openPdfDocument, esc, type PdfMeta } from "./pdf-doc";
import qrcode from "qrcode-generator";

/** يرسم QR كصورة SVG مدمجة (لتتبّع العميل من الموبايل). */
export function qrSvg(text: string, size = 110): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true }).replace(
    "<svg",
    `<svg style="width:${size}px;height:${size}px"`,
  );
}

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
  trackUrl?: string;
  weightKg?: number;
  pieces?: number;
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
  ${
    data.trackUrl
      ? `<div style="text-align:center;margin-top:12px">${qrSvg(data.trackUrl)}<div style="font-size:10px;color:#475569;margin-top:4px">امسح الكود لتتبّع الشحنة</div></div>`
      : ""
  }
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
        { label: "الوزن / القطع", value: `${Number(data.weightKg || 0)} كجم — ${Number(data.pieces || 1)} قطعة` },
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

/** طباعة بوالص متعددة في مستند واحد (كل بوليصة في صفحة مستقلة). */
export function printShipmentLabels(list: LabelData[], paper: "a4" | "thermal" = "a4"): boolean {
  if (!list.length) return false;
  const pages = list
    .map(
      (data) => `
  <section style="page-break-after:always;padding:10px 0;border-bottom:2px dashed #cbd5e1">
    <h2 style="margin:0 0 8px;font-size:16px">بوليصة شحن — ${esc(data.tracking || "بدون رقم")}</h2>
    <section class="info">
      <div><b>المستلم:</b> ${esc(data.recipientName || "-")}</div>
      <div><b>الموبايل:</b> ${esc(data.recipientPhone || "-")}</div>
      <div style="grid-column:1/-1"><b>العنوان:</b> ${esc(data.address || "-")}</div>
      <div><b>المندوب:</b> ${esc(data.carrierName || "-")}</div>
      <div><b>المنطقة:</b> ${esc(data.zoneName || "-")}</div>
      <div><b>الوزن:</b> ${Number(data.weightKg || 0)} كجم</div>
      <div><b>عدد القطع:</b> ${Number(data.pieces || 1)}</div>
    </section>
    <div style="text-align:center;margin:10px 0 2px">${code39Svg(data.tracking || "NA", { height: 46 })}</div>
    <div style="text-align:center;font-weight:700;letter-spacing:2px">${esc(data.tracking || "")}</div>
    <div class="total-bar"><span class="l">المطلوب تحصيله</span><span class="v">${money(data.codAmount)}</span></div>
    ${data.trackUrl ? `<div style="text-align:center;margin-top:8px">${qrSvg(data.trackUrl, 90)}</div>` : ""}
  </section>`,
    )
    .join("");
  return openPdfDocument(
    pdfDocument({
      docTitle: `بوالص شحن (${list.length})`,
      badge: "بوالص شحن",
      title: `طباعة ${list.length} بوليصة`,
      brandSub: "نظام الشحن والتوصيل",
      meta: [{ label: "التاريخ", value: new Date().toLocaleDateString("en-US") }],
      kpis: [
        { label: "عدد البوالص", value: String(list.length), tone: "brand" },
        {
          label: "إجمالي التحصيل",
          value: money(list.reduce((s, d) => s + Number(d.codAmount || 0), 0)),
          tone: "warn",
        },
      ],
      body: pages,
      paper,
      footerNote: "قص كل بوليصة على الخط المتقطع والصقها على الطرد.",
    }),
    { autoPrint: false },
  );
}
