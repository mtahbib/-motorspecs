import { MessageSquare } from "lucide-react";
import { notFound } from "next/navigation";
import { InquiryList } from "@/components/portal/inquiry-list";
import { PortalHeader } from "@/components/portal/portal-header";
import { ButtonLink, EmptyState } from "@/components/ui";
import { requireCustomer, withDb } from "@/lib/auth/session";
import { getDictionary, isLocale } from "@/lib/i18n";
import { listMyInquiries } from "@/lib/queries/portal";

export default async function InquiriesPage({ params }: PageProps<"/[locale]/account/inquiries">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireCustomer(locale);
  const dict = getDictionary(locale);
  const items = await withDb((tx) => listMyInquiries(tx, locale));

  return (
    <div>
      <PortalHeader title={dict.portal.inquiriesTitle} />
      {items.length ? (
        <InquiryList items={items} locale={locale} dict={dict} />
      ) : (
        <EmptyState icon={<MessageSquare className="size-8" />} title={dict.portal.inquiriesEmpty}>
          <ButtonLink href={`/${locale}/vehicles`} className="mt-4">{dict.home.browseStock}</ButtonLink>
        </EmptyState>
      )}
    </div>
  );
}
