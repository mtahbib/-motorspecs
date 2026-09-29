import { notFound } from "next/navigation";
import { PortalNav } from "@/components/portal/portal-nav";
import { DemoBadge } from "@/components/ui";
import { requireCustomer, withDb } from "@/lib/auth/session";
import { initials } from "@/lib/format";
import { getDictionary, isLocale } from "@/lib/i18n";
import { getPortalCounts } from "@/lib/queries/portal";

export default async function AccountLayout({ children, params }: LayoutProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const viewer = await requireCustomer(locale);
  const dict = getDictionary(locale);
  const t = dict.portal;
  const counts = await withDb(getPortalCounts);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[250px_1fr] lg:gap-10">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-4 flex items-center gap-3 lg:mb-6">
            <span className="grid size-11 place-items-center rounded-full bg-brand font-display text-lg font-bold text-white">{initials(viewer.customer.full_name)}</span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{viewer.customer.full_name}</p>
              <p className="num flex items-center gap-2 text-xs text-muted" dir="ltr">
                {viewer.customer.customer_code}
                {viewer.customer.is_demo && <DemoBadge label={dict.common.demoBadge} />}
              </p>
            </div>
          </div>
          <PortalNav
            locale={locale}
            items={[
              { key: "overview", label: t.overview },
              { key: "profile", label: t.nav.profile },
              { key: "account", label: t.nav.account },
              { key: "favorites", label: t.nav.favorites, badge: counts.favorites },
              { key: "inquiries", label: t.nav.inquiries, badge: counts.pending_offers },
              { key: "reserved", label: t.nav.reserved, badge: counts.reserved },
              { key: "purchased", label: t.nav.purchased, badge: counts.purchased },
            ]}
          />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
