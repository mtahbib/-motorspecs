import { Link2, Lock } from "lucide-react";
import { notFound } from "next/navigation";
import { LinkCodeForm } from "@/components/portal/link-code-form";
import { PortalHeader } from "@/components/portal/portal-header";
import { KeyValue, StatusBadge } from "@/components/ui";
import { requireCustomer, withDb } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { getDictionary, isLocale } from "@/lib/i18n";
import { getMyCustomer } from "@/lib/queries/portal";

export default async function AccountInfoPage({ params }: PageProps<"/[locale]/account/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const viewer = await requireCustomer(locale);
  const dict = getDictionary(locale);
  const t = dict.portal;
  const customer = await withDb(getMyCustomer);
  if (!customer) notFound();

  return (
    <div>
      <PortalHeader title={t.accountTitle} intro={t.accountIntro} />
      <section className="card p-5 sm:p-6">
        <p className="label-caps mb-2 inline-flex items-center gap-1.5">
          <Lock className="size-3.5" aria-hidden /> {t.readOnly}
        </p>
        <KeyValue
          items={[
            { label: t.customerId, value: <span dir="ltr">{customer.customer_code}</span> },
            { label: t.loginEmail, value: <span dir="ltr">{viewer.user.email ?? customer.email}</span> },
            { label: t.memberSince, value: formatDate(customer.created_at, locale) },
            {
              label: t.verification,
              value: <StatusBadge status={customer.verification_status} label={t.verificationValues[customer.verification_status]} />,
            },
            { label: t.verifiedName, value: customer.verified_name },
            { label: t.verifiedCompany, value: customer.verified_company },
            { label: t.yourSalesperson, value: customer.salesperson ?? t.noSalesperson },
          ]}
        />
      </section>

      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Link2 className="size-5 text-brand" aria-hidden /> {t.linkTitle}
        </h2>
        <p className="mt-1 mb-4 max-w-2xl text-sm text-muted">{t.linkIntro}</p>
        <LinkCodeForm locale={locale} labels={{ code: t.linkCode, submit: t.linkSubmit }} />
      </section>
    </div>
  );
}
