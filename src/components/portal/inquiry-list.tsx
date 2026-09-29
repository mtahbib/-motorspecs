import { Car } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { formatRelative, formatUsd } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { MyInquiryRow } from "@/lib/queries/portal";
import { vehicleMediaUrl } from "@/lib/storage/urls";

export function VehicleThumb({ cover, className = "size-16" }: { cover: { bucket: string; storage_path: string } | null | undefined; className?: string }) {
  const url = cover ? vehicleMediaUrl(cover) : null;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`${className} shrink-0 rounded-lg object-cover`} />
  ) : (
    <span className={`${className} grid shrink-0 place-items-center rounded-lg bg-page text-subtle`}>
      <Car className="size-6" aria-hidden />
    </span>
  );
}

export function InquiryList({ items, locale, dict }: { items: MyInquiryRow[]; locale: Locale; dict: Dictionary }) {
  const t = dict.portal;
  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {items.map((i) => (
        <li key={i.id}>
          <Link href={`/${locale}/account/inquiries/${i.id}`} className="flex gap-4 p-4 hover:bg-page/60">
            <VehicleThumb cover={i.vehicle?.cover} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold">{i.vehicle?.title ?? i.subject}</p>
                <StatusBadge status={i.status} label={t.inquiryStatus[i.status as keyof typeof t.inquiryStatus]} />
              </div>
              <p className="num mt-0.5 text-xs text-muted" dir="ltr">
                {i.ref_no} {i.vehicle && `· ${i.vehicle.ref_no}`}
              </p>
              {i.last_message && <p className="mt-1 line-clamp-1 text-sm text-muted">{i.last_message.body}</p>}
              {i.pending_offer && i.pending_offer.kind !== "customer_offer" && (
                <p className="mt-1.5 inline-flex items-center gap-2 rounded-lg bg-warn-soft px-2 py-1 text-xs font-semibold text-warn">
                  {t.offerKinds[i.pending_offer.kind as keyof typeof t.offerKinds]}:{" "}
                  <span className="num" dir="ltr">{formatUsd(i.pending_offer.amount_usd, locale)} {i.pending_offer.incoterm}</span>
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs text-subtle">{formatRelative(i.last_message_at, locale)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
