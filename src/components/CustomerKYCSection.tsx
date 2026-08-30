import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type CustomerKYC } from "@/lib/customer-extended";
import {
  Camera,
  Upload,
  Eye,
  Trash2,
  Download,
  CreditCard,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CustomerKYCSectionProps {
  kyc: CustomerKYC;
  onChange: (kyc: CustomerKYC) => void;
  readOnly?: boolean;
}

// Compress image to sensible size (max 1000px width/height, 0.7 JPEG quality) to avoid bloated payloads
async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const maxDim = 1200;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("تعذر قراءة الصورة"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("تعذر رفع الملف"));
    reader.readAsDataURL(file);
  });
}

export function CustomerKYCSection({
  kyc,
  onChange,
  readOnly = false,
}: CustomerKYCSectionProps) {
  const [zoomImage, setZoomImage] = useState<{ title: string; src: string } | null>(null);

  const docSlots: Array<{
    key: keyof CustomerKYC;
    label: string;
    description: string;
    icon: any;
  }> = [
    {
      key: "idCardFront",
      label: "بطاقة الرقم القومي (الوجه)",
      description: "صورة واضحة لوجه بطاقة العميل",
      icon: CreditCard,
    },
    {
      key: "idCardBack",
      label: "بطاقة الرقم القومي (الظهر)",
      description: "صورة واضحة لظهر بطاقة العميل",
      icon: CreditCard,
    },
    {
      key: "utilityBill",
      label: "إيصال مرافق / عقد إيجار",
      description: "كهرباء، غاز، مياه، أو إثبات سكن",
      icon: FileText,
    },
    {
      key: "guarantorIdCard",
      label: "بطاقة الضامن / الكفيل",
      description: "صورة بطاقة الرقم القومي للضامن",
      icon: CreditCard,
    },
  ];

  const handleUpload = async (key: keyof CustomerKYC, file: File) => {
    try {
      if (!file.type.startsWith("image/")) {
        toast.error("يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)");
        return;
      }
      toast.info("جاري معالجة وضغط الصورة...");
      const compressedDataUrl = await compressImageFile(file);
      onChange({
        ...kyc,
        [key]: compressedDataUrl,
      });
      toast.success("تم إرفاق المستند بنجاح ✓");
    } catch (e: any) {
      toast.error(e?.message || "فشل في رفع المستند");
    }
  };

  const handleRemove = (key: keyof CustomerKYC) => {
    const updated = { ...kyc };
    delete updated[key];
    onChange(updated);
    toast.info("تم حذف المستند");
  };

  const handleDownload = (src: string, label: string) => {
    const a = document.createElement("a");
    a.href = src;
    a.download = `${label}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-3 text-right">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          حفظ صور بطاقات العميل والمرافق لضمان المعاملات وتوثيق التقسيط
        </span>
        <Label className="text-xs font-extrabold flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4 text-primary" />
          مستندات وإثباتات الهوية (KYC)
        </Label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {docSlots.map((slot) => {
          const docSrc = kyc[slot.key];
          const SlotIcon = slot.icon;

          return (
            <div
              key={slot.key}
              className={cn(
                "relative rounded-2xl border p-3 flex flex-col justify-between transition-all bg-foreground/[0.02]",
                docSrc
                  ? "border-success/40 bg-success/[0.03]"
                  : "border-border/60 hover:border-border"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  {docSrc ? (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-success/15 text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-muted-foreground">
                      <SlotIcon className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <div className="text-right flex-1">
                  <div className="font-bold text-xs">{slot.label}</div>
                  <div className="text-[10px] text-muted-foreground">{slot.description}</div>
                </div>
              </div>

              {/* Body: Image preview or Upload dropzone */}
              {docSrc ? (
                <div className="space-y-2">
                  <div
                    onClick={() => setZoomImage({ title: slot.label, src: docSrc })}
                    className="relative group h-28 w-full overflow-hidden rounded-xl border border-border/50 bg-black/5 cursor-pointer flex items-center justify-center"
                  >
                    <img
                      src={docSrc}
                      alt={slot.label}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-bold">
                      <Eye className="h-4 w-4" />
                      تكبير المستند
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(docSrc, slot.label)}
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      تنزيل
                    </Button>

                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(slot.key)}
                        className="h-7 px-2 text-[11px] text-danger hover:bg-danger/10"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        حذف
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                !readOnly && (
                  <label className="border border-dashed border-border/70 hover:border-primary/60 hover:bg-primary/[0.02] rounded-xl h-24 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[11px] font-bold text-muted-foreground">اضغط لرفع الصورة</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(slot.key, file);
                      }}
                    />
                  </label>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* Fullscreen Zoom Dialog */}
      <Dialog open={!!zoomImage} onOpenChange={(o) => !o && setZoomImage(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-4 flex flex-col items-center">
          <DialogHeader className="w-full">
            <DialogTitle className="text-right text-base font-bold">
              {zoomImage?.title}
            </DialogTitle>
          </DialogHeader>
          {zoomImage && (
            <div className="w-full max-h-[70vh] overflow-auto flex items-center justify-center rounded-xl bg-black/5 p-2">
              <img
                src={zoomImage.src}
                alt={zoomImage.title}
                className="max-h-[68vh] max-w-full rounded-lg object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
