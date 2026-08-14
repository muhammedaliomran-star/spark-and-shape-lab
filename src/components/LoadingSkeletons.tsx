/**
 * هياكل تحميل (Skeletons) موحّدة — بتظهر بدل «لا توجد بيانات» لحد ما البيانات توصل.
 * كلها توكنز دلالية عشان تشتغل صح في الوضعين الليلي والنهاري.
 */

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={
        "block overflow-hidden rounded-full bg-foreground/[0.07] " +
        "relative after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.6s_infinite] " +
        "after:bg-gradient-to-l after:from-transparent after:via-foreground/[0.08] after:to-transparent " +
        className
      }
    />
  );
}

/** صفوف جدول وهمية. */
export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-[var(--hairline)]">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="p-4">
              <Shimmer className="h-3.5" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** كروت وهمية للوحة التحكم. */
export function CardsSkeleton({ count = 4, height = "h-28" }: { count?: number; height?: string }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`glass rounded-[1.5rem] p-5 ${height}`}
        >
          <Shimmer className="h-3 w-24" />
          <Shimmer className="mt-4 h-6 w-32" />
          <Shimmer className="mt-3 h-2.5 w-16" />
        </div>
      ))}
    </>
  );
}

/** بلوك عام بارتفاع محدد. */
export function BlockSkeleton({ className = "h-64" }: { className?: string }) {
  return <div className={`glass rounded-[1.5rem] ${className}`}><Shimmer className="h-full w-full rounded-[1.5rem]" /></div>;
}

export default TableSkeleton;