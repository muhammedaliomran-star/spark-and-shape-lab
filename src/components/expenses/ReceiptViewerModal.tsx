import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, X, FileText, Image as ImageIcon } from "lucide-react";
import { fmt } from "@/lib/store";

interface ReceiptViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptUrl: string | null;
  receiptName?: string;
  expenseTitle?: string;
  expenseAmount?: number;
}

export function ReceiptViewerModal({
  open,
  onOpenChange,
  receiptUrl,
  receiptName,
  expenseTitle,
  expenseAmount,
}: ReceiptViewerModalProps) {
  if (!receiptUrl) return null;

  const isPdf = receiptUrl.startsWith("data:application/pdf") || receiptUrl.endsWith(".pdf");

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = receiptUrl;
    a.download = receiptName || `receipt-${Date.now()}.${isPdf ? "pdf" : "png"}`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] flex flex-col p-5">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div className="text-right">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" />
              مستند / فاتورة المصروف
            </DialogTitle>
            {(expenseTitle || expenseAmount) && (
              <p className="text-xs text-muted-foreground mt-1">
                {expenseTitle} {expenseAmount ? `• ${fmt(expenseAmount)} ج.م` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> تحميل المستند
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4 flex items-center justify-center bg-muted/20 rounded-xl min-h-[300px]">
          {isPdf ? (
            <div className="text-center p-6">
              <FileText className="w-16 h-16 text-primary mx-auto mb-3 opacity-80" />
              <p className="font-semibold text-sm mb-2">{receiptName || "مستند PDF"}</p>
              <Button size="sm" onClick={() => window.open(receiptUrl, "_blank")} className="gap-2">
                <ExternalLink className="w-4 h-4" /> فتح المستند في نافذة جديدة
              </Button>
            </div>
          ) : (
            <img
              src={receiptUrl}
              alt="صورة الفاتورة المرفقة"
              className="max-h-[65vh] w-auto object-contain rounded-lg shadow-sm border border-border/50"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
