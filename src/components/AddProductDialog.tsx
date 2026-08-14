import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ProductForm } from "@/components/ProductForm";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "@tanstack/react-router";
import { Maximize2, PackagePlus } from "lucide-react";

const TITLE = "إضافة منتج جديد";
const DESC = "اسم المنتج مطلوب فقط، وباقي الحقول اختيارية. الحساب أسفل يتحدّث تلقائيًا.";

/** زر توسيع الفورم لصفحة كاملة بنفس الحقول. */
function ExpandLink({ onNavigate }: { onNavigate: () => void }) {
  return (
    <Link
      to="/inventory/new"
      onClick={onNavigate}
      className="press inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
      title="فتح الفورم في صفحة كاملة"
    >
      <Maximize2 className="h-3.5 w-3.5" />
      توسيع لصفحة كاملة
    </Link>
  );
}

export function AddProductDialog({ open, onOpenChange, prefillBarcode, existingBarcodes }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefillBarcode?: string;
  existingBarcodes: Array<string | null>;
}) {
  const isMobile = useIsMobile();

  const form = (
    <ProductForm
      existingBarcodes={existingBarcodes}
      prefillBarcode={prefillBarcode}
      onSaved={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  );

  const header = (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <div className="min-w-0 text-right">
        <div className="flex items-center gap-2 text-right text-lg font-bold">
          <PackagePlus className="h-5 w-5 shrink-0 text-primary" />
          <span className="truncate">{TITLE}</span>
        </div>
        <p className="mt-1 text-right text-sm text-muted-foreground">{DESC}</p>
      </div>
      <ExpandLink onNavigate={() => onOpenChange(false)} />
    </div>
  );

  // موبايل: شيت بملء الشاشة — هيدر ثابت وفوتر ثابت بدل السكرول الداخلي المزدوج
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          dir="rtl"
          className="flex h-[100dvh] max-h-[100dvh] flex-col gap-0 rounded-none p-4"
        >
          <SheetHeader className="shrink-0 space-y-0 border-b border-[var(--hairline)] pb-3 text-right">
            <SheetTitle className="sr-only">{TITLE}</SheetTitle>
            <SheetDescription className="sr-only">{DESC}</SheetDescription>
            {header}
          </SheetHeader>
          {form}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="flex max-h-[90dvh] max-w-lg flex-col gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 space-y-0 border-b border-[var(--hairline)] pb-3">
          <DialogTitle className="sr-only">{TITLE}</DialogTitle>
          <DialogDescription className="sr-only">{DESC}</DialogDescription>
          {header}
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col pt-4">{form}</div>
      </DialogContent>
    </Dialog>
  );
}
