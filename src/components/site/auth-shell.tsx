import type { ReactNode } from "react";
import { signInWithGoogle } from "@/app/actions/auth";
import { GaugeArc } from "./gauge-arc";

export function AuthShell({ title, subtitle, children, aside }: { title: string; subtitle: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-10 sm:px-6 lg:grid-cols-[1fr_1fr] lg:pt-16">
      <div className="card p-6 sm:p-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      {aside ?? (
        <div className="relative hidden overflow-hidden rounded-[var(--radius-card)] bg-graphite lg:block">
          <GaugeArc className="absolute -bottom-20 -end-16 w-[520px] opacity-30" />
        </div>
      )}
    </div>
  );
}

export function GoogleButton({ locale, next, label, disabledNote }: { locale: string; next?: string; label: string; disabledNote?: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      <button
        disabled={!!disabledNote}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-white font-semibold text-ink hover:bg-page disabled:cursor-not-allowed disabled:opacity-55"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A11.9 11.9 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
        </svg>
        {label}
      </button>
      {disabledNote && <p className="mt-2 text-center text-xs text-muted">{disabledNote}</p>}
    </form>
  );
}
