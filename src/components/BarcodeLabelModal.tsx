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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer, Tag, Sparkles, Layers, Sliders } from "lucide-react";
import { fmt, useShopSettings, type StockItem, type ProductVariant } from "@/lib/store";
import { pdfDocument, openPdfDocument, esc } from "@/lib/pdf-doc";
import { toast } from "sonner";

interface BarcodeLabelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: StockItem | null;
}

export function BarcodeLabelModal({ open, onOpenChange, product }: BarcodeLabelModalProps) {
  const { settings: shop } = useShopSettings();

  const [quantity, setQuantity] = useState("4");
  const [showPrice, setShowPrice] = useState(true);
  const [showShopName, setShowShopName] = useState(true);
  const [showBarcodeText, setShowBarcodeText] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("all");
  const [labelSize, setLabelSize] = useState<"38x25" | "50x30" | "a4_sheet">("38x25");

  if (!product) return null;

  const currentBarcode = product.barcode || product.id.slice(0, 12).replace(/\D/g, "");
  const price = product.salePrice || 0;
  const variants = product.variants || [];

  const handlePrint = () => {
    const qty = Math.max(1, Number(quantity || 1));
    const shopName = shop.shopName || "المتجر";
    const cur = shop.currency || "ج.م";

    // Prepare label items (either single product or variant specific)
    const itemsToPrint: Array<{ name: string; barcode: string; price: number; sub?: string }> = [];

    if (selectedVariantId === "all" || variants.length === 0) {
      for (let i = 0; i < qty; i++) {
        itemsToPrint.push({
          name: product.name,
          barcode: currentBarcode,
          price: price,
        });
      }
    } else {
      const v = variants.find((x) => x.id === selectedVariantId);
      const labelName = `${product.name} ${[v?.size, v?.color].filter(Boolean).join(" - ")}`;
      const labelBarcode = v?.barcode || currentBarcode;
      const labelPrice = v?.salePrice || price;
      for (let i = 0; i < qty; i++) {
        itemsToPrint.push({
          name: labelName,
          barcode: labelBarcode,
          price: labelPrice,
          sub: [v?.size, v?.color].filter(Boolean).join(" / "),
        });
      }
    }

    // Generate HTML for stickers
    const isSingleLabelRoll = labelSize === "38x25" || labelSize === "50x30";
    const widthMm = labelSize === "38x25" ? "38mm" : labelSize === "50x30" ? "50mm" : "auto";
    const heightMm = labelSize === "38x25" ? "25mm" : labelSize === "50x30" ? "30mm" : "auto";

    const labelsHtml = itemsToPrint
      .map(
        (item) => `
      <div class="sticker-card" style="
        width: ${widthMm};
        height: ${heightMm};
        page-break-inside: avoid;
        break-inside: avoid;
        box-sizing: border-box;
        padding: 4px;
        text-align: center;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        font-family: system-ui, sans-serif;
        border: 1px dashed #ccc;
        margin: 2px;
      ">
        ${showShopName ? `<div style="font-size: 8px; font-weight: bold; color: #555; text-transform: uppercase;">${esc(shopName)}</div>` : ""}
        <div style="font-size: 10px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 95%;">
          ${esc(item.name)}
        </div>
        ${item.sub ? `<div style="font-size: 8px; color: #666; font-weight: bold;">${esc(item.sub)}</div>` : ""}
        
        <!-- SVG Barcode placeholder rendered via clean SVG lines -->
        <div style="margin: 2px 0;">
          <svg style="width: 80%; height: 26px; max-width: 140px;" viewBox="0 0 100 25" preserveAspectRatio="none">
            <rect x="0" y="0" width="3" height="25" fill="#000"/>
            <rect x="5" y="0" width="2" height="25" fill="#000"/>
            <rect x="9" y="0" width="4" height="25" fill="#000"/>
            <rect x="15" y="0" width="1" height="25" fill="#000"/>
            <rect x="18" y="0" width="3" height="25" fill="#000"/>
            <rect x="23" y="0" width="5" height="25" fill="#000"/>
            <rect x="30" y="0" width="2" height="25" fill="#000"/>
            <rect x="34" y="0" width="4" height="25" fill="#000"/>
            <rect x="40" y="0" width="1" height="25" fill="#000"/>
            <rect x="43" y="0" width="3" height="25" fill="#000"/>
            <rect x="48" y="0" width="6" height="25" fill="#000"/>
            <rect x="56" y="0" width="2" height="25" fill="#000"/>
            <rect x="60" y="0" width="4" height="25" fill="#000"/>
            <rect x="66" y="0" width="2" height="25" fill="#000"/>
            <rect x="70" y="0" width="3" height="25" fill="#000"/>
            <rect x="75" y="0" width="5" height="25" fill="#000"/>
            <rect x="82" y="0" width="2" height="25" fill="#000"/>
            <rect x="86" y="0" width="4" height="25" fill="#000"/>
            <rect x="92" y="0" width="2" height="25" fill="#000"/>
            <rect x="96" y="0" width="4" height="25" fill="#000"/>
          </svg>
        </div>

        ${showBarcodeText ? `<div style="font-family: monospace; font-size: 8px; letter-spacing: 1px; font-weight: bold;">${esc(item.barcode)}</div>` : ""}

        ${showPrice ? `<div style="font-size: 11px; font-weight: 900; background: #000; color: #fff; padding: 1px 6px; border-radius: 4px; margin-top: 2px;">${fmt(item.price)} ${cur}</div>` : ""}
      </div>
    `
      )
      .join("");

    const fullPrintDoc = `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="utf-8">
  <title>طباعة ملصقات الباركود - ${esc(product.name)}</title>
  <style>
    @page {
      size: ${labelSize === "a4_sheet" ? "A4" : `${widthMm} ${heightMm}`};
      margin: 0mm;
    }
    body {
      margin: 0;
      padding: 4px;
      display: flex;
      flex-wrap: wrap;
      justify-content: ${isSingleLabelRoll ? "center" : "flex-start"};
      background: #fff;
    }
    @media print {
      .sticker-card {
        border: none !important;
        margin: 0 !important;
      }
    }
  </style>
</head>
<body>
  ${labelsHtml}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

    openPdfDocument(fullPrintDoc, {
      autoPrint: true,
      features: "width=500,height=700",
    });
    toast.success("تم إرسال ملصقات الباركود لأمر الطباعة ✓");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">
        <DialogHeader className="text-right space-y-1">
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            طباعة ملصقات الباركود والأسعار
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            طباعة استيكرات الباركود للصقها على المنتجات بمقاسات الطابعات الحرارية أو ورق A4.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2 text-right">
          {/* تفاصيل المنتج المحدد */}
          <div className="p-3 rounded-2xl bg-foreground/[0.03] border border-foreground/10 space-y-1">
            <div className="text-sm font-bold text-foreground">{product.name}</div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <span>الباركود: {currentBarcode}</span>
              <span>السعر: {fmt(price)} ج.م</span>
            </div>
          </div>

          {/* تنوعات المقاسات إذا وجدت */}
          {variants.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-primary" /> اختر التنوع / المقاس:
              </Label>
              <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                <SelectTrigger className="h-10 rounded-2xl text-xs">
                  <SelectValue placeholder="اختر التنوع..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">المنتج الرئيسي (بدون تنوع محدد)</SelectItem>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {[v.size, v.color].filter(Boolean).join(" / ")} — {v.salePrice || price} ج.م
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">عدد الملصقات:</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-10 rounded-2xl text-center font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">مقاس ورق الملصق:</Label>
              <Select value={labelSize} onValueChange={(v: any) => setLabelSize(v)}>
                <SelectTrigger className="h-10 rounded-2xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="38x25">طابعة استيكر (38×25 مم)</SelectItem>
                  <SelectItem value="50x30">طابعة استيكر (50×30 مم)</SelectItem>
                  <SelectItem value="a4_sheet">ورق استيكر A4 مقسم</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* خيارات المحتوى المطبوع */}
          <div className="p-3 rounded-2xl border border-foreground/10 space-y-2.5 bg-foreground/[0.01]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">إظهار سعر البيع</span>
              <Switch checked={showPrice} onCheckedChange={setShowPrice} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">إظهار اسم المحل</span>
              <Switch checked={showShopName} onCheckedChange={setShowShopName} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">إظهار كود الأرقام أسفل الباركود</span>
              <Switch checked={showBarcodeText} onCheckedChange={setShowBarcodeText} />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-2xl text-xs h-10 px-4"
          >
            إلغاء
          </Button>

          <Button
            type="button"
            onClick={handlePrint}
            className="rounded-2xl gap-2 text-xs font-bold h-10 px-6"
          >
            <Printer className="w-4 h-4" />
            طباعة الاستيكرات ({quantity})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
