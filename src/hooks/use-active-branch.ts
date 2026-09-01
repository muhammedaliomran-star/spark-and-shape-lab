import { useCallback, useEffect, useState } from "react";
import { useDB, type Branch } from "@/lib/store";
import { getActiveBranchId, setActiveBranchId } from "@/lib/branch-system";

/**
 * الفرع النشط عالميًا (Global Branch Scope).
 * يتزامن مع BranchSwitcher عبر حدث segilly_active_branch_changed.
 */
export function useActiveBranch(): {
  activeBranchId: string;
  activeBranch: Branch | null;
  mainBranchId: string | undefined;
  isAllBranches: boolean;
  setBranch: (id: string) => void;
} {
  const { branches } = useDB();
  const [activeBranchId, setId] = useState<string>(() => {
    try {
      return getActiveBranchId();
    } catch {
      return "all";
    }
  });

  useEffect(() => {
    const handler = () => setId(getActiveBranchId());
    window.addEventListener("segilly_active_branch_changed", handler);
    return () => window.removeEventListener("segilly_active_branch_changed", handler);
  }, []);

  const setBranch = useCallback((id: string) => {
    setActiveBranchId(id);
    setId(id);
  }, []);

  const activeBranch = branches.find((b) => b.id === activeBranchId) || null;
  const mainBranchId = (branches.find((b) => b.isMain) || branches[0])?.id;

  return {
    activeBranchId,
    activeBranch,
    mainBranchId,
    isAllBranches: activeBranchId === "all" || !activeBranch,
    setBranch,
  };
}
