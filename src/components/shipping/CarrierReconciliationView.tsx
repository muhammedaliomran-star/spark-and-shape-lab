import { useMemo, useState } from "react";
import { BezelCard } from "@/components/BezelCard";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { db, type Shipment, type ShipmentCarrier } from "@/lib/store";
import { Calculator, Wallet, CheckCheck } from "lucide-react";

const egp = (n: number) => `${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ج.م`;

export function CarrierReconciliationView({
  carriers,
  shipments,
  onRefresh,
}: {
  carriers: ShipmentCarrier[];
  shipments: Shipment[];
  onRefresh?: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      carriers.map((c) => {
        const own = shipments.filter((s) => s.carrierId === c.id);
        const collected = own.filter((s) => s.collectionStatus === "collected");
        const settled = own.filter((s) => s.collectionStatus === "settled");
        return {
          carrier: c,
          shipments: own.length,
          due: collected.reduce((sum, s) => sum + Number(s.codAmount || 0), 0),
          settledTotal: settled.reduce((sum, s) => sum + Number(s.codAmount || 0), 0),
          shippingCost: own.reduce((sum, s) => sum + Number(s.shippingCost || 0), 0),
          pendingCount: collected.length,
        };
      }),
    [carriers, shipments],
  );

  const totals = rows.reduce(
    (acc, r) => ({ due: acc.due + r.due, settled: acc.settled + r.settledTotal, cost: acc.cost + r.shippingCost }),
    { due: 0, settled: 0, cost: 0 },
  );

  const settle = async (carrierId: string) => {
    setBusy(carrierId);
    try {
      const amount = await db.settleCarrierCollections(carrierId);
      toast.success(`تمت تسوية ${egp(Number(amount) || 0)}`);
      await onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشلت التسوية");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "مستحق التحصيل", value: totals.due, icon: Wallet, tone: "text-amber-500" },
          { label: "تمت تسويته", value: totals.settled, icon: CheckCheck, tone: "text-emerald-500" },
          { label: "تكاليف الشحن", value: totals.cost, icon: Calculator, tone: "text-sky-500" },
        ].map((m, i) => (
          <Reveal key={m.label} delay={i * 0.06}>
            <BezelCard className="plate p-4">
              <div className="flex items-center gap-3">
                <m.icon className={`h-5 w-5 ${m.tone}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-semibold">{egp(m.value)}</p>
                </div>
              </div>
            </BezelCard>
          </Reveal>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r, i) => (
          <Reveal key={r.carrier.id} delay={i * 0.06}>
            <BezelCard className="plate p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">{r.carrier.name}</h3>
                <span className="text-xs text-muted-foreground">{r.shipments} شحنة</span>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">مستحق</span><span className="font-medium text-amber-500">{egp(r.due)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">مسوّى</span><span>{egp(r.settledTotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">تكلفة الشحن</span><span>{egp(r.shippingCost)}</span></div>
              </div>
              <Button
                className="mt-4 w-full"
                size="sm"
                disabled={r.due <= 0 || busy === r.carrier.id}
                onClick={() => void settle(r.carrier.id)}
              >
                {busy === r.carrier.id ? "جارٍ التسوية..." : `تسوية ${r.pendingCount} شحنة`}
              </Button>
            </BezelCard>
          </Reveal>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">لا توجد شركات شحن بعد</p>}
      </div>
    </div>
  );
}

export default CarrierReconciliationView;
