"use client";

import { useState, useTransition } from "react";
import { startTotpEnrollment, verifyTotp } from "@/app/admin/actions/security";
import { Button } from "@/components/ui";
import { ActionForm, SubmitButton } from "./action-form";

export function TotpVerifyForm({ factorId, next }: { factorId: string; next?: string }) {
  return (
    <ActionForm action={verifyTotp} className="flex flex-col gap-3">
      <input type="hidden" name="factorId" value={factorId} />
      {next && <input type="hidden" name="next" value={next} />}
      <label className="text-sm font-semibold" htmlFor="totp-code">6-digit code from your authenticator app</label>
      <input id="totp-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className="input num w-40 text-center text-lg tracking-[0.4em]" />
      <SubmitButton>Verify</SubmitButton>
    </ActionForm>
  );
}

export function TotpEnroll({ next }: { next?: string }) {
  const [pending, start] = useTransition();
  const [enrolment, setEnrolment] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!enrolment) {
    return (
      <div>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await startTotpEnrollment();
              if (res?.data) setEnrolment(res.data as { factorId: string; qr: string; secret: string });
              else setError(res?.error ?? "Could not start enrolment");
            })
          }
        >
          Set up authenticator app
        </Button>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={enrolment.qr} alt="Authenticator QR code" className="size-44 rounded-lg border border-line bg-white p-2" />
      <div className="flex-1">
        <p className="text-sm">Scan with Google Authenticator, 1Password, Authy or similar. Or enter this key:</p>
        <code className="num mt-1 block break-all rounded-lg bg-page px-3 py-2 text-sm">{enrolment.secret}</code>
        <div className="mt-4">
          <TotpVerifyForm factorId={enrolment.factorId} next={next} />
        </div>
      </div>
    </div>
  );
}
