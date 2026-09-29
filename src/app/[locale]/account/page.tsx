import { ArrowRight, Headset } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalHeader } from "@/components/portal/portal-header";
import { InquiryList } from "@/components/portal/inquiry-list";
import { Alert, EmptyState } from "@/components/ui";
import { requireCustomer, withDb } from "@/lib/auth/session";
import { fmt, getDictionary, isLocale } from "@/lib/i18n";
import { getMyCustomer, getPortalCounts, listMyInquiries } from "@/lib/queries/portal";

export default async function AccountOverview({ params, searchParams }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireCustomer(locale);
  const sp = await searchParams;
  const dict = getDictionary(locale);
  const t = dict.portal;
  const { customer, counts, inquiries } = await withDb(async (tx) => ({
    customer: await getMyCustomer(tx),
    counts: await getPortalCounts(tx),
    inquiries: (await listMyInquiries(tx, locale)).slice(0, 4),
  }));
  if (!customer) notFound();

  const tiles = [
    { href: "favorites", label: t.nav.favorites, value: counts.favorites },
    { href: "inquiries", label: t.nav.inquiries, value: counts.open_inquiries, highlight: counts.pending_offers > 0 },
    { href: "reserved", label: t.nav.reserved, value: counts.reserved },
    { href: "purchased", label: t.nav.purchased, value: counts.purchased },
  ];

  return (
    <div>
      <PortalHeader title={fmt(t.welcome, { name: customer.full_name })} />
      {sp.welcome && <Alert tone="info" className="mb-6">{dict.auth.linkNotice}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.href} href={`/${locale}/account/${tile.href}`} className="card group flex flex-col gap-1 p-5 transition-shadow hover:shadow-[var(--shadow-lift)]">
            <span className="label-caps">{tile.label}</span>
            <span className="num font-display text-4xl font-bold">{tile.value}</span>
            {tile.highlight && <span className="text-xs font-semibold text-warn">{t.offerStatus.pending}: {counts.pending_offers}</span>}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_300px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">{t.nav.inquiries}</h2>
            <Link href={`/${locale}/account/inquiries`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
              {dict.common.viewAll} <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          </div>
          {inquiries.length ? <InquiryList items={inquiries} locale={locale} dict={dict} /> : <EmptyState title={t.inquiriesEmpty} />}
        </section>
        <aside className="card h-fit p-5">
          <p className="label-caps">{t.yourSalesperson}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand">
              <Headset className="size-5" aria-hidden />
            </span>
            <p className="font-semibold">{customer.salesperson ?? <span className="font-normal text-muted">{t.noSalesperson}</span>}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
