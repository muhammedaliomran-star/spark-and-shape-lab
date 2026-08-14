import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().trim().email().max(200),
  role: z.enum(["owner", "manager", "seller"]),
  redirectTo: z.string().trim().url().max(500).optional(),
});

/** يبعت دعوة لعضو فريق جديد (المالك فقط). */
export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isOwner } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "owner",
    });
    if (!isOwner) throw new Error("المالك بس اللي يقدر يدعو أعضاء");

    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // لو الحساب موجود بالفعل: ندّيله الصلاحية على طول
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);

    if (existing) {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: existing.id, role: data.role }, { onConflict: "user_id,role" });
      if (roleErr) throw new Error(roleErr.message);
      await supabaseAdmin
        .from("team_invites")
        .insert({
          invited_by: userId,
          email,
          role: data.role,
          status: "accepted",
          accepted_by: existing.id,
          accepted_at: new Date().toISOString(),
        });
      return { status: "added" as const };
    }

    const { error: inviteRowErr } = await supabase
      .from("team_invites")
      .insert({ invited_by: userId, email, role: data.role });
    if (inviteRowErr) {
      if (inviteRowErr.code === "23505" || /duplicate/i.test(inviteRowErr.message)) {
        throw new Error("فيه دعوة سارية للبريد ده بالفعل");
      }
      throw new Error(inviteRowErr.message);
    }

    const { error: mailErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: data.redirectTo,
    });
    if (mailErr) return { status: "pending_no_email" as const, message: mailErr.message };

    return { status: "invited" as const };
  });
