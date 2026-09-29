"use client";

import clsx from "clsx";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { useFormAction } from "@/lib/use-form-action";

type Result = { ok?: boolean; error?: string; message?: string; data?: Record<string, string> } | undefined;

const PendingContext = createContext(false);

/**
 * Form wrapper for staff server actions: shows the action's error or success
 * message inline, keeps the user's input on errors, optionally resets on
 * success, and supports a confirm prompt.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  confirm,
  resultLink,
  resultCode,
  id,
}: {
  id?: string;
  /** After success, link to `${prefix}${data[key]}`. */
  resultLink?: { prefix: string; key: string; label: string };
  /** After success, show data.code prominently (one-time codes) with this hint. */
  resultCode?: { hint: string };
  action: (prev: Result, formData: FormData) => Promise<Result>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useFormAction(action, {
    confirm,
    onResult: (r) => {
      if (r?.ok && r.message && !resultCode) window.dispatchEvent(new CustomEvent("ms:toast", { detail: r.message }));
    },
  });
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <PendingContext.Provider value={pending}>
      <form ref={ref} id={id} onSubmit={onSubmit} className={className} aria-busy={pending}>
        {children}
        {!pending && state?.error && (
          <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.error}
          </p>
        )}
        {!pending && state?.ok && resultCode && state.data?.code ? (
          <div role="status" className="mt-3 rounded-xl border border-ok/30 bg-ok-soft p-3">
            <p className="text-xs text-[#0b6440]">{state.message}</p>
            <p className="num mt-1 text-2xl font-bold tracking-widest text-ink select-all">{state.data.code}</p>
            <p className="mt-1 text-xs text-muted">{resultCode.hint}</p>
          </div>
        ) : (
          !pending &&
          state?.ok &&
          state.message && (
            <p role="status" className="mt-2 flex flex-wrap items-center gap-1.5 text-sm font-medium text-ok">
              <CheckCircle2 className="size-4" aria-hidden /> {state.message}
              {resultLink && state.data?.[resultLink.key] && (
                <Link href={`${resultLink.prefix}${state.data[resultLink.key]}`} className="underline">{resultLink.label}</Link>
              )}
            </p>
          )
        )}
      </form>
    </PendingContext.Provider>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
  form,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
  name?: string;
  value?: string;
  form?: string;
}) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" name={name} value={value} form={form} disabled={pending} className={buttonClass(variant, size, clsx(className))}>
      {pending ? pendingLabel ?? "Working…" : children}
    </button>
  );
}
