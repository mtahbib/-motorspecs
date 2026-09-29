import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { simulateDemoMfa } from "@/app/admin/actions/security";
import { TotpEnroll, TotpVerifyForm } from "@/components/admin/totp";
import { Alert, Button } from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";

export const metadata = { title: "Two-step verification" };

/** Shown when a staff profile requires MFA but the session is only AAL1. */
export default async function MfaPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/admin/login");
  if (viewer.isStaff) redirect("/admin");

  let factorId: string | null = null;
  if (!isDemoMode) {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.mfa.listFactors();
    factorId = data?.totp?.find((f) => f.status === "verified")?.id ?? null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-lg p-8">
        <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
          <ShieldCheck className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold">Two-step verification</h1>
        <p className="mt-1 text-muted">Your account requires an authenticator app code before staff tools unlock.</p>
        <div className="mt-6">
          {isDemoMode ? (
            <>
              <Alert tone="info">In demo mode there is no real authenticator. In Supabase mode you would scan a QR code once, then enter a 6-digit code at each sign-in.</Alert>
              <form action={simulateDemoMfa} className="mt-4">
                <Button>Simulate successful verification</Button>
              </form>
            </>
          ) : factorId ? (
            <TotpVerifyForm factorId={factorId} next="/admin" />
          ) : (
            <TotpEnroll next="/admin" />
          )}
        </div>
      </div>
    </div>
  );
}
