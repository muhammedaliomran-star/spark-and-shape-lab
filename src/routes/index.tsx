import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, ExternalLink, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: PiratedNoticePage,
  head: () => ({
    meta: [
      { title: "ESTA EXTENSÃO FOI PIRATEADA" },
      { name: "description", content: "A chave utilizada nesta extensão foi bloqueada por uso não autorizado." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function PiratedNoticePage() {
  const whatsappUrl = "https://wa.me/91985837992";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0a] px-6 font-sans text-white selection:bg-red-500/30">
      {/* Background decoration */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, #ffffff 0 1px, transparent 1px 40px), repeating-linear-gradient(to right, #ffffff 0 1px, transparent 1px 40px)",
          maskImage: "radial-gradient(circle at center, black 40%, transparent 90%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-red-600/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-red-900/10 blur-[120px]"
      />

      <div className="relative w-full max-w-2xl text-center">
        {/* Warning Icon */}
        <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-3xl border border-red-500/30 bg-red-500/10 shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)]">
          <AlertCircle className="h-10 w-10 text-red-500" strokeWidth={2.5} />
        </div>

        {/* Title */}
        <h1 className="mb-6 bg-gradient-to-b from-white to-white/60 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl uppercase">
          ESTA EXTENSÃO FOI PIRATEADA
        </h1>

        {/* Message Container */}
        <div className="relative mb-10 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl sm:p-12">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
          
          <p className="text-lg leading-relaxed text-white/80 sm:text-xl">
            "A chave utilizada nesta extensão foi bloqueada por uso não autorizado. 
            Fale com o contato oficial abaixo para adquirir a versão original. 
            <span className="mt-4 block font-bold text-red-400">
              FALAR COM O CONTATO OFICIAL (91) 98583-7992 ou no botão abaixo
            </span>"
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-white px-8 text-base font-bold text-black transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
          >
            <MessageCircle className="h-5 w-5 fill-current" />
            CHAMAR NO WHATSAPP
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/5 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          </a>
          
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-8 text-sm font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white sm:w-auto"
          >
            Suporte Oficial
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Footer info */}
        <p className="mt-12 text-xs font-medium uppercase tracking-[0.2em] text-white/20">
          Sistema de Proteção de Licença &copy; 2026
        </p>
      </div>
    </div>
  );
}
