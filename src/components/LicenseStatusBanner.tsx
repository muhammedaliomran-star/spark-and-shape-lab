import { useState } from "react";
import {
  useCurrentLicense,
  calculateDaysRemaining,
  TIER_CONFIG,
} from "@/lib/licensing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Sparkles, KeyRound, ShieldAlert } from "lucide-react";
import { LicenseActivationModal } from "./LicenseActivationModal";

export function LicenseStatusBanner() {
  const { license, refresh } = useCurrentLicense();
  const [modalOpen, setModalOpen] = useState(false);

  const { days, isLifetime, isExpired, isWarning } = calculateDaysRemaining(
    license.expiryDate
  );

  // If lifetime or well within active period (> 7 days), don't show intrusive banner
  if (isLifetime || (!isExpired && !isWarning && license.status === "active")) {
    return (
      <>
        <LicenseActivationModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          onActivated={() => refresh()}
        />
      </>
    );
  }

  return (
    <>
      <div className="w-full bg-gradient-to-r from-amber-500/15 via-primary/10 to-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs flex items-center justify-between gap-3 text-foreground transition-all">
        <div className="flex items-center gap-2">
          {isExpired ? (
            <ShieldAlert className="w-4 h-4 text-danger animate-bounce shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <span>
            {isExpired ? (
              <strong className="text-danger">
                تنبيه: انتهت صلاحية اشتراك هذا المتجر ({license.tierLabel}).
              </strong>
            ) : license.tier === "trial" ? (
              <span>
                أنت تعمل حالياً على <strong>فترة تجريبية</strong> — متبقي{" "}
                <strong>{days} يوم</strong>.
              </span>
            ) : (
              <span>
                تنبيه: متبقي <strong>{days} يوم</strong> على موعد تجديد اشتراك (
                {license.tierLabel}).
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="h-7 rounded-xl text-[11px] font-bold bg-primary text-black hover:bg-primary/90 px-3 gap-1"
          >
            <KeyRound className="w-3 h-3" />
            {isExpired ? "تفعيل / تجديد الآن" : "ترقية وترخيص"}
          </Button>
        </div>
      </div>

      <LicenseActivationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onActivated={() => refresh()}
      />
    </>
  );
}
