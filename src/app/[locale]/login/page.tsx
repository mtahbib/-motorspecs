import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { demoSignIn } from "@/app/actions/auth";
import { SignInForm } from "@/components/site/auth-forms";
import { AuthShell, GoogleButton } from "@/components/site/auth-shell";
import { Alert, DemoBadge } from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import { DEMO_PASSWORD, seedUsers } from "@/lib/demo/seed-data";
import { fmt, getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).common.signIn } : {};
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : undefined;
  const viewer = await getViewer();
  if (viewer) redirect(next ?? (viewer.role === "customer" ? `/${locale}/account` : "/admin"));

  const dict = getDictionary(locale);
  const t = dict.auth;
  const error = typeof sp.error === "string" ? sp.error : null;

  const demoPanel = isDemoMode ? (
    <div className="card p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-2xl font-bold">{t.demoAccounts}</h2>
        <DemoBadge label={dict.common.demoBadge} />
      </div>
      <p className="mt-1 text-sm text-muted">{fmt(t.demoAccountsHint, { password: DEMO_PASSWORD })}</p>
      <div className="mt-5 flex flex-col gap-2">
        {seedUsers.map((u) => (
          <form key={u.id} action={demoSignIn}>
            <input type="hidden" name="userId" value={u.id} />
            <input type="hidden" name="locale" value={locale} />
            {next && u.role === "customer" && <input type="hidden" name="next" value={next} />}
            <button className="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-start transition-colors hover:border-brand hover:bg-brand-soft/50">
              <span>
                <span className="block font-semibold">{u.name}</span>
                <span className="block text-xs text-muted" dir="ltr">{u.email}</span>
              </span>
              <span className="shrink-0 rounded-full bg-page px-2.5 py-1 text-xs font-semibold text-ink">{t.demoRoles[u.role]}</span>
            </button>
          </form>
        ))}
      </div>
    </div>
  ) : undefined;

  return (
    <AuthShell title={t.signInTitle} subtitle={t.signInSubtitle} aside={demoPanel}>
      {error === "google_demo" && <Alert tone="warn" className="mb-4">{t.googleDemo}</Alert>}
      {error && error !== "google_demo" && <Alert tone="danger" className="mb-4">{dict.common.errorGeneric}</Alert>}
      <GoogleButton locale={locale} next={next} label={t.google} disabledNote={isDemoMode ? t.googleDemo : undefined} />
      <div className="my-5 flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-line" /> {t.or} <span className="h-px flex-1 bg-line" />
      </div>
      <SignInForm locale={locale} next={next} labels={{ email: t.email, password: t.password, submit: t.submitSignIn }} />
      <p className="mt-6 text-sm text-muted">
        {t.noAccount}{" "}
        <Link href={`/${locale}/register`} className="font-semibold text-brand hover:underline">{dict.common.register}</Link>
      </p>
    </AuthShell>
  );
}
