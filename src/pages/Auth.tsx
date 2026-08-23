import { useNavigate } from "@/lib/router-compat";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import authSide from "@/assets/auth-side.jpg";
import { toast } from "sonner";
import { z } from "zod";

export default AuthPage;

const schema = z.object({
  email: z.string().trim().email({ message: "بريد غير صالح" }).max(255),
  password: z.string().min(6, { message: "كلمة السر 6 أحرف على الأقل" }).max(72),
});

function AuthPage() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) navigate("/");
  }, [ready, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("تم إنشاء الحساب — أهلاً بيك!");
          navigate("/");
        } else {
          toast.success("تم إنشاء الحساب — بعتنالك رسالة تأكيد على بريدك", {
            description: "افتح الرسالة وأكّد بريدك، وبعدها سجّل الدخول.",
            duration: 8000,
          });
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("أهلاً بعودتك");
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    const parsedEmail = z.string().trim().email().safeParse(email);
    if (!parsedEmail.success) {
      toast.error("اكتب بريدك الإلكتروني الأول عشان نبعتلك رابط إعادة التعيين");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("بعتنالك رابط إعادة تعيين كلمة السر على بريدك", { duration: 8000 });
    } catch (err: any) {
      toast.error(err.message || "تعذّر إرسال الرابط");
    } finally {
      setBusy(false);
    }
  };


  return (
    <div dir="rtl" className="min-h-screen grid lg:grid-cols-[1fr_1.1fr]">
      {/* form side */}
      <div className="flex items-center justify-center p-6 sm:p-10 order-2 lg:order-1">
        <div className="glass-panel w-full max-w-md rounded-[2rem] p-7 sm:p-9 animate-[fade-in_0.6s_cubic-bezier(0.32,0.72,0,1)]">
        <div className="mb-8">
          <a href="/landing" className="text-display text-2xl font-extrabold tracking-tight text-foreground">سِجلّي</a>
          <h1 className="text-title mt-6">
            {mode === "signin" ? "أهلاً بعودتك." : "افتح دفترك الجديد."}
          </h1>
          <p className="text-lede mt-3 text-sm">
            {mode === "signin" ? "سجّل دخولك وكمّل شغل النهاردة." : "دقيقة واحدة وتبدأ أول فاتورة."}
          </p>
        </div>


        <div className="mb-6 flex rounded-full bg-foreground/[0.04] p-1">
          <button
            onClick={() => setMode("signin")}
            className={`flex-1 py-2 text-sm rounded-full transition-[background-color,color,box-shadow,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${mode === "signin" ? "bg-primary font-bold text-primary-foreground shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.45)]" : "text-muted-foreground"}`}
          >تسجيل الدخول</button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 text-sm rounded-full transition-[background-color,color,box-shadow,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${mode === "signup" ? "bg-primary font-bold text-primary-foreground shadow-[0_4px_12px_-6px_hsl(0_0%_0%/0.45)]" : "text-muted-foreground"}`}
          >إنشاء حساب</button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label>البريد الإلكتروني</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" dir="ltr" required />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label>كلمة السر</Label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={forgotPassword}
                  disabled={busy}
                  className="text-xs font-semibold text-foreground/70 transition-colors hover:text-foreground disabled:opacity-40"
                >
                  نسيت كلمة السر؟
                </button>
              )}
            </div>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" dir="ltr" required />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "جاري المعالجة..." : mode === "signin" ? "دخول" : "إنشاء الحساب"}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--hairline)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="rounded-full bg-card px-3 py-0.5 text-muted-foreground">أو</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-2" size="lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (result.error) {
                toast.error(result.error.message || "تعذّر تسجيل الدخول عبر جوجل");
                setBusy(false);
                return;
              }
              if (result.redirected) return;
              navigate("/");
            } catch (err: any) {
              toast.error(err.message || "حدث خطأ");
              setBusy(false);
            }
          }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          الدخول عبر جوجل
        </Button>
        </div>
      </div>

      {/* image side */}
      <div className="relative hidden lg:block order-1 lg:order-2 overflow-hidden">
        <img
          src={authSide}
          alt="دفتر أقساط ورقي وماكينة باركود على بنك محل"
          width={1024}
          height={1408}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-background via-background/25 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        <div className="absolute bottom-12 right-12 left-12 max-w-md">
          <p className="text-xs font-semibold tracking-[0.14em] text-foreground/60 mb-4">من الورق للنظام</p>
          <p className="text-2xl sm:text-3xl font-bold leading-snug text-foreground">
            كل قسط، كل صنف، كل مصروف — محسوب بالمليم.
          </p>
        </div>
      </div>
    </div>
  );
}

