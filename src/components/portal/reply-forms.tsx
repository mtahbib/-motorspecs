"use client";

import { Send } from "lucide-react";
import { useActionState, useRef } from "react";
import { makeCounterOffer, sendCustomerMessage, type FormState } from "@/app/actions/customer";
import { Alert, Button } from "@/components/ui";

export function CustomerReplyForm({ inquiryId, locale, labels }: { inquiryId: string; locale: string; labels: { placeholder: string; send: string } }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await sendCustomerMessage(prev, fd);
    if (result?.ok) formRef.current?.reset();
    return result;
  }, undefined);
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <input type="hidden" name="locale" value={locale} />
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="reply-body">{labels.placeholder}</label>
        <textarea id="reply-body" name="body" required maxLength={5000} rows={2} placeholder={labels.placeholder} dir="auto" className="input flex-1 resize-y" />
        <Button type="submit" disabled={pending} className="h-auto self-stretch" aria-label={labels.send}>
          <Send className="size-4 rtl:-scale-x-100" aria-hidden />
        </Button>
      </div>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
    </form>
  );
}

export function CounterOfferForm({ inquiryId, locale, labels }: { inquiryId: string; locale: string; labels: { amount: string; submit: string } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(makeCounterOffer, undefined);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <input type="hidden" name="locale" value={locale} />
      <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
        {labels.amount}
        <input name="amount" type="number" min={1} step={50} required inputMode="numeric" dir="ltr" className="input num" />
      </label>
      <Button type="submit" variant="secondary" disabled={pending}>{labels.submit}</Button>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
    </form>
  );
}
