import { ShieldCheck } from "lucide-react";
import { removeTotpFactor } from "@/app/admin/actions/security";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { PageHeader, Panel } from "@/components/admin/kit";
import { TotpEnroll } from "@/components/admin/totp";
import { Alert, Badge } from "@/components/ui";
import { requireStaff } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";

export const metadata = { title: "Sign-in security" };

export default async function SecurityPage() {
  const viewer = await requireStaff();
  let factors: { id: string; friendly_name?: string; status: string; created_at: string }[] = [];
  if (!isDemoMode) {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.mfa.listFactors();
    factors = (data?.totp ?? []).map((f) => ({ id: f.id, friendly_name: f.friendly_name, status: f.status, created_at: f.created_at }));
  }
  const verified = factors.filter((f) => f.status === "verified");

  return (
    <div className="max-w-3xl">
      <PageHeader title="Sign-in security" description="Protect your staff account with an authenticator app (Google Authenticator, 1Password, Authy…)." />
      <Panel title={<span className="inline-flex items-center gap-2"><ShieldCheck className="size-5 text-brand" /> Authenticator app (TOTP)</span>}>
        <p className="text-sm">
          Status for {viewer.displayName}:{" "}
          {viewer.mfaRequired ? <Badge tone="ok">Required for your account</Badge> : <Badge>Optional for your account</Badge>}{" "}
          <Badge tone={viewer.user.aal === "aal2" ? "ok" : "neutral"}>This session: {viewer.user.aal === "aal2" ? "verified with code" : "password only"}</Badge>
        </p>
        {isDemoMode ? (
          <Alert tone="info" className="mt-4">
            Demo mode has no real authenticator. With a connected Supabase project this page lets you scan a QR code; the owner can then tick “Require MFA” for any staff member, and the database withholds staff permissions until the code is entered at sign-in.
          </Alert>
        ) : (
          <div className="mt-5">
            {verified.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {verified.map((f) => (
                  <li key={f.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm">
                    <span>{f.friendly_name ?? "Authenticator"} · added {new Date(f.created_at).toLocaleDateString("en")}</span>
                    {!viewer.mfaRequired && (
                      <ActionForm action={removeTotpFactor} confirm="Remove this authenticator?">
                        <input type="hidden" name="factorId" value={f.id} />
                        <SubmitButton size="sm" variant="ghost" pendingLabel="…">Remove</SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <TotpEnroll />
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
