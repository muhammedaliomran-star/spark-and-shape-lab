import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";

import appCss from "../styles.css?url";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrivacyProvider } from "@/lib/privacy";
import { QuickActionsFab } from "@/components/QuickActionsFab";
import { AmbientBackground } from "@/components/AmbientBackground";
import { useAuth } from "@/lib/store";
import { useHydrated } from "@/lib/hydrated";
import { ArabicNumerals } from "@/lib/arabic-digits";

function NotFoundComponent() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, hsl(var(--border)) 0 1px, transparent 1px 34px)",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 72%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-1/4 h-[420px] w-[420px] rounded-full bg-primary/10 blur-[120px]"
      />
      <div className="relative w-full max-w-lg text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold tracking-wide text-primary">
          صفحة غير موجودة
        </span>
        <div className="mt-6 select-none text-[112px] font-extrabold leading-none tracking-tighter text-foreground/90 sm:text-[144px]">
          4<span className="text-primary">0</span>4
        </div>
        <h1 className="mt-2 text-xl font-bold text-foreground">الورقة دي مش موجودة في السِجل</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          يمكن الرابط اتغيّر أو الصفحة اتشالت. ارجع للوحة التحكم وكمّل شغلك من هناك.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110"
          >
            لوحة التحكم
          </Link>
          <Link
            to="/landing"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-6 text-sm font-semibold text-foreground transition hover:bg-muted/40"
          >
            صفحة سِجلّي
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 left-1/4 h-[420px] w-[420px] rounded-full bg-danger/10 blur-[120px]"
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-border/70 bg-card/70 p-8 text-center backdrop-blur">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-danger/30 bg-danger/10 text-2xl">
          ⚠️
        </div>
        <h1 className="mt-5 text-xl font-bold text-foreground">حصلت مشكلة غير متوقعة</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          بياناتك في أمان. جرّب تعيد المحاولة، ولو المشكلة كمّلت ارجع للوحة التحكم.
        </p>
        <pre className="mt-5 max-h-32 overflow-auto rounded-xl border border-border/60 bg-muted/30 p-3 text-right text-[11px] leading-relaxed text-muted-foreground" dir="ltr">
          {error.message}
        </pre>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110"
          >
            إعادة المحاولة
          </button>
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-6 text-sm font-semibold text-foreground transition hover:bg-muted/40"
          >
            لوحة التحكم
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "لوحة التحكم — سِجلّي" },
      { name: "description", content: "نظرة سريعة على المبيعات والتحصيلات والأرباح والمخزون في محلك." },
      { property: "og:title", content: "لوحة التحكم — سِجلّي" },
      { name: "twitter:title", content: "لوحة التحكم — سِجلّي" },
      { property: "og:description", content: "نظرة سريعة على المبيعات والتحصيلات والأرباح والمخزون في محلك." },
      { name: "twitter:description", content: "نظرة سريعة على المبيعات والتحصيلات والأرباح والمخزون في محلك." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/fd3f6ef2-a787-46e1-867d-375c3558e1f1" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/fd3f6ef2-a787-46e1-867d-375c3558e1f1" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#060908" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "سِجلّي" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },


      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Zain:wght@700;800;900&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function FabIfAuthed() {
  const { user } = useAuth();
  if (!user) return null;
  return <QuickActionsFab />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const hydrated = useHydrated();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ArabicNumerals />
        <Toaster />
        <Sonner richColors position="top-center" dir="rtl" />
        <PrivacyProvider>
          <AmbientBackground />
          {hydrated ? (
            <AnimatePresence mode="wait">
              <Outlet />
            </AnimatePresence>
          ) : (
            <Outlet />
          )}
          <FabIfAuthed />
        </PrivacyProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

