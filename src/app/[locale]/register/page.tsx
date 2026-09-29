import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SignUpForm } from "@/components/site/auth-forms";
import { AuthShell, GoogleButton } from "@/components/site/auth-shell";
import { Alert } from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import { COUNTRY_CODES, countryName } from "@/lib/format";
import { getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]/register">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).common.register } : {};
}

export default async function RegisterPage({ params }: PageProps<"/[locale]/register">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (await getViewer()) redirect(`/${locale}/account`);
  const dict = getDictionary(locale);
  const t = dict.auth;
  const countries = COUNTRY_CODES.map((c) => [c, countryName(c, locale)] as [string, string]).sort((a, b) => a[1].localeCompare(b[1], locale));

  return (
    <AuthShell title={t.registerTitle} subtitle={t.registerSubtitle}>
      <GoogleButton locale={locale} label={t.google} disabledNote={isDemoMode ? t.googleDemo : undefined} />
      <div className="my-5 flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-line" /> {t.or} <span className="h-px flex-1 bg-line" />
      </div>
      <SignUpForm
        locale={locale}
        countries={countries}
        labels={{ fullName: t.fullName, email: t.email, password: t.password, passwordHint: t.passwordHint, country: t.country, optional: dict.common.optional, submit: t.submitRegister }}
      />
      <Alert tone="info" className="mt-5">{t.linkNotice}</Alert>
      <p className="mt-6 text-sm text-muted">
        {t.haveAccount}{" "}
        <Link href={`/${locale}/login`} className="font-semibold text-brand hover:underline">{dict.common.signIn}</Link>
      </p>
    </AuthShell>
  );
}
