import type { ThemeMode } from "@/lib/store";

const THEME_KEY = "segilly:theme";
const PALETTE_KEY = "segilly:palette";

export type ColorPalette =
  | "emerald"
  | "amber"
  | "sapphire"
  | "violet"
  | "rose"
  | "orchid"
  | "ocean"
  | "bronze"
  | "lime"
  | "charcoal";

export interface PaletteDef {
  id: ColorPalette;
  label: string;
  sub: string;
  hex: string;
  dark: {
    primary: string;
    ring: string;
    sidebarPrimary: string;
    sidebarRing: string;
    accent: string;
  };
  light: {
    primary: string;
    ring: string;
    sidebarPrimary: string;
    sidebarRing: string;
    accent: string;
  };
}

export const PALETTES_CONFIG: PaletteDef[] = [
  {
    id: "emerald",
    label: "زمردي",
    sub: "الأصل الهادئ",
    hex: "#10b981",
    dark: {
      primary: "164 45% 45%",
      ring: "164 45% 48%",
      sidebarPrimary: "164 45% 45%",
      sidebarRing: "164 45% 48%",
      accent: "165 14% 14%",
    },
    light: {
      primary: "164 40% 34%",
      ring: "164 40% 36%",
      sidebarPrimary: "164 40% 34%",
      sidebarRing: "164 40% 36%",
      accent: "150 20% 92%",
    },
  },
  {
    id: "amber",
    label: "عنبري",
    sub: "إضاءة دافئة",
    hex: "#f59e0b",
    dark: {
      primary: "38 92% 50%",
      ring: "38 92% 54%",
      sidebarPrimary: "38 92% 50%",
      sidebarRing: "38 92% 54%",
      accent: "38 25% 14%",
    },
    light: {
      primary: "35 90% 40%",
      ring: "35 90% 42%",
      sidebarPrimary: "35 90% 40%",
      sidebarRing: "35 90% 42%",
      accent: "38 30% 92%",
    },
  },
  {
    id: "sapphire",
    label: "ياقوتي",
    sub: "أزرق عميق",
    hex: "#3b82f6",
    dark: {
      primary: "217 91% 60%",
      ring: "217 91% 64%",
      sidebarPrimary: "217 91% 60%",
      sidebarRing: "217 91% 64%",
      accent: "217 25% 14%",
    },
    light: {
      primary: "221 83% 53%",
      ring: "221 83% 55%",
      sidebarPrimary: "221 83% 53%",
      sidebarRing: "221 83% 55%",
      accent: "221 30% 92%",
    },
  },
  {
    id: "violet",
    label: "بنفسجي",
    sub: "تباين ناعم",
    hex: "#8b5cf6",
    dark: {
      primary: "263 70% 58%",
      ring: "263 70% 62%",
      sidebarPrimary: "263 70% 58%",
      sidebarRing: "263 70% 62%",
      accent: "263 25% 14%",
    },
    light: {
      primary: "262 83% 48%",
      ring: "262 83% 50%",
      sidebarPrimary: "262 83% 48%",
      sidebarRing: "262 83% 50%",
      accent: "262 30% 92%",
    },
  },
  {
    id: "rose",
    label: "وردي",
    sub: "دفء عصري",
    hex: "#ec4899",
    dark: {
      primary: "340 75% 55%",
      ring: "340 75% 60%",
      sidebarPrimary: "340 75% 55%",
      sidebarRing: "340 75% 60%",
      accent: "340 25% 14%",
    },
    light: {
      primary: "340 82% 48%",
      ring: "340 82% 50%",
      sidebarPrimary: "340 82% 48%",
      sidebarRing: "340 82% 50%",
      accent: "340 30% 92%",
    },
  },
  {
    id: "orchid",
    label: "أوركيد",
    sub: "بنفسجي وردي",
    hex: "#d946ef",
    dark: {
      primary: "292 84% 60%",
      ring: "292 84% 64%",
      sidebarPrimary: "292 84% 60%",
      sidebarRing: "292 84% 64%",
      accent: "292 25% 14%",
    },
    light: {
      primary: "293 69% 46%",
      ring: "293 69% 48%",
      sidebarPrimary: "293 69% 46%",
      sidebarRing: "293 69% 48%",
      accent: "293 30% 92%",
    },
  },
  {
    id: "ocean",
    label: "محيطي",
    sub: "أزرق منعش",
    hex: "#06b6d4",
    dark: {
      primary: "189 94% 43%",
      ring: "189 94% 47%",
      sidebarPrimary: "189 94% 43%",
      sidebarRing: "189 94% 47%",
      accent: "189 25% 14%",
    },
    light: {
      primary: "189 90% 36%",
      ring: "189 90% 38%",
      sidebarPrimary: "189 90% 36%",
      sidebarRing: "189 90% 38%",
      accent: "189 30% 92%",
    },
  },
  {
    id: "bronze",
    label: "نحاسي",
    sub: "طابع راق",
    hex: "#b45309",
    dark: {
      primary: "28 80% 50%",
      ring: "28 80% 54%",
      sidebarPrimary: "28 80% 50%",
      sidebarRing: "28 80% 54%",
      accent: "28 25% 14%",
    },
    light: {
      primary: "25 75% 42%",
      ring: "25 75% 44%",
      sidebarPrimary: "25 75% 42%",
      sidebarRing: "25 75% 44%",
      accent: "25 30% 92%",
    },
  },
  {
    id: "lime",
    label: "ليموني",
    sub: "حيوية متزنة",
    hex: "#84cc16",
    dark: {
      primary: "84 75% 45%",
      ring: "84 75% 50%",
      sidebarPrimary: "84 75% 45%",
      sidebarRing: "84 75% 50%",
      accent: "84 25% 14%",
    },
    light: {
      primary: "84 81% 35%",
      ring: "84 81% 37%",
      sidebarPrimary: "84 81% 35%",
      sidebarRing: "84 81% 37%",
      accent: "84 30% 92%",
    },
  },
  {
    id: "charcoal",
    label: "فحمي",
    sub: "محايد ودقيق",
    hex: "#4b5563",
    dark: {
      primary: "215 20% 65%",
      ring: "215 20% 70%",
      sidebarPrimary: "215 20% 65%",
      sidebarRing: "215 20% 70%",
      accent: "215 15% 14%",
    },
    light: {
      primary: "220 20% 30%",
      ring: "220 20% 32%",
      sidebarPrimary: "220 20% 30%",
      sidebarRing: "220 20% 32%",
      accent: "220 15% 92%",
    },
  },
];

/** Last theme the user picked on this device (instant paint before settings load). */
export function readStoredTheme(): ThemeMode | null {
  if (typeof localStorage === "undefined") return null;
  const v = localStorage.getItem(THEME_KEY);
  return v === "dark" || v === "light" || v === "system" ? v : null;
}

export function storeTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* noop */
  }
}

/** Last color palette picked on this device. */
export function readStoredPalette(): ColorPalette {
  if (typeof localStorage === "undefined") return "emerald";
  const v = localStorage.getItem(PALETTE_KEY) as ColorPalette | null;
  return PALETTES_CONFIG.some((p) => p.id === v) ? (v as ColorPalette) : "emerald";
}

export function storePalette(palette: ColorPalette) {
  try {
    localStorage.setItem(PALETTE_KEY, palette);
  } catch {
    /* noop */
  }
}

/** Resolves a mode to the concrete surface currently shown. */
export function resolvedTheme(mode: ThemeMode): "dark" | "light" {
  const prefersLight =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches;
  return mode === "light" || (mode === "system" && prefersLight) ? "light" : "dark";
}

/** Applies CSS variables of chosen palette to document root */
export function applyPalette(paletteId: ColorPalette, light: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const palette = PALETTES_CONFIG.find((p) => p.id === paletteId) || PALETTES_CONFIG[0];
  const values = light ? palette.light : palette.dark;

  root.style.setProperty("--primary", values.primary);
  root.style.setProperty("--ring", values.ring);
  root.style.setProperty("--sidebar-primary", values.sidebarPrimary);
  root.style.setProperty("--sidebar-ring", values.sidebarRing);
  root.style.setProperty("--accent", values.accent);
  root.setAttribute("data-palette", palette.id);
}

/** Applies the theme to <html>: dark tokens by default, light tokens via .theme-light. */
export function applyTheme(mode: ThemeMode, palette?: ColorPalette) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const light = resolvedTheme(mode) === "light";
  root.classList.toggle("theme-light", light);
  root.classList.toggle("dark", !light);

  const activePalette = palette || readStoredPalette();
  applyPalette(activePalette, light);
}

