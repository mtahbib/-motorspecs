"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * useActionState without React's automatic form reset.
 *
 * Passing a function to <form action> makes React reset every uncontrolled
 * field once the action finishes — even when the action returned a validation
 * error, which would wipe what the user typed. Submitting through onSubmit
 * keeps the fields; callers reset explicitly on success when they want to.
 */
export function useFormAction<S>(
  action: (prev: S, formData: FormData) => Promise<S>,
  options?: { confirm?: string; onResult?: (result: Awaited<S>) => void },
) {
  const [state, dispatch, pending] = useActionState<S, FormData>(async (prev: S, formData: FormData) => {
    const result = await action(prev, formData);
    // Runs even if the form unmounts because the refreshed page no longer shows it.
    options?.onResult?.(result as Awaited<S>);
    return result;
  }, undefined as Awaited<S>);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (options?.confirm && !window.confirm(options.confirm)) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  };
  return { state, pending, onSubmit };
}
