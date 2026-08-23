import { useProfile } from "@/lib/store";
import { cn } from "@/lib/utils";

function initials(label: string, email?: string) {
  const src = (label || email || "?").trim();
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

/** Signed-in avatar + name, so it's always obvious which account is active. */
export function UserAvatar({ size = 36, className = "" }: { size?: number; className?: string }) {
  const { avatar, label, user } = useProfile();
  const px = { width: size, height: size };
  return (
    <span
      style={px}
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-foreground/[0.06] ring-1 ring-border",
        "shadow-[inset_0_1px_1px_hsl(0_0%_100%/0.08)]",
        className,
      )}
    >
      {avatar ? (
        <img src={avatar} alt="" width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground" dir="ltr">
          {initials(label, user?.email)}
        </span>
      )}
    </span>
  );
}

export function UserChip({ className = "" }: { className?: string }) {
  const { label, user, loading } = useProfile();

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2.5 rounded-full px-2 py-1.5", className)}>
        <div className="flex items-center gap-2.5 rounded-full px-2 py-1.5">
          <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-foreground/10" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-2.5 w-24 animate-pulse rounded-full bg-foreground/10" />
            <span className="block h-2 w-32 animate-pulse rounded-full bg-foreground/[0.07]" />
          </span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-full px-2 py-1.5",
        "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
        className,
      )}
    >
      <UserAvatar />
      <span className="min-w-0 flex-1 text-right">
        <span className="block truncate text-sm font-semibold leading-tight">
          {label || "حسابي"}
        </span>
      </span>
    </div>
  );
}
