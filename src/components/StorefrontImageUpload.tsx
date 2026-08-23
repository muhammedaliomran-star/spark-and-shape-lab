import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { uploadStorefrontProductImage } from "@/lib/storefront";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function StorefrontImageUpload({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadStorefrontProductImage(file);
      onChange([...images, url]);
      toast.success("اترفعت الصورة");
    } catch (error: any) {
      toast.error(error.message ?? "تعذر رفع الصورة");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return <div className="grid gap-3"><input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} /><Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} رفع صورة من الجهاز</Button>{images.length > 0 && <div className="grid grid-cols-3 gap-2">{images.map((url, index) => <div key={url} className="relative aspect-square overflow-hidden rounded-xl border"><img src={url} alt={`صورة المنتج ${index + 1}`} className="h-full w-full object-cover" /><button type="button" aria-label="حذف الصورة" className="absolute left-1 top-1 rounded-lg bg-black/70 p-1 text-white" onClick={() => onChange(images.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-3 w-3" /></button></div>)}</div>}</div>;
}
