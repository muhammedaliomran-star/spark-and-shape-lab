/**
 * Roles & permissions.
 *
 * Roles live in the `user_roles` table (never on profiles) and are checked
 * server-side by the `has_role()` security-definer function used inside RLS.
 * The helpers here are for UI affordances only — the database is the gate.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/store";

export type AppRole = "owner" | "manager" | "seller";

export const ROLE_LABEL: Record<AppRole, string> = {
  owner: "مالك",
  manager: "مدير",
  seller: "بايع",
};

export const ROLE_HINT: Record<AppRole, string> = {
  owner: "صلاحية كاملة على كل البيانات والإعدادات وإدارة الفريق.",
  manager: "إدارة الفواتير والمخزون والموردين بدون التحكم في الفريق.",
  seller: "تسجيل المبيعات والدفعات فقط.",
};

const ROLE_RANK: Record<AppRole, number> = { owner: 3, manager: 2, seller: 1 };

export interface TeamMember {
  userId: string;
  role: AppRole;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: string | null;
  isMe: boolean;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: AppRole;
  status: "pending" | "accepted" | "revoked";
  expiresAt: string;
  createdAt: string;
}

/** مصفوفة الصلاحيات المعروضة في كارت "صلاحيتك". */
export const ABILITIES: Array<{ label: string; roles: AppRole[] }> = [
  { label: "تسجيل مبيعات ودفعات", roles: ["owner", "manager", "seller"] },
  { label: "إدارة العملاء والفواتير", roles: ["owner", "manager"] },
  { label: "المخزون والموردين والمصروفات", roles: ["owner", "manager"] },
  { label: "التقارير والنسخ الاحتياطي", roles: ["owner", "manager"] },
  { label: "إعدادات المحل", roles: ["owner"] },
  { label: "دعوة أعضاء وتغيير الصلاحيات", roles: ["owner"] },
];

/** Highest role of the signed-in user (null while loading / signed out). */
export function useMyRole() {
  const { user, ready } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setRole(null); setLoading(false); return; }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (data ?? []).map((r) => r.role as AppRole);
    roles.sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);
    setRole(roles[0] ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { if (ready) void load(); }, [ready, load]);

  return { role, loading, reload: load, isOwner: role === "owner", canManage: role === "owner" || role === "manager" };
}

/** All members visible to the signed-in user, via the security-definer directory. */
export function useTeam() {
  const { user, ready } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setMembers([]); setInvites([]); setLoading(false); return; }
    setLoading(true);
    const [{ data: rows }, { data: inviteRows }] = await Promise.all([
      supabase.rpc("team_directory"),
      supabase.from("team_invites").select("id, email, role, status, expires_at, created_at").order("created_at", { ascending: false }),
    ]);
    setMembers(
      (rows ?? []).map((r) => ({
        userId: r.user_id as string,
        role: r.role as AppRole,
        displayName: (r.display_name as string) || "مستخدم",
        avatarUrl: (r.avatar_url as string | null) ?? null,
        lastSeenAt: (r.last_seen_at as string | null) ?? null,
        isMe: r.user_id === user.id,
      })).sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role]),
    );
    setInvites(
      (inviteRows ?? []).map((r) => ({
        id: r.id,
        email: r.email,
        role: r.role as AppRole,
        status: r.status as TeamInvite["status"],
        expiresAt: r.expires_at,
        createdAt: r.created_at,
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => { if (ready) void load(); }, [ready, load]);

  const setRole = useCallback(async (userId: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").update({ role }).eq("user_id", userId);
    if (error) throw error;
    await load();
  }, [load]);

  const removeMember = useCallback(async (userId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (error) throw error;
    await load();
  }, [load]);

  const revokeInvite = useCallback(async (id: string) => {
    const { error } = await supabase.from("team_invites").update({ status: "revoked" }).eq("id", id);
    if (error) throw error;
    await load();
  }, [load]);

  return { members, invites, loading, reload: load, setRole, removeMember, revokeInvite };
}

/** "آخر نشاط" بصيغة بشرية. */
export function relativeTime(iso: string | null): string {
  if (!iso) return "لسه مدخلش";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  if (d < 30) return `قبل ${d} يوم`;
  return new Date(iso).toLocaleDateString("en-US");
}
