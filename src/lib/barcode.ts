// Barcode helpers: random 13-digit generator + audio/haptic feedback.

export function generateBarcode(
  existing: Iterable<string | null | undefined> = [],
  prefix?: string,
): string {
  const taken = new Set<string>();
  for (const x of existing) {
    if (x) taken.add(String(x).trim());
  }
  const head = (prefix ?? "").replace(/\D/g, "").slice(0, 12);
  for (let attempt = 0; attempt < 20; attempt++) {
    // 13-digit numeric, leading non-zero
    let code = head || String(Math.floor(1 + Math.random() * 9));
    while (code.length < 13) code += Math.floor(Math.random() * 10);
    if (!taken.has(code)) return code;
  }
  // Fallback to timestamp-based
  return (head + String(Date.now())).slice(0, 13);
}

let _audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!_audioCtx) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!Ctx) return null;
      _audioCtx = new Ctx();
    }
    return _audioCtx;
  } catch {
    return null;
  }
}

export function playScanBeep(success = true) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = success ? 1200 : 360;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  } catch {
    /* noop */
  }
  try { (navigator as any).vibrate?.(success ? 60 : [40, 40, 40]); } catch { /* noop */ }
}
