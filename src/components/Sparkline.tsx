import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Sparkline مصغّر — يرث اللون من الأب عبر currentColor
 * علشان ميكسرش نظام الألوان الدلالي.
 */
export function Sparkline({
  data,
  className,
  height = 40,
  area = true,
  strokeWidth = 1.75,
}: {
  data: number[];
  className?: string;
  height?: number;
  area?: boolean;
  strokeWidth?: number;
}) {
  const id = useId().replace(/:/g, "");
  const pts = data.length > 1 ? data : [0, 0];
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  // مفيش داتا حقيقية؟ ما نرسمش خط شبح — أنضف من خط متقطع فاضي.
  if (max === 0 && min === 0) return null;
  const range = max - min || 1;
  const W = 100;
  const H = height;
  const pad = 3;
  const step = W / (pts.length - 1);

  const coords = pts.map((v, i) => {
    const x = i * step;
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return [x, y] as const;
  });

  const line = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const shape = `${line} L${W},${H} L0,${H} Z`;
  const last = coords[coords.length - 1];
  const flat = max === min;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("w-full overflow-visible", className)}
      style={{ height }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`sparkFill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      {area && !flat && <path d={shape} fill={`url(#sparkFill-${id})`} />}
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity={flat ? 0.35 : 1}
        strokeDasharray={flat ? "3 4" : undefined}
      />
      {!flat && (
        <circle
          cx={last[0]}
          cy={last[1]}
          r={2.4}
          fill="currentColor"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
