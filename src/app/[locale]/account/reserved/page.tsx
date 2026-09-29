import { Handshake } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VehicleThumb } from "@/components/portal/inquiry-list";
import { PortalHeader } from "@/components/portal/portal-header";
import { Alert, EmptyState, StatusBadge } from "@/components/ui";
import { requireCustomer, withDb } from "@/lib/auth/session";
import { formatDateTime, formatUsd } from "@/lib/format";
import { getDictionary, isLocale } from "@/lib/i18n";
import { listMyReservations } from "@/lib/queries/portal";

export default async function ReservedPage({ params }: PageProps<"/[locale]/account/reserved">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireCustomer(locale);
  const dict = getDictionary(locale);
  const t = dict.portal;
  const items = await withDb((tx) => listMyReservations(tx, locale));

  return (
    <div>
      <PortalHeader title={t.reservedTitle} />
      {items.length === 0 ? (
        <EmptyState icon={<Handshake className="size-8" />} title={t.reservedEmpty} />
      ) : (
        <>
          <Alert tone="info" className="mb-4">{t.reservedHint}</Alert>
          <ul className="flex flex-col gap-4">
            {items.map((r) => (
              <li key={r.id} className="card flex flex-wrap items-center gap-4 p-4">
                <VehicleThumb cover={r.vehicle?.cover} className="h-20 w-32" />
                <div className="min-w-0 flex-1">
                  <p className="num text-xs text-muted" dir="ltr">{r.vehicle?.ref_no}</p>
                  {r.vehicle && (
                    <Link href={`/${locale}/vehicles/${r.vehicle.slug}`} className="font-semibold hover:text-brand">{r.vehicle.title}</Link>
                  )}
                  <p className="mt-1 text-sm text-muted">
                    {t.reservedUntil}: <span className="font-semibold text-ink">{formatDateTime(r.reserved_until, locale)}</span>
                  </p>
                </div>
                <div className="text-end">
                  <StatusBadge status={r.status} label={t.reservationStatus[r.status as keyof typeof t.reservationStatus]} />
                  {r.agreed_price_usd && (
                    <p className="mt-2 text-sm text-muted">
                      {t.agreedPrice}
                      <span className="num block font-display text-xl font-bold text-ink" dir="ltr">{formatUsd(r.agreed_price_usd, locale)}</span>
                    </p>
                  )}
                  {r.inquiry_id && (
                    <Link href={`/${locale}/account/inquiries/${r.inquiry_id}`} className="mt-1 inline-block text-sm font-semibold text-brand hover:underline">
                      {dict.inquiry.viewConversation}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
