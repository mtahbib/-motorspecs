"use client";

import { useActionState } from "react";
import { signInWithPassword, signUp, type AuthState } from "@/app/actions/auth";
import { Alert, Button, Field } from "@/components/ui";

type Labels = Record<string, string>;

export function SignInForm({ locale, next, labels }: { locale: string; next?: string; labels: Labels }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signInWithPassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field label={labels.email} htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className="input" dir="ltr" />
      </Field>
      <Field label={labels.password} htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" dir="ltr" />
      </Field>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" size="lg" disabled={pending}>
        {labels.submit}
      </Button>
    </form>
  );
}

export function SignUpForm({ locale, labels, countries }: { locale: string; labels: Labels; countries: [string, string][] }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, undefined);
  if (state?.notice) return <Alert tone="ok">{state.notice}</Alert>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <Field label={labels.fullName} htmlFor="fullName">
        <input id="fullName" name="fullName" autoComplete="name" required maxLength={160} className="input" />
      </Field>
      <Field label={labels.email} htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className="input" dir="ltr" />
      </Field>
      <Field label={labels.password} htmlFor="password" hint={labels.passwordHint}>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" dir="ltr" />
      </Field>
      <Field label={labels.country} htmlFor="country" optional={labels.optional}>
        <select id="country" name="country" className="input" defaultValue="">
          <option value="">—</option>
          {countries.map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      </Field>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" size="lg" disabled={pending}>
        {labels.submit}
      </Button>
    </form>
  );
}
