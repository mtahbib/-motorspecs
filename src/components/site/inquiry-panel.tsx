"use client";

import clsx from "clsx";
import Link from "next/link";
import { useActionState, useState } from "react";
import { submitInquiry, type FormState } from "@/app/actions/customer";
import { Alert, Button, Field } from "@/components/ui";

type Labels = {
  title: string;
  offerTitle: string;
  subject: string;
  message: string;
  messagePlaceholder: string;
  offerAmount: string;
  destinationPort: string;
  submit: string;
  submitOffer: string;
  sending: string;
  viewConversation: string;
  optional: string;
};

export function InquiryPanel({
  vehicleId,
  locale,
  defaultSubject,
  defaultPort,
  labels,
  allowOffer,
}: {
  vehicleId: string;
  locale: string;
  defaultSubject: string;
  defaultPort: string;
  labels: Labels;
  allowOffer: boolean;
}) {
  const [mode, setMode] = useState<"inquiry" | "offer">("inquiry");
  const [state, action, pending] = useActionState<FormState, FormData>(submitInquiry, undefined);

  if (state?.ok) {
    return (
      <Alert tone="ok" title={state.message}>
        <Link href={`/${locale}/account/inquiries`} className="mt-1 inline-block font-semibold underline">
          {labels.viewConversation}
        </Link>
      </Alert>
    );
  }

  return (
    <div>
      {allowOffer && (
        <div className="mb-4 grid grid-cols-2 rounded-xl bg-page p-1" role="tablist">
          {(["inquiry", "offer"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={clsx("rounded-lg py-2 text-sm font-semibold", mode === m ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")}
            >
              {m === "inquiry" ? labels.title : labels.offerTitle}
            </button>
          ))}
        </div>
      )}
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="vehicleId" value={vehicleId} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="subject" value={defaultSubject} />
        {mode === "offer" && (
          <Field label={labels.offerAmount} htmlFor="offerAmount" error={state?.fieldErrors?.offerAmount}>
            <input id="offerAmount" name="offerAmount" type="number" min={1} step={50} required inputMode="numeric" dir="ltr" className="input num" />
          </Field>
        )}
        <Field label={labels.destinationPort} htmlFor="destinationPort" optional={labels.optional}>
          <input id="destinationPort" name="destinationPort" defaultValue={defaultPort} maxLength={120} className="input" />
        </Field>
        <Field label={labels.message} htmlFor="message" error={state?.fieldErrors?.message}>
          <textarea id="message" name="message" required minLength={2} maxLength={5000} rows={4} placeholder={labels.messagePlaceholder} className="input resize-y" />
        </Field>
        {state?.error && !state.fieldErrors && <Alert tone="danger">{state.error}</Alert>}
        <Button type="submit" disabled={pending} size="lg">
          {pending ? labels.sending : mode === "offer" ? labels.submitOffer : labels.submit}
        </Button>
      </form>
    </div>
  );
}
