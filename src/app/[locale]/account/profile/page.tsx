import { notFound } from "next/navigation";
import { PortalHeader } from "@/components/portal/portal-header";
import { ProfileForm } from "@/components/portal/profile-form";
import { requireCustomer, withDb } from "@/lib/auth/session";
import { COUNTRY_CODES, countryName } from "@/lib/format";
import { getDictionary, isLocale, localeNames, locales } from "@/lib/i18n";
import { getMyCustomer } from "@/lib/queries/portal";

export default async function ProfilePage({ params }: PageProps<"/[locale]/account/profile">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireCustomer(locale);
  const dict = getDictionary(locale);
  const t = dict.portal;
  const customer = await withDb(getMyCustomer);
  if (!customer) notFound();
  const codes = new Set(COUNTRY_CODES);
  if (customer.country_code) codes.add(customer.country_code);
  const countries = [...codes].map((c) => [c, countryName(c, locale)] as [string, string]).sort((a, b) => a[1].localeCompare(b[1], locale));

  return (
    <div>
      <PortalHeader title={t.profileTitle} intro={t.profileIntro} />
      <ProfileForm
        locale={locale}
        customer={customer}
        countries={countries}
        contactValues={t.contactValues}
        languages={locales.map((l) => [l, localeNames[l]])}
        labels={{
          fullName: t.fullName, company: t.company, phone: t.phone, whatsapp: t.whatsapp, country: t.country, city: t.city,
          address: t.address, postalCode: t.postalCode, destinationPort: t.destinationPort, preferredLanguage: t.preferredLanguage,
          preferredContact: t.preferredContact, save: dict.common.save, saving: dict.common.saving, optional: dict.common.optional,
        }}
      />
    </div>
  );
}
