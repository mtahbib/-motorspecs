import { Check, ChevronLeft, FileText, Info, MapPin, RotateCw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FavoriteButton } from "@/components/site/favorite-button";
import { Gallery } from "@/components/site/gallery";
import { InquiryPanel } from "@/components/site/inquiry-panel";
import { PriceTag, VehicleCard } from "@/components/site/vehicle-card";
import { Alert, ButtonLink, DemoBadge, KeyValue, StatusBadge } from "@/components/ui";
import { getViewer, withDb } from "@/lib/auth/session";
import { formatNumber, formatYearMonth } from "@/lib/format";
import { fmt, getDictionary, isLocale } from "@/lib/i18n";
import { getFavoriteIds, getVehicleBySlug, listSimilar } from "@/lib/queries/catalog";
import { vehicleMediaUrl } from "@/lib/storage/urls";

export async function generateMetadata({ params }: PageProps<"/[locale]/vehicles/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const vehicle = await withDb((tx) => getVehicleBySlug(tx, slug, locale)).catch(() => null);
  if (!vehicle) return {};
  const cover = vehicle.media.find((m) => m.kind === "photo");
  return {
    title: vehicle.translation?.title ?? vehicle.ref_no,
    description: vehicle.translation?.description?.slice(0, 160) ?? undefined,
    openGraph: cover ? { images: [vehicleMediaUrl(cover) ?? ""] } : undefined,
  };
}

export default async function VehiclePage({ params }: PageProps<"/[locale]/vehicles/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.vehicle;
  const viewer = await getViewer();

  const data = await withDb(async (tx) => {
    const vehicle = await getVehicleBySlug(tx, slug, locale);
    if (!vehicle) return null;
    const similar = await listSimilar(tx, vehicle, locale);
    const favorites = viewer?.role === "customer" ? await getFavoriteIds(tx) : new Set<string>();
    const port =
      viewer?.role === "customer"
        ? ((await tx.query<{ destination_port: string | null }>("select destination_port from public.customers where auth_user_id = auth.uid()"))[0]?.destination_port ?? "")
        : "";
    return { vehicle, similar, isFavorite: favorites.has(vehicle.id), port };
  });
  if (!data) notFound();
  const { vehicle: v } = data;
  const title = v.translation?.title ?? `${v.make_name ?? ""} ${v.model_name ?? ""}`.trim();
  const photos = v.media.filter((m) => m.kind === "photo").map((m) => ({ url: vehicleMediaUrl(m) ?? "", caption: m.caption }));
  const docs = v.media.filter((m) => m.kind !== "photo");
  const n = (value: number | null, unit: string) => (value == null ? null : fmt(unit, { value: formatNumber(value, locale) }));
  const opt = <T extends string>(map: Record<string, string>, key: T | null) => (key ? map[key] ?? key : null);
  const featuresByCategory = v.features.reduce<Record<string, string[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f.code);
    return acc;
  }, {});
  const back = `/${locale}/vehicles/${v.slug}`;
  const canInquire = v.status === "published" || v.status === "reserved";

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <Link href={`/${locale}/vehicles`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden /> {dict.catalog.title}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <Gallery photos={photos} title={title} photoOfLabel={t.photoOf} />

          <section className="card mt-6 p-5 sm:p-6">
            <h2 className="font-display text-xl font-bold">{t.specifications}</h2>
            <div className="gauge-rule mt-2 mb-3 w-24" />
            <KeyValue
              items={[
                { label: t.refNo, value: <span dir="ltr">{v.ref_no}</span> },
                { label: t.chassis, value: v.chassis_no && <span dir="ltr">{v.chassis_no}</span> },
                { label: t.modelCode, value: v.model_code && <span dir="ltr">{v.model_code}</span> },
                { label: t.engineCode, value: v.engine_code && <span dir="ltr">{v.engine_code}</span> },
                { label: t.registration, value: formatYearMonth(v.reg_year, v.reg_month, locale) },
                { label: t.grade, value: v.grade },
                { label: t.conditionGrade, value: v.condition_grade },
                v.operating_hours != null ? { label: t.hours, value: n(v.operating_hours, t.h) } : { label: t.mileage, value: n(v.mileage_km, t.km) },
                { label: t.engine, value: n(v.engine_cc, t.cc) },
                { label: t.transmission, value: opt(t.transmissionValues, v.transmission) },
                { label: t.fuel, value: opt(t.fuelValues, v.fuel) },
                { label: t.drive, value: opt(t.driveValues, v.drive) },
                { label: t.steering, value: opt(t.steeringValues, v.steering) },
                { label: t.exteriorColor, value: v.exterior_color },
                { label: t.interiorColor, value: v.interior_color },
                { label: t.doors, value: v.doors },
                { label: t.seats, value: v.seats },
                { label: t.location, value: v.location_name },
              ].filter((i) => i.value != null && i.value !== "")}
            />
          </section>

          <section className="card mt-6 p-5 sm:p-6">
            <h2 className="font-display text-xl font-bold">{t.dimensions}</h2>
            <div className="gauge-rule mt-2 mb-3 w-24" />
            <KeyValue
              items={[
                { label: t.length, value: n(v.length_mm, t.mm) },
                { label: t.width, value: n(v.width_mm, t.mm) },
                { label: t.height, value: n(v.height_mm, t.mm) },
                { label: t.m3, value: v.m3 != null ? formatNumber(v.m3, locale, 2) : null },
                { label: t.weight, value: n(v.weight_kg, t.kg) },
                { label: t.grossWeight, value: n(v.gross_weight_kg, t.kg) },
                { label: t.maxLoad, value: n(v.max_load_kg, t.kg) },
                { label: t.tyres, value: v.tyre_front && <span dir="ltr">{v.tyre_front}</span> },
              ].filter((i) => i.value != null && i.value !== "")}
            />
          </section>

          {(v.translation?.description || v.translation?.remarks) && (
            <section className="card mt-6 p-5 sm:p-6">
              <h2 className="font-display text-xl font-bold">{t.description}</h2>
              <div className="gauge-rule mt-2 mb-4 w-24" />
              {v.translation_is_fallback && (
                <Alert tone="info" className="mb-4">
                  <span className="inline-flex items-center gap-2"><Info className="size-4 shrink-0" aria-hidden />{t.translationFallback}</span>
                </Alert>
              )}
              <div lang={v.translation_is_fallback ? "en" : locale} dir={v.translation_is_fallback ? "ltr" : undefined}>
                {v.translation?.description && <p className="whitespace-pre-line leading-relaxed">{v.translation.description}</p>}
                {v.translation?.remarks && (
                  <div className="mt-4 rounded-xl bg-page p-4">
                    <p className="label-caps mb-1">{t.remarks}</p>
                    <p className="whitespace-pre-line text-sm leading-relaxed">{v.translation.remarks}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {v.features.length > 0 && (
            <section className="card mt-6 p-5 sm:p-6">
              <h2 className="font-display text-xl font-bold">{t.features}</h2>
              <div className="gauge-rule mt-2 mb-4 w-24" />
              <div className="grid gap-5 sm:grid-cols-2">
                {Object.entries(featuresByCategory).map(([category, codes]) => (
                  <div key={category}>
                    <p className="label-caps mb-2">{t.featureCategories[category as keyof typeof t.featureCategories]}</p>
                    <ul className="grid gap-1.5">
                      {codes.map((code) => (
                        <li key={code} className="flex items-center gap-2 text-sm">
                          <Check className="size-4 shrink-0 text-ok" aria-hidden />
                          {t.featureNames[code as keyof typeof t.featureNames] ?? code}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {docs.length > 0 && (
            <section className="card mt-6 p-5 sm:p-6">
              <h2 className="font-display text-xl font-bold">{t.media}</h2>
              <ul className="mt-3 divide-y divide-line">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      <FileText className="size-4 text-muted" aria-hidden />
                      {d.kind === "inspection_sheet" ? t.inspectionSheet : d.kind === "auction_sheet" ? t.auctionSheet : d.caption ?? d.kind}
                    </span>
                    <a href={vehicleMediaUrl(d) ?? "#"} target="_blank" rel="noopener" className="text-sm font-semibold text-brand hover:underline">
                      {t.open}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Sticky purchase panel */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={v.status} label={t.status[v.status]} />
              {v.has_360_view && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
                  <RotateCw className="size-3.5" aria-hidden /> {t.view360}
                </span>
              )}
              {v.is_demo && <DemoBadge label={dict.common.demoBadge} />}
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{title}</h1>
            <p className="num mt-1 text-sm text-muted">
              {t.refNo} <span dir="ltr">{v.ref_no}</span>
              {v.location_name && (
                <span className="ms-3 inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden /> {v.location_name}
                </span>
              )}
            </p>
            <div className="my-5 border-y border-line py-4">
              <PriceTag vehicle={v} dict={dict} locale={locale} size="lg" />
              {v.price_visibility === "ask" && v.status !== "sold" && <p className="mt-1 text-sm text-muted">{t.askForPriceHint}</p>}
            </div>

            {viewer?.role === "customer" && (
              <div className="mb-5">
                <FavoriteButton vehicleId={v.id} locale={locale} initial={data.isFavorite} back={back} labels={{ add: t.addFavorite, saved: t.removeFavorite }} />
              </div>
            )}

            {canInquire &&
              (viewer?.role === "customer" ? (
                <InquiryPanel
                  vehicleId={v.id}
                  locale={locale}
                  defaultSubject={fmt(dict.inquiry.defaultSubject, { vehicle: `${v.ref_no} ${title}`.slice(0, 180) })}
                  defaultPort={data.port}
                  allowOffer={v.status === "published"}
                  labels={{ ...dict.inquiry, sending: dict.common.sending, optional: dict.common.optional }}
                />
              ) : viewer ? (
                <Alert tone="info">{dict.inquiry.staffNotice}</Alert>
              ) : (
                <div className="rounded-xl bg-page p-4">
                  <p className="text-sm">{dict.inquiry.signInToInquire}</p>
                  <div className="mt-3 flex gap-2">
                    <ButtonLink href={`/${locale}/login?next=${encodeURIComponent(back)}`} className="flex-1">{dict.common.signIn}</ButtonLink>
                    <ButtonLink href={`/${locale}/register`} variant="secondary" className="flex-1">{dict.common.register}</ButtonLink>
                  </div>
                </div>
              ))}
          </div>
        </aside>
      </div>

      {data.similar.length > 0 && (
        <section className="pt-14">
          <h2 className="mb-5 font-display text-2xl font-bold">{t.similar}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.similar.map((s) => (
              <VehicleCard key={s.id} vehicle={s} dict={dict} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
