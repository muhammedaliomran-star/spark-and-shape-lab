import { useEffect, useState } from "react";
import { useDB, Branch } from "@/lib/store";
import { getActiveBranchId, setActiveBranchId } from "@/lib/branch-system";
import { GitBranch, ChevronDown, Check, Building2, Store } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function BranchSwitcher({ className }: { className?: string }) {
  const { branches } = useDB();
  const [activeId, setActiveId] = useState<string>(getActiveBranchId());

  useEffect(() => {
    const handleUpdate = () => {
      setActiveId(getActiveBranchId());
    };
    window.addEventListener("segilly_active_branch_changed", handleUpdate);
    return () => window.removeEventListener("segilly_active_branch_changed", handleUpdate);
  }, []);

  const currentBranch = branches.find((b) => b.id === activeId);

  const handleSelect = (id: string) => {
    setActiveBranchId(id);
    setActiveId(id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-2 rounded-full border-foreground/10 bg-card/60 px-3 text-xs font-semibold hover:bg-card/90 shadow-sm transition-all",
            activeId !== "all" && "ring-1 ring-primary/40 bg-primary/10 text-primary border-primary/20",
            className
          )}
        >
          <GitBranch className={cn("h-3.5 w-3.5", activeId !== "all" ? "text-primary" : "text-muted-foreground")} />
          <span className="max-w-[130px] truncate">
            {activeId === "all" ? "كل الفروع" : currentBranch?.name || "الفرع المحدد"}
          </span>
          {activeId !== "all" && currentBranch?.isMain && (
            <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
              الرئيسي
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-2xl border border-foreground/10 bg-card/95 backdrop-blur-xl shadow-xl">
        <DropdownMenuLabel className="px-3 py-1.5 text-xs text-muted-foreground font-medium flex items-center justify-between">
          <span>الفرع النشط حالياً</span>
          <Building2 className="h-3.5 w-3.5 opacity-50" />
        </DropdownMenuLabel>

        <DropdownMenuItem
          onClick={() => handleSelect("all")}
          className={cn(
            "flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-colors",
            activeId === "all" ? "bg-primary text-primary-foreground font-bold" : "hover:bg-accent/60"
          )}
        >
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            <span>عرض كل الفروع (المقر العام)</span>
          </div>
          {activeId === "all" && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 bg-foreground/5" />

        <div className="max-h-60 overflow-y-auto space-y-0.5 no-scrollbar">
          {branches.map((b) => {
            const isSelected = activeId === b.id;
            return (
              <DropdownMenuItem
                key={b.id}
                onClick={() => handleSelect(b.id)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-xs rounded-xl cursor-pointer transition-colors",
                  isSelected ? "bg-primary/15 text-primary font-bold" : "hover:bg-accent/60"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn("h-2 w-2 rounded-full", b.isMain ? "bg-amber-500" : "bg-emerald-500")} />
                  <span className="truncate">{b.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {b.isMain && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold">
                      رئيسي
                    </span>
                  )}
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
              </DropdownMenuItem>
            );
          })}

          {branches.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              لا توجد فروع مسجلة
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
