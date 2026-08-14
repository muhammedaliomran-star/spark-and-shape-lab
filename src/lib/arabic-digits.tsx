import { useEffect } from "react";

const AR = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"] as const;

/** يحوّل أي أرقام لاتينية (0-9) داخل نص إلى أرقام عربية (٠-٩). */
export function toArabicDigits(input: unknown): string {
  return String(input ?? "").replace(/[0-9]/g, (d) => AR[Number(d)]);
}

/** يحوّل الأرقام العربية إلى لاتينية (للاستخدام قبل الحفظ/الحساب). */
export function toLatinDigits(input: unknown): string {
  return String(input ?? "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE"]);

function skipped(el: Element | null): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (SKIP_TAGS.has(n.tagName)) return true;
    if (n instanceof HTMLElement && (n.dataset["latinDigits"] !== undefined || n.isContentEditable)) return true;
  }
  return false;
}

function convertNode(root: Node) {
  convertPlaceholders(root);
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  if (root.nodeType === Node.TEXT_NODE) nodes.push(root as Text);
  let cur = walker.nextNode();
  while (cur) {
    nodes.push(cur as Text);
    cur = walker.nextNode();
  }
  for (const node of nodes) {
    const value = node.nodeValue;
    if (!value || !/[0-9]/.test(value)) continue;
    if (skipped(node.parentElement)) continue;
    node.nodeValue = toArabicDigits(value);
  }
}

/** نصوص الإرشاد داخل الحقول تُعرض بالعربي كمان (عدا الحقول اللاتينية زي التليفون). */
function convertPlaceholders(root: Node) {
  if (!(root instanceof Element) && root.nodeType !== Node.DOCUMENT_NODE) return;
  const el = root as Element;
  const list: Element[] = [];
  if (el.matches?.("input,textarea")) list.push(el);
  el.querySelectorAll?.("input,textarea").forEach((n) => list.push(n));
  for (const node of list) {
    if (!(node instanceof HTMLInputElement) && !(node instanceof HTMLTextAreaElement)) continue;
    if (node.dataset["latinDigits"] !== undefined) continue;
    if (node.closest("[dir='ltr']") || node.getAttribute("dir") === "ltr") continue;
    const ph = node.placeholder;
    if (ph && /[0-9]/.test(ph)) node.placeholder = toArabicDigits(ph);
  }
}

/**
 * يضمن أن كل رقم ظاهر في الواجهة يُعرض بالأرقام العربية،
 * سواء جاء من تنسيق أو من نص ثابت أو من مكتبة خارجية (الرسوم البيانية مثلاً).
 * لا يمسّ حقول الإدخال حتى تظل الكتابة والحساب سليمين.
 */
export function ArabicNumerals() {
  useEffect(() => {
    const run = () => convertNode(document.body);
    run();
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") {
          const node = r.target as Text;
          if (node.nodeValue && /[0-9]/.test(node.nodeValue) && !skipped(node.parentElement)) {
            node.nodeValue = toArabicDigits(node.nodeValue);
          }
        } else {
          r.addedNodes.forEach((n) => {
            if (n.nodeType === Node.TEXT_NODE || n.nodeType === Node.ELEMENT_NODE) convertNode(n);
          });
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
