import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/config";

/** OAuth (Google) and email-confirmation redirect target for Supabase Auth (PKCE). */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/en/account";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/en/account";

  if (isDemoMode || !code) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/en/login?error=oauth`, url.origin));
  }

  // Staff land in the workspace, customers in their portal.
  const { withDb } = await import("@/lib/auth/session");
  const role = await withDb(async (tx) => (await tx.query<{ role: string }>("select role from public.profiles where id = auth.uid()"))[0]?.role).catch(() => null);
  return NextResponse.redirect(new URL(role === "admin" || role === "sales" ? "/admin" : next, url.origin));
}
