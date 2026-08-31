import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ShieldAlert, KeyRound } from "lucide-react";
import { verifyManagerPin } from "@/lib/security";
import { toast } from "sonner";

interface ManagerPinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onSuccess: () => void;
}

export function ManagerPinModal({
  open,
  onOpenChange,
  title = "موافقة المدير مطلوبة",
  description = "هذا الإجراء محمي ويتطلب إدخال الرقم السري لمدير النظام.",
  onSuccess,
}: ManagerPinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (verifyManagerPin(pin)) {
      setError(false);
      setPin("");
      onOpenChange(false);
      onSuccess();
    } else {
      setError(true);
      toast.error("الرقم السري للمدير غير صحيح!");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setPin("");
          setError(false);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md text-right">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-2xl bg-warning/15 text-warning flex items-center justify-center mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <DialogTitle className="text-center font-bold text-lg">{title}</DialogTitle>
          <DialogDescription className="text-center text-xs">{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground block text-center">
              أدخل الرقم السري للمدير (الافتراضي: 1234)
            </Label>
            <div className="relative max-w-[220px] mx-auto">
              <Input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                autoFocus
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(false);
                }}
                placeholder="••••"
                className={`text-center tracking-[0.5em] text-2xl font-mono h-12 font-bold ${
                  error ? "border-danger focus-visible:ring-danger" : ""
                }`}
              />
              <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3 top-4 pointer-events-none" />
            </div>
            {error && (
              <p className="text-[11px] text-danger font-medium text-center flex items-center justify-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> الرقم السري غير صحيح
              </p>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 sm:gap-2 justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              إلغاء
            </Button>
            <Button type="submit" className="flex-1 gap-1.5">
              تأكيد وتجاوز
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
