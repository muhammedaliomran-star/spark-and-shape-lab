/**
 * سِجلّي — نظام مستندات PDF الموحّد (تصميم عصري).
 * كل تصدير PDF في التطبيق يستخدم هذا الملف حتى تكون كل المستندات بنفس الهوية.
 */

const EMERALD = "#059669";
const EMERALD_SOFT = "#ecfdf5";
const INK = "#0b1220";

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** خط عربي عصري + شيت الأنماط الكامل للمستند. */
export const pdfFontLink = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">`;

export const pdfCss = `
  :root {
    --ink: ${INK};
    --muted: #64748b;
    --line: #e6eaef;
    --brand: ${EMERALD};
    --brand-soft: ${EMERALD_SOFT};
    --danger: #be123c;
    --warn: #b45309;
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'IBM Plex Sans Arabic', 'Cairo', 'Tahoma', sans-serif;
    color: var(--ink);
    background: #f6f7f9;
    font-size: 12px;
    line-height: 1.6;
    padding: 28px 20px 56px;
  }
  .sheet {
    max-width: 1040px; margin: 0 auto; background: #fff;
    border-radius: 22px; padding: 34px 34px 28px;
    box-shadow: 0 30px 70px -40px rgba(11,18,32,0.35);
    position: relative; overflow: hidden;
  }
  .sheet::before {
    content: ""; position: absolute; inset-inline: 0; top: 0; height: 5px;
    background: linear-gradient(to left, var(--brand), #34d399 45%, rgba(52,211,153,0.15));
  }

  /* ── الهيدر ───────────────────────────────── */
  .doc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 20px; }
  .doc-id { display: flex; align-items: center; gap: 12px; }
  .doc-id svg { display: block; flex: none; }
  .brand { font-family: 'Cairo', sans-serif; font-size: 25px; font-weight: 900; letter-spacing: -0.6px; line-height: 1.05; }
  .brand em { font-style: normal; color: var(--brand); }
  .brand-sub { font-size: 10.5px; color: var(--muted); margin-top: 3px; letter-spacing: .3px; }
  .doc-meta { text-align: left; font-size: 10.5px; color: var(--muted); line-height: 1.9; min-width: 190px; }
  .doc-meta b { color: var(--ink); font-weight: 600; }
  .eyebrow {
    display: inline-block; padding: 3px 10px; border-radius: 999px; background: var(--brand-soft);
    color: #047857; border: 1px solid #a7f3d0; font-size: 9.5px; font-weight: 700;
    letter-spacing: .12em; text-transform: uppercase; margin-bottom: 8px;
  }
  h1.doc-title { font-family: 'Cairo', sans-serif; font-size: 27px; font-weight: 800; margin: 4px 0 4px; letter-spacing: -0.7px; }
  .doc-lede { font-size: 11.5px; color: var(--muted); margin: 0 0 18px; }
  .rule { height: 1px; background: var(--line); margin: 4px 0 20px; border: 0; }

  /* ── بطاقات المؤشرات ──────────────────────── */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 0 0 22px; }
  .kpi { border: 1px solid var(--line); border-radius: 16px; padding: 12px 14px; background: #fff; }
  .kpi .k-l { font-size: 10px; color: var(--muted); letter-spacing: .04em; }
  .kpi .k-v { font-family: 'Cairo', sans-serif; font-size: 19px; font-weight: 800; margin-top: 3px; font-variant-numeric: tabular-nums; letter-spacing: -0.4px; }
  .kpi.brand { background: linear-gradient(160deg, #f0fdf4, #fff); border-color: #bbf7d0; }
  .kpi.brand .k-v { color: #047857; }
  .kpi.danger .k-v { color: var(--danger); }
  .kpi.warn .k-v { color: var(--warn); }

  /* ── العناوين الفرعية ─────────────────────── */
  h2.sec { font-family: 'Cairo', sans-serif; font-size: 13.5px; font-weight: 800; margin: 26px 0 10px; display: flex; align-items: center; gap: 8px; }
  h2.sec::before { content: ""; width: 5px; height: 15px; border-radius: 3px; background: var(--brand); display: inline-block; }

  /* ── الجداول ──────────────────────────────── */
  .t-wrap { border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th, td { padding: 9px 12px; text-align: right; border: 0; border-bottom: 1px solid var(--line); }
  thead th {
    background: #f8fafc; color: #475569; font-weight: 600; font-size: 10px;
    letter-spacing: .08em; text-transform: uppercase; white-space: nowrap;
  }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:nth-child(even) td { background: #fcfdfe; }
  td.num, th.num { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
  td.due, td.buy { color: var(--danger); }
  td.ok, td.pay { color: #047857; }
  tfoot td { background: var(--brand-soft); font-weight: 800; border-top: 1.5px solid #a7f3d0; border-bottom: 0; color: #064e3b; }
  tr.low td { background: #fffbeb !important; }
  tr.out td { background: #fff1f2 !important; }
  .empty { text-align: center; padding: 26px; color: #94a3b8; }

  /* ── وسوم ─────────────────────────────────── */
  .tag { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 10px; font-weight: 700; border: 1px solid; }
  .tag.purchase { background: #fff1f2; color: var(--danger); border-color: #fecdd3; }
  .tag.payment { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
  .tag.opening { background: #fffbeb; color: var(--warn); border-color: #fde68a; }

  /* ── صناديق معلومات ───────────────────────── */
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; font-size: 11.5px; }
  .info .box { border: 1px solid var(--line); border-radius: 14px; padding: 10px 13px; background: #fcfdfe; }
  .info .box b { color: var(--muted); font-weight: 600; margin-left: 6px; font-size: 10.5px; }

  /* ── الإجمالي والتذييل ────────────────────── */
  .total-bar {
    margin-top: 16px; display: flex; justify-content: space-between; align-items: center;
    background: linear-gradient(to left, #ecfdf5, #ffffff); border: 1px solid #a7f3d0;
    border-radius: 16px; padding: 14px 18px; font-weight: 800; font-family: 'Cairo', sans-serif;
  }
  .total-bar .v { font-size: 20px; color: #047857; font-variant-numeric: tabular-nums; }
  .sig { margin-top: 40px; display: flex; gap: 22px; }
  .sig div { flex: 1; border-top: 1px dashed #cbd5e1; padding-top: 8px; text-align: center; font-size: 10.5px; color: var(--muted); }
  .note { margin-top: 20px; font-size: 10.5px; color: var(--muted); background: #f8fafc; border-radius: 12px; padding: 10px 14px; }
  .doc-foot {
    margin-top: 26px; padding-top: 12px; border-top: 1px solid var(--line);
    display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;
  }

  /* ── زر الطباعة (لا يُطبع) ────────────────── */
  .noprint { position: fixed; top: 18px; left: 18px; z-index: 20; }
  .noprint button {
    display: inline-flex; align-items: center; gap: 8px; background: var(--ink); color: #fff; border: 0;
    padding: 11px 12px 11px 20px; border-radius: 999px; font-family: inherit; font-size: 12.5px; font-weight: 700;
    cursor: pointer; box-shadow: 0 18px 34px -16px rgba(11,18,32,0.65);
    transition: transform .5s cubic-bezier(0.32,0.72,0,1), box-shadow .5s cubic-bezier(0.32,0.72,0,1);
  }
  .noprint button:hover { transform: translateY(-1px); box-shadow: 0 22px 40px -16px rgba(11,18,32,0.7); }
  .noprint button:active { transform: scale(0.98); }
  .noprint button .ico {
    width: 26px; height: 26px; border-radius: 999px; background: rgba(255,255,255,0.14);
    display: inline-flex; align-items: center; justify-content: center; font-size: 13px;
  }

  @media print {
    body { background: #fff; padding: 0; font-size: 11px; }
    .sheet { box-shadow: none; border-radius: 0; padding: 0; max-width: none; }
    .sheet::before { display: none; }
    .noprint { display: none !important; }
    .t-wrap { border-radius: 10px; }
    thead { display: table-header-group; }
    tr, .kpi, .info .box { break-inside: avoid; }
  }
`;

/** علامة العلامة التجارية (SVG مضمّن حتى لا يحتاج المستند للشبكة). */
export const brandMarkSvg = `
<svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="${INK}"/>
  <path d="M24 15.5c-3-2.2-6.6-3-10.5-2.6a1.6 1.6 0 0 0-1.5 1.6v16.2c0 1 .8 1.7 1.8 1.6 3.5-.3 6.8.5 9.5 2.5" stroke="#34d399" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M24 15.5c3-2.2 6.6-3 10.5-2.6a1.6 1.6 0 0 1 1.5 1.6v16.2c0 1-.8 1.7-1.8 1.6-3.5-.3-6.8.5-9.5 2.5" stroke="#34d399" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M24 15.5v19.3" stroke="#34d399" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M16.5 20.5h4M16.5 25h4M27.5 20.5h4M27.5 25h4" stroke="#34d399" stroke-width="1.6" stroke-linecap="round" opacity="0.5"/>
</svg>`.trim();

export type PdfMeta = { label: string; value: string };
export type PdfKpi = { label: string; value: string; tone?: "brand" | "danger" | "warn" | "plain" };

/** أنماط إضافية لمقاس الطابعة الحرارية (80mm) — رول ضيّق بدون زخارف. */
export const thermalCss = `
  body { background: #fff; padding: 6px 4px 18px; font-size: 11px; }
  .sheet { max-width: 80mm; border-radius: 0; padding: 8px 6px; box-shadow: none; }
  .sheet::before { display: none; }
  .doc-head { flex-direction: column; align-items: center; gap: 6px; text-align: center; padding-bottom: 10px; }
  .doc-id svg { width: 30px; height: 30px; }
  .brand { font-size: 19px; }
  .doc-meta { text-align: center; min-width: 0; line-height: 1.7; }
  h1.doc-title { font-size: 16px; text-align: center; }
  .doc-lede, .sig { display: none; }
  .kpis { grid-template-columns: 1fr 1fr; gap: 6px; }
  .kpi { padding: 7px 8px; border-radius: 10px; }
  .kpi .k-v { font-size: 14px; }
  .info { grid-template-columns: 1fr; gap: 6px; }
  th, td { padding: 5px 6px; font-size: 10.5px; }
  .total-bar { padding: 9px 10px; border-radius: 10px; font-size: 12px; }
  .total-bar .v { font-size: 15px; }
  @media print { .sheet { max-width: none; } }
`;

export function pdfHeader(opts: { brandSub?: string; meta: PdfMeta[] }): string {
  return `<header class="doc-head">
  <div class="doc-id">
    ${brandMarkSvg}
    <div>
      <div class="brand">سِجلّ<em>ي</em></div>
      <div class="brand-sub">${opts.brandSub ?? "نظام إدارة العملاء والأقساط"}</div>
    </div>
  </div>
  <div class="doc-meta">${opts.meta.map((m) => `<div><b>${m.label}:</b> ${m.value}</div>`).join("")}</div>
</header>`;
}

export function pdfKpis(items: PdfKpi[]): string {
  if (!items.length) return "";
  return `<section class="kpis">${items
    .map((k) => `<div class="kpi ${k.tone && k.tone !== "plain" ? k.tone : ""}"><div class="k-l">${k.label}</div><div class="k-v">${k.value}</div></div>`)
    .join("")}</section>`;
}

/** يبني مستند PDF كامل بالهوية الموحّدة. */
export function pdfDocument(opts: {
  docTitle: string;
  badge?: string;
  title: string;
  lede?: string;
  brandSub?: string;
  meta: PdfMeta[];
  kpis?: PdfKpi[];
  body: string;
  footerNote?: string;
  page?: "A4" | "A4 landscape" | "A5";
  /** مقاس الطباعة المضبوط في الإعدادات. */
  paper?: "a4" | "thermal";
}): string {
  const thermal = opts.paper === "thermal";
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${opts.docTitle}</title>
${pdfFontLink}
<style>@page { size: ${thermal ? "80mm auto" : (opts.page ?? "A4")}; margin: ${thermal ? "3mm" : "12mm"}; }${pdfCss}${thermal ? thermalCss : ""}</style>
</head><body>
<div class="noprint"><button onclick="window.print()"><span>طباعة / حفظ PDF</span><span class="ico">🖨</span></button></div>
<main class="sheet">
${pdfHeader({ brandSub: opts.brandSub, meta: opts.meta })}
<hr class="rule"/>
${opts.badge ? `<div class="eyebrow">${opts.badge}</div>` : ""}
<h1 class="doc-title">${opts.title}</h1>
${opts.lede ? `<p class="doc-lede">${opts.lede}</p>` : ""}
${opts.kpis?.length ? pdfKpis(opts.kpis) : ""}
${opts.body}
${opts.footerNote ? `<div class="note">${opts.footerNote}</div>` : ""}
<footer class="doc-foot"><span>تم إصدار هذا المستند آلياً من تطبيق سِجلّي</span><span>${new Date().toLocaleString("en-US")}</span></footer>
</main>

</body></html>`;
}

/**
 * سكربت يحوّل كل الأرقام اللاتينية (0-9) داخل نصوص المستند إلى أرقام عربية (٠-٩)
 * حتى تكون كل الأرقام في أي PDF مُصدَّر بنمط عربي موحّد.
 */
export const arabicDigitsScript = `<script>(function(){
  var AR = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  function conv(s){ return s.replace(/[0-9]/g, function(d){ return AR[+d]; }); }
  function walk(node){
    for (var n = node.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { if (/[0-9]/.test(n.nodeValue)) n.nodeValue = conv(n.nodeValue); }
      else if (n.nodeType === 1) {
        var t = n.tagName;
        if (t === 'SCRIPT' || t === 'STYLE' || t === 'SVG' || t === 'svg') continue;
        walk(n);
      }
    }
  }
  function run(){ walk(document.body); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();</script>`;

/** يفتح المستند في نافذة جديدة (مع طباعة تلقائية اختيارية). */
export function openPdfDocument(html: string, opts?: { autoPrint?: boolean; features?: string }): boolean {
  const w = window.open("", "_blank", opts?.features);
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  if (opts?.autoPrint) setTimeout(() => { try { w.focus(); w.print(); } catch { /* noop */ } }, 600);
  return true;
}
