import { CarFront } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentList } from "@/components/document-list";
import { VehicleThumb } from "@/components/portal/inquiry-list";
import { PortalHeader } from "@/components/portal/portal-header";
import { ShipmentProgress } from "@/components/shipment-progress";
import { EmptyState, KeyValue, StatusBadge } from "@/components/ui";
import { requireCustomer, withDb } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatUsd } from "@/lib/format";
import { getDictionary, isLocale } from "@/lib/i18n";
import { listMyOtherDocuments, listMyPurchases } from "@/lib/queries/portal";

export default async function PurchasedPage({ params }: PageProps<"/[locale]/account/purchased">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireCustomer(locale);
  const dict = getDictionary(locale);
  const t = dict.portal;
  const { purchases, otherDocs } = await withDb(async (tx) => ({
    purchases: await listMyPurchases(tx, locale),
    otherDocs: await listMyOtherDocuments(tx),
  }));

  return (
    <div>
      <PortalHeader title={t.purchasedTitle} />
      {purchases.length === 0 && <EmptyState icon={<CarFront className="size-8" />} title={t.purchasedEmpty} />}

      <div className="flex flex-col gap-6">
        {purchases.map((s) => {
          const paid = s.payments.filter((p) => p.status !== "void").reduce((sum, p) => sum + p.amount_usd, 0);
          const balance = Math.max(0, s.total_usd - paid);
          return (
            <article key={s.id} className="card overflow-hidden">
              <header className="flex flex-wrap items-center gap-4 border-b border-line p-4 sm:p-5">
                <VehicleThumb cover={s.vehicle?.cover} className="h-20 w-32" />
                <div className="min-w-0 flex-1">
                  <p className="num text-xs text-muted" dir="ltr">{t.saleNo} {s.sale_no} · {s.vehicle?.ref_no}</p>
                  {s.vehicle && (
                    <Link href={`/${locale}/vehicles/${s.vehicle.slug}`} className="font-display text-xl font-bold hover:text-brand">
                      {s.vehicle.title}
                    </Link>
                  )}
                  <p className="text-sm text-muted">{t.orderDate}: {formatDate(s.sold_at, locale)}</p>
                </div>
                <StatusBadge status={s.status} label={t.saleStatus[s.status as keyof typeof t.saleStatus]} />
              </header>

              <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-2">
                <section>
                  <h3 className="label-caps mb-2">{t.payments}</h3>
                  <KeyValue
                    className="!grid-cols-1"
                    items={[
                      { label: t.invoiceNo, value: s.invoice_no && <span dir="ltr">{s.invoice_no}</span> },
                      { label: `${t.total} (${s.incoterm})`, value: <span dir="ltr">{formatUsd(s.total_usd, locale, 2)}</span> },
                      { label: t.amountPaid, value: <span dir="ltr" className="text-ok">{formatUsd(paid, locale, 2)}</span> },
                      { label: t.balance, value: <span dir="ltr" className={balance > 0 ? "text-warn" : undefined}>{formatUsd(balance, locale, 2)}</span> },
                    ]}
                  />
                  {s.payments.length ? (
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {s.payments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-page px-3 py-2 text-sm">
                          <span className="num">{formatDate(p.paid_on, locale)}</span>
                          <span className="num font-semibold" dir="ltr">{formatUsd(p.amount_usd, locale, 2)}</span>
                          <StatusBadge status={p.status} label={t.paymentStatus[p.status as keyof typeof t.paymentStatus]} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted">{t.noPayments}</p>
                  )}
                </section>

                <section>
                  <h3 className="label-caps mb-2">{t.documents}</h3>
                  <DocumentList documents={s.documents} locale={locale} kindLabels={t.documentKinds} downloadLabel={t.download} emptyLabel={t.noDocuments} />
                </section>

                {s.shipment && (
                  <section className="lg:col-span-2">
                    <h3 className="label-caps mb-4">{t.shipping}</h3>
                    <ShipmentProgress status={s.shipment.status} labels={t.shipmentStatus} />
                    <KeyValue
                      className="mt-5"
                      items={[
                        { label: t.vessel, value: s.shipment.vessel_name },
                        { label: t.voyage, value: s.shipment.voyage_no },
                        { label: t.portOfLoading, value: s.shipment.port_of_loading },
                        { label: t.portOfDischarge, value: s.shipment.port_of_discharge },
                        { label: t.etd, value: s.shipment.etd && formatDate(s.shipment.etd, locale) },
                        { label: t.eta, value: s.shipment.eta && formatDate(s.shipment.eta, locale) },
                        { label: t.blNumber, value: s.shipment.bl_number && <span dir="ltr">{s.shipment.bl_number}</span> },
                      ].filter((i) => i.value)}
                    />
                    {s.shipment.events.length > 0 && (
                      <ol className="mt-4 border-s-2 border-line ps-4">
                        {[...s.shipment.events].reverse().map((e, i) => (
                          <li key={i} className="relative pb-3 text-sm last:pb-0">
                            <span className="absolute -start-[1.4rem] top-1.5 size-2.5 rounded-full bg-brand" aria-hidden />
                            <p className="font-semibold">{t.shipmentStatus[e.status as keyof typeof t.shipmentStatus] ?? e.status}</p>
                            {e.note && <p className="text-muted">{e.note}</p>}
                            <p className="text-xs text-subtle">{formatDateTime(e.created_at, locale)}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                )}
              </div>
            </article>
          );
        })}

        {otherDocs.length > 0 && (
          <section className="card p-4 sm:p-5">
            <h2 className="label-caps mb-2">{t.documents}</h2>
            <DocumentList documents={otherDocs} locale={locale} kindLabels={t.documentKinds} downloadLabel={t.download} emptyLabel={t.noDocuments} />
          </section>
        )}
      </div>
    </div>
  );
}
