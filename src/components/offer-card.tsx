import clsx from "clsx";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui";
import { formatDate, formatUsd } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { Offer } from "@/lib/queries/portal";

export function offerTotal(o: Pick<Offer, "amount_usd" | "freight_usd" | "insurance_usd" | "inspection_usd">) {
  return o.amount_usd + (o.freight_usd ?? 0) + (o.insurance_usd ?? 0) + (o.inspection_usd ?? 0);
}

export function OfferCard({
  offer,
  locale,
  labels,
  actions,
}: {
  offer: Offer;
  locale: Locale;
  labels: {
    kinds: Record<string, string>;
    statuses: Record<string, string>;
    validUntil: string;
    freight: string;
    insurance: string;
    inspection: string;
    total: string;
    incoterm: string;
  };
  actions?: ReactNode;
}) {
  const extras = [
    [labels.freight, offer.freight_usd],
    [labels.insurance, offer.insurance_usd],
    [labels.inspection, offer.inspection_usd],
  ].filter(([, v]) => v != null && Number(v) > 0) as [string, number][];
  const muted = ["superseded", "withdrawn", "expired", "declined"].includes(offer.status);

  return (
    <div className={clsx("rounded-xl border p-4", offer.status === "pending" && offer.kind !== "customer_offer" ? "border-warn/40 bg-warn-soft/40" : "border-line bg-white", muted && "opacity-70")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{labels.kinds[offer.kind]}</p>
        <StatusBadge status={offer.status} label={labels.statuses[offer.status]} />
      </div>
      <p className="num mt-2 font-display text-2xl font-bold" dir="ltr">
        {formatUsd(offer.amount_usd, locale)} <span className="text-sm font-semibold text-muted">{offer.incoterm}</span>
      </p>
      {extras.length > 0 && (
        <dl className="mt-2 grid gap-1 text-sm">
          {extras.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-muted">{label}</dt>
              <dd className="num" dir="ltr">{formatUsd(value, locale)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-line pt-1 font-semibold">
            <dt>{labels.total} ({offer.incoterm})</dt>
            <dd className="num" dir="ltr">{formatUsd(offerTotal(offer), locale)}</dd>
          </div>
        </dl>
      )}
      {offer.destination_port && <p className="mt-2 text-sm text-muted">→ {offer.destination_port}</p>}
      {offer.message && <p className="mt-2 text-sm" dir="auto">{offer.message}</p>}
      {offer.valid_until && (
        <p className="mt-2 text-xs text-muted">
          {labels.validUntil}: {formatDate(offer.valid_until, locale)}
        </p>
      )}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
