"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEMO_SESSION_COOKIE, encodeDemoSession } from "@/lib/auth/demo-session";
import { getAuthUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import type { ActionResult } from "@/lib/admin/action-helpers";

/**
 * Authenticator-app (TOTP) MFA through Supabase Auth.
 * Completing a challenge upgrades the session to AAL2, which is what
 * public.is_staff() requires for staff whose profile has mfa_required = true.
 */

async function supabase() {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  return createSupabaseServerClient();
}

export async function startTotpEnrollment(): Promise<ActionResult> {
  if (isDemoMode) return { error: "Authenticator enrolment needs a connected Supabase project." };
  const client = await supabase();
  const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `MotorSpecs ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return { error: error?.message ?? "Could not start enrolment" };
  return { ok: true, message: "Scan the QR code", data: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret } };
}

const verifySchema = z.object({ factorId: z.string().min(1).max(100), code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });

export async function verifyTotp(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (isDemoMode) return { error: "Not available in demo mode." };
  const parsed = verifySchema.safeParse({ factorId: formData.get("factorId"), code: formData.get("code") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const client = await supabase();
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId: parsed.data.factorId, code: parsed.data.code });
  if (error) return { error: "That code is not valid. Check your authenticator app and try again." };
  const next = String(formData.get("next") ?? "");
  if (next === "/admin") redirect("/admin");
  return { ok: true, message: "Authenticator verified." };
}

export async function removeTotpFactor(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (isDemoMode) return { error: "Not available in demo mode." };
  const factorId = z.string().min(1).parse(formData.get("factorId"));
  const client = await supabase();
  const { error } = await client.auth.mfa.unenroll({ factorId });
  if (error) return { error: error.message };
  return { ok: true, message: "Authenticator removed." };
}

/** Demo only: mark the demo session as having completed MFA. */
export async function simulateDemoMfa() {
  if (!isDemoMode) return;
  const user = await getAuthUser();
  if (!user) redirect("/admin/login");
  const { value, maxAge } = encodeDemoSession(user.id, "aal2");
  (await cookies()).set(DEMO_SESSION_COOKIE, value, { httpOnly: true, sameSite: "lax", path: "/", maxAge, secure: process.env.NODE_ENV === "production" });
  redirect("/admin");
}
