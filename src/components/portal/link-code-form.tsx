"use client";

import { useActionState } from "react";
import { redeemInvite, type FormState } from "@/app/actions/customer";
import { Alert, Button } from "@/components/ui";

export function LinkCodeForm({ locale, labels }: { locale: string; labels: { code: string; submit: string } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(redeemInvite, undefined);
  if (state?.ok) return <Alert tone="ok">{state.message}</Alert>;
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="locale" value={locale} />
      <label className="flex flex-1 flex-col gap-1.5 text-sm font-semibold">
        {labels.code}
        <input name="code" required maxLength={40} autoComplete="one-time-code" placeholder="XXXX-XXXX-XXXX" dir="ltr" className="input num uppercase tracking-widest" />
      </label>
      <Button type="submit" disabled={pending}>{labels.submit}</Button>
      {state?.error && <Alert tone="danger" className="sm:basis-full">{state.error}</Alert>}
    </form>
  );
}
