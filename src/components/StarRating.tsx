import { Star } from "lucide-react";

export function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="inline-flex gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          width={size}
          height={size}
          className={i <= value ? "fill-warning text-warning" : "text-muted-foreground/40"}
        />
      ))}
    </div>
  );
}
