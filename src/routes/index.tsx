import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: PiracyNotice,
  head: () => ({
    meta: [
      { title: "ESTA EXTENSÃO FOI PIRATEADA" },
      { name: "description", content: "A chave utilizada nesta extensão foi bloqueada por uso não autorizado." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function PiracyNotice() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0f14] px-6 text-white font-sans selection:bg-red-500/30">
      {/* Background patterns */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, white 0 1px, transparent 1px 40px), repeating-linear-gradient(to right, white 0 1px, transparent 1px 40px)",
        }}
      />
      
      {/* Glow effects */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-red-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-red-600/10 blur-[120px]" />

      <div className="relative w-full max-w-2xl text-center">
        <div className="mb-8 inline-flex animate-pulse items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="h-12 w-12 text-red-500" />
        </div>

        <h1 className="text-display mb-6 text-4xl font-black tracking-tighter uppercase sm:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
          ESTA EXTENSÃO FOI PIRATEADA
        </h1>

        <div className="glass-panel mx-auto mb-10 max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <p className="text-lg leading-relaxed text-white/80">
            A chave utilizada nesta extensão foi bloqueada por uso não autorizado. 
            Fale com o contato oficial abaixo para adquirir a versão original.
          </p>
          
          <div className="mt-6 flex flex-col items-center gap-2">
            <span className="text-sm font-bold tracking-widest text-red-400 uppercase">
              Contato Oficial
            </span>
            <span className="text-2xl font-mono font-bold text-white">
              (91) 98583-7992
            </span>
            <span className="text-sm text-white/40">
              ou no botão abaixo
            </span>
          </div>
        </div>

        <a
          href="https://wa.me/91985837992"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative inline-flex h-16 items-center justify-center gap-3 overflow-hidden rounded-2xl bg-white px-10 text-lg font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_20px_40px_-15px_rgba(255,255,255,0.3)]"
        >
          <MessageCircle className="h-6 w-6 fill-current" />
          CHAMAR NO WHATSAPP
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/5 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
        </a>
      </div>
    </div>
  );
}
