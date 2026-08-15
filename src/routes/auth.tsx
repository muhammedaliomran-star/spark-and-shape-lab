import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MessageSquareText, AlertCircle } from "lucide-react";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: PiratedPage,
  head: () => ({
    meta: [
      { title: "ESTA EXTENSÃO FOI PIRATEADA" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function PiratedPage() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background p-6 text-center animate-in fade-in duration-700">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive/10 blur-[120px]" />
      </div>

      <Reveal>
        <div className="mb-8 flex justify-center">
          <div className="rounded-full bg-destructive/10 p-6 ring-1 ring-destructive/20">
            <AlertCircle size={80} className="text-destructive animate-pulse" />
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <h1 className="mb-6 text-4xl font-black tracking-tighter text-foreground sm:text-6xl uppercase">
          ESTA EXTENSÃO FOI PIRATEADA
        </h1>
      </Reveal>

      <Reveal delay={0.2}>
        <div className="max-w-2xl space-y-6">
          <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
            A chave utilizada nesta extensão foi bloqueada por uso não autorizado. 
            Fale com o contato oficial abaixo para adquirir a versão original.
          </p>
          
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 backdrop-blur-sm">
            <p className="font-bold text-destructive sm:text-lg">
              FALAR COM O CONTATO OFICIAL (91) 98583-7992 ou no botão abaixo
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.3}>
        <div className="mt-12">
          <Button
            size="lg"
            className="h-16 px-10 text-lg font-bold shadow-2xl shadow-destructive/20 transition-all hover:scale-105 active:scale-95 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            onClick={() => window.open("https://wa.me/91985837992", "_blank")}
          >
            <MessageSquareText className="mr-2 h-6 w-6" />
            CHAMAR NO WHATSAPP
          </Button>
        </div>
      </Reveal>
      
      <div className="absolute bottom-8 text-xs font-medium tracking-widest text-muted-foreground/40 uppercase">
        Security System Protected • ID: PIRACY_BLOCK_8583
      </div>
    </div>
  );
}

