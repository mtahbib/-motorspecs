import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isDemoMode } from "../config";
import { getDriver, type DbClaims, type Tx } from "../db";
import type { Locale } from "../i18n/config";
import { DEMO_SESSION_COOKIE, decodeDemoSession } from "./demo-session";

export type AuthUser = { id: string; email: string | null; aal: "aal1" | "aal2" };

export type Role = "admin" | "sales" | "customer";

export type ViewerCustomer = {
  id: string;
  customer_code: string;
  full_name: string;
  email: string | null;
  preferred_language: Locale;
  assigned_staff_id: string | null;
  is_demo: boolean;
};

export type Viewer = {
  user: AuthUser;
  role: Role;
  displayName: string;
  email: string | null;
  isOwner: boolean;
  isActive: boolean;
  isDemo: boolean;
  mfaRequired: boolean;
  /** Staff privileges are only effective when MFA is satisfied (mirrors public.is_staff()). */
  isStaff: boolean;
  isAdmin: boolean;
  needsMfa: boolean;
  customer: ViewerCustomer | null;
};

/** The signed-in user, verified (JWT signature in Supabase mode, HMAC in demo mode). */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  if (isDemoMode) {
    const store = await cookies();
    const session = decodeDemoSession(store.get(DEMO_SESSION_COOKIE)?.value);
    return session ? { id: session.uid, email: null, aal: session.aal } : null;
  }
  const { createSupabaseServerClient } = await import("../supabase/server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims as { sub: string; email?: string; aal?: string };
  return { id: claims.sub, email: claims.email ?? null, aal: claims.aal === "aal2" ? "aal2" : "aal1" };
});

function claimsFor(user: AuthUser | null): DbClaims {
  return user ? { sub: user.id, email: user.email, role: "authenticated", aal: user.aal } : null;
}

/** Runs `fn` as the current user (or anon) with Row Level Security enforced. */
export async function withDb<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const [driver, user] = await Promise.all([getDriver(), getAuthUser()]);
  return driver.withClaims(claimsFor(user), fn);
}

/** Runs `fn` as an anonymous visitor regardless of who is signed in. */
export async function withAnonDb<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const driver = await getDriver();
  return driver.withClaims(null, fn);
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const row = await withDb(async (tx) => {
    const [r] = await tx.query<{
      role: Role;
      display_name: string | null;
      email: string | null;
      is_owner: boolean;
      is_active: boolean;
      is_demo: boolean;
      mfa_required: boolean;
      customer: ViewerCustomer | null;
    }>(
      `select p.role, p.display_name, p.email, p.is_owner, p.is_active, p.is_demo, p.mfa_required,
              (select to_jsonb(c) from (
                 select id, customer_code, full_name, email, preferred_language, assigned_staff_id, is_demo
                 from public.customers where auth_user_id = p.id and status <> 'merged' limit 1) c) as customer
         from public.profiles p where p.id = auth.uid()`,
    );
    return r ?? null;
  });
  if (!row) return null;
  const staffRole = row.role === "admin" || row.role === "sales";
  const mfaOk = !row.mfa_required || user.aal === "aal2";
  return {
    user: { ...user, email: user.email ?? row.email },
    role: row.role,
    displayName: row.display_name ?? row.email ?? "User",
    email: row.email,
    isOwner: row.is_owner,
    isActive: row.is_active,
    isDemo: row.is_demo,
    mfaRequired: row.mfa_required,
    isStaff: staffRole && row.is_active && mfaOk,
    isAdmin: row.role === "admin" && row.is_active && mfaOk,
    needsMfa: staffRole && row.is_active && !mfaOk,
    customer: row.customer,
  };
});

export async function requireStaff(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/admin/login");
  if (viewer.needsMfa) redirect("/admin/mfa");
  if (!viewer.isStaff) redirect("/admin/login?error=not_staff");
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireStaff();
  if (!viewer.isAdmin) redirect("/admin?error=admin_only");
  return viewer;
}

export async function requireCustomer(locale: Locale): Promise<Viewer & { customer: ViewerCustomer }> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/login?next=/${locale}/account`);
  if (viewer.role !== "customer") redirect("/admin");
  if (!viewer.customer) redirect(`/${locale}/login?error=no_customer`);
  return viewer as Viewer & { customer: ViewerCustomer };
}
