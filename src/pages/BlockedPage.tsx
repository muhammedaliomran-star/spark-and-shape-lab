import { PageTransition } from "@/components/PageTransition";
import { BezelCard } from "@/components/BezelCard";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink, ShieldAlert, Phone } from "lucide-react";

export default function BlockedPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0f14] px-6 text-right" dir="rtl">
      {/* Background Decorative Elements */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, hsl(var(--border)) 0 1px, transparent 1px 34px)",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 72%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-1/4 h-[500px] w-[500px] rounded-full bg-danger/20 blur-[120px] animate-pulse"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/4 h-[500px] w-[500px] rounded-full bg-danger/10 blur-[120px]"
      />

      <PageTransition>
        <div className="relative w-full max-w-xl">
          <BezelCard className="overflow-hidden border-danger/20 bg-card/40 backdrop-blur-xl">
            <div className="p-8 sm:p-12">
              <div className="mb-8 flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-danger/20 opacity-75"></div>
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-danger/30 bg-danger/10 shadow-2xl shadow-danger/20">
                    <ShieldAlert className="h-12 w-12 text-danger" />
                  </div>
                </div>
              </div>

              <div className="text-center">
                <h1 className="text-display mb-6 text-3xl font-black tracking-tighter text-foreground sm:text-4xl">
                  ESTA EXTENSÃO FOI PIRATEADA
                </h1>
                
                <div className="space-y-4 rounded-2xl bg-muted/30 p-6 text-sm leading-relaxed text-muted-foreground ring-1 ring-inset ring-border/50">
                  <p className="font-semibold text-foreground/90">
                    A chave utilizada nesta extensão foi bloqueada por uso não autorizado.
                  </p>
                  <p>
                    Fale com o contato oficial abaixo para adquirir a versão original. 
                    <br />
                    <span className="mt-2 block font-bold text-primary">
                      FALAR COM O CONTATO OFICIAL (91) 98583-7992 ou no botão abaixo
                    </span>
                  </p>
                </div>

                <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
                  <Button
                    size="lg"
                    className="h-14 w-full gap-3 rounded-2xl bg-success text-lg font-black text-success-foreground shadow-xl shadow-success/20 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] sm:w-auto sm:px-10"
                    asChild
                  >
                    <a href="https://wa.me/91985837992" target="_blank" rel="noopener noreferrer">
                      <Phone className="h-5 w-5" />
                      CHAMAR NO WHATSAPP
                    </a>
                  </Button>
                </div>

                <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
                  Security System v4.0.2 • Access Denied
                </p>
              </div>
            </div>
          </BezelCard>
        </div>
      </PageTransition>
    </div>
  );
}
