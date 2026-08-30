import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useShopSettings, fmt, type StockItem } from "@/lib/store";
import { toast } from "sonner";
import { Printer, Barcode, Check, Copy, Tag } from "lucide-react";

interface BarcodeLabelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: StockItem | null;
}

export function BarcodeLabelModal({ open, onOpenChange, product }: BarcodeLabelModalProps) {
  const { settings: shop } = useShopSettings();
  const [copies, setCopies] = useState<number>(product?.quantity && product.quantity > 0 ? Math.min(product.quantity, 50) : 10);
  const [paperType, setPaperType] = useState<"thermal_single" | "a4_grid">("thermal_single");
  const [showPrice, setShowPrice] = useState(true);
  const [showShopName, setShowShopName] = useState(true);
  const [customPrice, setCustomPrice] = useState<string>(product?.salePrice ? String(product.salePrice) : "");

  if (!product) return null;

  const barcodeVal = product.barcode || product.id.slice(0, 12).replace(/\D/g, "") || "123456789012";
  const displayPrice = customPrice !== "" ? Number(customPrice) : product.salePrice;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("يرجى السماح بالنوافذ المنبثقة للطباعة");
      return;
    }

    const labelsCount = Math.max(1, copies);

    // Generate barcodes using SVG rendering for crystal clear thermal printing
    const generateBarcodeSvg = (code: string) => {
      // Clean fallback Code 128 / EAN pseudo barcode representation via clean SVG lines
      const hash = code.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      let bars = "";
      let x = 10;
      for (let i = 0; i < code.length; i++) {
        const digit = parseInt(code[i], 10) || (code.charCodeAt(i) % 10);
        const w1 = ((digit % 3) + 1) * 1.5;
        const w2 = (((digit + 2) % 3) + 1) * 1.5;
        bars += `<rect x="${x}" y="0" width="${w1}" height="40" fill="#000"/>`;
        x += w1 + 2;
        bars += `<rect x="${x}" y="0" width="${w2}" height="40" fill="#000"/>`;
        x += w2 + 2;
      }
      return `<svg viewBox="0 0 ${Math.max(x + 10, 180)} 40" style="width: 100%; height: 36px; display: block; margin: 0 auto;">${bars}</svg>`;
    };

    const barcodeSvg = generateBarcodeSvg(barcodeVal);

    let labelsHtml = "";
    for (let i = 0; i < labelsCount; i++) {
      labelsHtml += `
        <div class="label-item">
          ${showShopName ? `<div class="shop-name">${shop.shopName || "سِجلّي"}</div>` : ""}
          <div class="product-name">${product.name}</div>
          <div class="barcode-container">
            ${barcodeSvg}
            <div class="barcode-text">${barcodeVal}</div>
          </div>
          ${showPrice ? `<div class="product-price">${fmt(displayPrice)} ج.م</div>` : ""}
        </div>
      `;
    }

    const isThermal = paperType === "thermal_single";

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>طباعة ملصقات الباركود — ${product.name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Cairo', sans-serif;
            background: #fff;
            color: #000;
            -webkit-print-color-adjust: exact;
          }
          
          ${
            isThermal
              ? `
            @page {
              size: 50mm 30mm;
              margin: 0;
            }
            .labels-container {
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .label-item {
              width: 48mm;
              height: 28mm;
              margin: 1mm auto;
              page-break-after: always;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              text-align: center;
              padding: 1.5mm 1mm;
              border: 1px dashed #eee;
            }
          `
              : `
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            .labels-container {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 4mm;
              padding: 2mm;
            }
            .label-item {
              width: 100%;
              height: 32mm;
              border: 1px solid #ddd;
              border-radius: 4px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              text-align: center;
              padding: 2mm;
              page-break-inside: avoid;
            }
          `
          }

          .shop-name {
            font-size: 8px;
            font-weight: 700;
            color: #555;
            line-height: 1;
          }
          .product-name {
            font-size: 10px;
            font-weight: 800;
            max-width: 95%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.2;
          }
          .barcode-container {
            width: 90%;
            margin: 1px auto;
            text-align: center;
          }
          .barcode-text {
            font-family: monospace;
            font-size: 9px;
            font-weight: bold;
            letter-spacing: 1.5px;
            line-height: 1;
            margin-top: 1px;
          }
          .product-price {
            font-size: 12px;
            font-weight: 900;
            line-height: 1;
            padding: 1px 6px;
            background: #000;
            color: #fff;
            border-radius: 3px;
            display: inline-block;
          }

          @media print {
            .label-item { border: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="labels-container">
          ${labelsHtml}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    toast.success(`جاري تجهيز ${copies} ملصق باركود للطباعة...`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Barcode className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold">طباعة ملصقات الباركود والأسعار</DialogTitle>
              <DialogDescription className="text-xs">
                توليد استيكرات الأسعار والباركود للطابعات الحرارية وورق A4
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2 text-right">
          {/* Preview Card */}
          <div className="p-4 rounded-2xl bg-card border border-border flex flex-col items-center justify-center text-center shadow-xs">
            <span className="text-[10px] text-muted-foreground font-bold">{shop.shopName || "سِجلّي"}</span>
            <span className="text-xs font-extrabold text-foreground mt-0.5 max-w-[240px] truncate">{product.name}</span>
            <div className="w-44 my-2 p-1.5 bg-white rounded border border-border text-center">
              <div className="flex justify-center items-center gap-0.5 h-7">
                {barcodeVal.split("").map((ch, idx) => (
                  <span
                    key={idx}
                    className="bg-black inline-block h-full"
                    style={{
                      width: `${((ch.charCodeAt(0) % 3) + 1) * 1.5}px`,
                      marginRight: `${(idx % 2) + 1}px`,
                    }}
                  />
                ))}
              </div>
              <div className="text-[10px] font-mono font-bold tracking-widest text-black mt-0.5">{barcodeVal}</div>
            </div>
            {showPrice && (
              <span className="px-2.5 py-0.5 bg-foreground text-background text-xs font-black rounded">
                {fmt(displayPrice)} ج.م
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">عدد الملصقات (النسخ)</Label>
              <Input
                type="number"
                min="1"
                max="500"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 rounded-xl font-bold"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">سعر البيع على الملصق</Label>
              <Input
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder={String(product.salePrice)}
                className="mt-1 rounded-xl font-bold"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">نوع الورق والطابعة</Label>
            <Select value={paperType} onValueChange={(v: any) => setPaperType(v)}>
              <SelectTrigger className="mt-1 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="thermal_single">طابعة باركود حراري (مقاس 50×30 مم / 38×25 مم)</SelectItem>
                <SelectItem value="a4_grid">ورق استيكر A4 مقسم (شبكة ملصقات)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-4 pt-1 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
                className="rounded text-primary"
              />
              <span>إظهار السعر</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showShopName}
                onChange={(e) => setShowShopName(e.target.checked)}
                className="rounded text-primary"
              />
              <span>إظهار اسم المحل</span>
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border pt-3">
          <Button onClick={handlePrint} className="w-full rounded-xl font-bold gap-2">
            <Printer className="h-4 w-4" />
            <span>طباعة الملصقات الآن ({copies} استيكر)</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
