import clsx from "clsx";
import { Camera, Gauge, MapPin } from "lucide-react";
import Link from "next/link";
import { StatusBadge, DemoBadge } from "@/components/ui";
import { formatNumber, formatUsd } from "@/lib/format";
import { fmt, type Dictionary, type Locale } from "@/lib/i18n";
import type { VehicleCard as Card } from "@/lib/queries/catalog";
import { vehicleMediaUrl } from "@/lib/storage/urls";

export function PriceTag({
  vehicle,
  dict,
  locale,
  size = "md",
}: {
  vehicle: Pick<Card, "price_visibility" | "fob_price_usd" | "previous_price_usd" | "status">;
  dict: Dictionary;
  locale: Locale;
  size?: "md" | "lg";
}) {
  const t = dict.vehicle;
  if (vehicle.status === "sold") {
    return <p className={clsx("font-display font-bold text-muted", size === "lg" ? "text-3xl" : "text-xl")}>{t.status.sold}</p>;
  }
  if (vehicle.price_visibility !== "public" || vehicle.fob_price_usd == null) {
    return <p className={clsx("font-display font-bold text-brand", size === "lg" ? "text-3xl" : "text-lg")}>{t.askForPrice}</p>;
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="label-caps">{t.fobShort}</span>
      <span className={clsx("num font-display font-bold tracking-tight text-ink", size === "lg" ? "text-4xl" : "text-2xl")} dir="ltr">
        {formatUsd(vehicle.fob_price_usd, locale)}
      </span>
      {vehicle.previous_price_usd && vehicle.previous_price_usd > vehicle.fob_price_usd && (
        <span className="num text-sm text-subtle line-through" dir="ltr">
          {formatUsd(vehicle.previous_price_usd, locale)}
        </span>
      )}
    </div>
  );
}

export function VehicleCard({ vehicle, dict, locale }: { vehicle: Card; dict: Dictionary; locale: Locale }) {
  const t = dict.vehicle;
  const cover = vehicleMediaUrl({ bucket: vehicle.cover_bucket, storage_path: vehicle.cover_path });
  const distance =
    vehicle.mileage_km != null
      ? fmt(t.km, { value: formatNumber(vehicle.mileage_km, locale) })
      : vehicle.operating_hours != null
        ? fmt(t.h, { value: formatNumber(vehicle.operating_hours, locale) })
        : null;

  return (
    <article className="group card relative flex flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-lift)]">
      <Link href={`/${locale}/vehicles/${vehicle.slug}`} className="absolute inset-0 z-10" aria-label={vehicle.title ?? vehicle.ref_no} />
      <div className="relative aspect-[16/10] overflow-hidden bg-page">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="grid size-full place-items-center text-subtle">
            <Camera className="size-8" />
          </div>
        )}
        <div className="absolute start-3 top-3 flex gap-1.5">
          {vehicle.status !== "published" && <StatusBadge status={vehicle.status} label={t.status[vehicle.status]} />}
          {vehicle.is_demo && <DemoBadge label={dict.common.demoBadge} />}
        </div>
        {vehicle.photo_count > 0 && (
          <span className="absolute bottom-2.5 end-2.5 inline-flex items-center gap-1 rounded-md bg-ink/70 px-1.5 py-0.5 text-xs font-medium text-white">
            <Camera className="size-3" aria-hidden /> {vehicle.photo_count}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="num text-xs font-medium text-subtle">{vehicle.ref_no}</p>
          <h3 className="mt-0.5 line-clamp-2 font-semibold leading-snug text-ink group-hover:text-brand">{vehicle.title ?? `${vehicle.make_name} ${vehicle.model_name}`}</h3>
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {vehicle.reg_year && <li className="num">{vehicle.reg_year}</li>}
          {distance && (
            <li className="num inline-flex items-center gap-1">
              <Gauge className="size-3.5" aria-hidden />
              {distance}
            </li>
          )}
          {vehicle.transmission && <li>{t.transmissionValues[vehicle.transmission as keyof typeof t.transmissionValues]}</li>}
          {vehicle.fuel && <li>{t.fuelValues[vehicle.fuel as keyof typeof t.fuelValues]}</li>}
          {vehicle.location_name && (
            <li className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {vehicle.location_name}
            </li>
          )}
        </ul>
        <div className="mt-auto border-t border-line pt-3">
          <PriceTag vehicle={vehicle} dict={dict} locale={locale} />
        </div>
      </div>
    </article>
  );
}
