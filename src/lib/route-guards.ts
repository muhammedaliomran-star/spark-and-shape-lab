import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Router-level auth gate. Runs before the protected route module renders,
 * so protected pages never mount for signed-out visitors.
 * Protected routes must set `ssr: false` — the Supabase session lives in the browser.
 */
export async function requireAuth() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw redirect({ to: "/landing" });
  }
  return { userId: data.session.user.id };
}

/** Inverse gate for /auth — signed-in users go straight to the dashboard. */
export async function redirectIfAuthed() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    throw redirect({ to: "/" });
  }
}
