"use server";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEMO_SESSION_COOKIE, encodeDemoSession } from "@/lib/auth/demo-session";
import { isDemoMode, siteUrl } from "@/lib/config";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";

export type AuthState = { error?: string; notice?: string } | undefined;

const localeOf = (v: FormDataEntryValue | null): Locale => (isLocale(String(v)) ? (String(v) as Locale) : "en");

/** Only allow same-site relative redirects. */
function safeNext(next: FormDataEntryValue | null, fallback: string) {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

async function setDemoSession(userId: string, aal: "aal1" | "aal2") {
  const { value, maxAge } = encodeDemoSession(userId, aal);
  (await cookies()).set(DEMO_SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

async function demoUserRole(userId: string) {
  const { withDemoSystem } = await import("@/lib/db/pglite-driver");
  return withDemoSystem(async (tx) => {
    const [row] = await tx.query<{ role: string }>("select role from public.profiles where id = $1 and is_active", [userId]);
    return row?.role ?? null;
  });
}

function destinationFor(role: string | null, locale: Locale) {
  return role === "admin" || role === "sales" ? "/admin" : `/${locale}/account`;
}

// -----------------------------------------------------------------------------
// Demo mode: one-click sign-in as a seeded account
// -----------------------------------------------------------------------------
export async function demoSignIn(formData: FormData) {
  if (!isDemoMode) throw new Error("Demo sign-in is only available in demo mode.");
  const locale = localeOf(formData.get("locale"));
  const userId = z.uuid().parse(formData.get("userId"));
  const role = await demoUserRole(userId);
  if (!role) redirect(`/${locale}/login?error=unknown_user`);
  // Staff demo sessions are treated as having completed MFA (aal2).
  await setDemoSession(userId, role === "customer" ? "aal1" : "aal2");
  redirect(safeNext(formData.get("next"), destinationFor(role, locale)));
}

// -----------------------------------------------------------------------------
// Email + password
// -----------------------------------------------------------------------------
const signInSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

export async function signInWithPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const locale = localeOf(formData.get("locale"));
  const t = getDictionary(locale).auth;
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: t.invalidCredentials };
  const { email, password } = parsed.data;
  let role: string | null = null;

  if (isDemoMode) {
    const { withDemoSystem } = await import("@/lib/db/pglite-driver");
    const { hashDemoPassword } = await import("@/lib/demo/seed-sql");
    const user = await withDemoSystem(async (tx) => {
      const [row] = await tx.query<{ id: string; demo_password_hash: string | null; role: string }>(
        `select u.id, u.demo_password_hash, p.role from auth.users u join public.profiles p on p.id = u.id
          where lower(u.email) = lower($1) and p.is_active`,
        [email],
      );
      return row;
    });
    const [, salt] = user?.demo_password_hash?.split("$") ?? [];
    const expected = Buffer.from(user?.demo_password_hash ?? "x");
    const actual = Buffer.from(salt ? hashDemoPassword(password, salt) : "y");
    if (!user || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return { error: t.invalidCredentials };
    }
    role = user.role;
    await setDemoSession(user.id, role === "customer" ? "aal1" : "aal2");
  } else {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: t.invalidCredentials };
    const { withDb } = await import("@/lib/auth/session");
    role = await withDb(async (tx) => (await tx.query<{ role: string }>("select role from public.profiles where id = auth.uid()"))[0]?.role ?? null).catch(() => null);
  }
  redirect(safeNext(formData.get("next"), destinationFor(role, locale)));
}

const signUpSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  email: z.email().max(254),
  password: z.string().min(8).max(200),
  country: z.string().regex(/^[A-Z]{2}$/).optional().or(z.literal("")),
});

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const locale = localeOf(formData.get("locale"));
  const t = getDictionary(locale);
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    country: formData.get("country") ?? "",
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "password" ? `${t.auth.password}: ${t.auth.passwordHint}` : t.common.errorGeneric };
  }
  const { fullName, email, password, country } = parsed.data;
  const metadata = { full_name: fullName, locale, country: country || undefined };

  if (isDemoMode) {
    const { withDemoSystem } = await import("@/lib/db/pglite-driver");
    const { hashDemoPassword } = await import("@/lib/demo/seed-sql");
    const { randomBytes } = await import("node:crypto");
    const result = await withDemoSystem(async (tx) => {
      const [exists] = await tx.query("select 1 from auth.users where lower(email) = lower($1)", [email]);
      if (exists) return null;
      const [row] = await tx.query<{ id: string }>(
        `insert into auth.users (email, raw_user_meta_data, demo_password_hash, email_confirmed_at)
         values ($1, $2::jsonb, $3, now()) returning id`,
        [email.toLowerCase(), JSON.stringify(metadata), hashDemoPassword(password, randomBytes(8).toString("hex"))],
      );
      return row;
    });
    if (!result) return { error: t.auth.emailTaken };
    await setDemoSession(result.id, "aal1");
    redirect(`/${locale}/account?welcome=1`);
  }

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata, emailRedirectTo: `${siteUrl}/auth/callback?next=/${locale}/account` },
  });
  if (error) {
    return { error: /already/i.test(error.message) ? t.auth.emailTaken : t.common.errorGeneric };
  }
  if (!data.session) return { notice: t.auth.checkEmail };
  redirect(`/${locale}/account?welcome=1`);
}

// -----------------------------------------------------------------------------
// Google (Supabase mode)
// -----------------------------------------------------------------------------
export async function signInWithGoogle(formData: FormData) {
  const locale = localeOf(formData.get("locale"));
  if (isDemoMode) redirect(`/${locale}/login?error=google_demo`);
  const next = safeNext(formData.get("next"), `/${locale}/account`);
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/${locale}/login?error=oauth`);
  redirect(data.url);
}

export async function signOut(formData: FormData) {
  const target = safeNext(formData.get("next"), "/");
  if (isDemoMode) {
    (await cookies()).delete(DEMO_SESSION_COOKIE);
  } else {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect(target);
}
