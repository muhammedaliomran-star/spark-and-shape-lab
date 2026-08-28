import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "@/lib/router-compat";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase delivers the recovery session via the URL hash before firing PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) { toast.error("كلمة السر 6 أحرف على الأقل"); return; }
    if (pw !== pw2) { toast.error("كلمتا السر غير متطابقتين"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("تم تعيين كلمة السر الجديدة");
      navigate("/");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "تعذر التغيير");
    } finally { setBusy(false); }
  };

  return (
    <div dir="rtl" className="min-h-screen grid place-items-center px-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/[0.06] text-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">تعيين كلمة سر جديدة</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {ready
              ? "اختر كلمة سر جديدة لحسابك."
              : "افتح الرابط من رسالة البريد الإلكتروني عشان تقدر تغيّر كلمة السر."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>كلمة السر الجديدة</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" placeholder="••••••••" maxLength={72} required />
          </div>
          <div>
            <Label>تأكيد كلمة السر</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} dir="ltr" placeholder="••••••••" maxLength={72} required />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !ready}>
            {busy ? "جاري الحفظ..." : "حفظ كلمة السر"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => navigate("/auth")}
          className="mt-6 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          الرجوع لتسجيل الدخول
        </button>
      </div>
    </div>
  );
}
