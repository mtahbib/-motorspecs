import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoSubmitSelect } from "@/components/site/auto-submit";
import { CollapsibleFilters } from "@/components/site/collapsible-filters";
import { VehicleCard } from "@/components/site/vehicle-card";
import { EmptyState, buttonClass } from "@/components/ui";
import { withAnonDb } from "@/lib/auth/session";
import { fmt, getDictionary, isLocale, type Dictionary } from "@/lib/i18n";
import { formatNumber } from "@/lib/format";
import { getCatalogFacets, listCatalog, type CatalogFilters } from "@/lib/queries/catalog";

export async function generateMetadata({ params }: PageProps<"/[locale]/vehicles">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).catalog.title } : {};
}

const str = (v: string | string[] | undefined, max = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const int = (v: string | string[] | undefined) => {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const oneOf = <T extends string>(v: string | string[] | undefined, allowed: readonly T[]) =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
const slug = (v: string | string[] | undefined) => (typeof v === "string" && /^[a-z0-9-]{1,60}$/.test(v) ? v : undefined);

export default async function VehiclesPage({ params, searchParams }: PageProps<"/[locale]/vehicles">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const dict = getDictionary(locale);
  const t = dict.catalog;

  const filters: CatalogFilters = {
    q: str(sp.q),
    make: slug(sp.make),
    model: slug(sp.model),
    body: slug(sp.body),
    yearFrom: int(sp.yearFrom),
    yearTo: int(sp.yearTo),
    priceMin: int(sp.priceMin),
    priceMax: int(sp.priceMax),
    mileageMax: int(sp.mileageMax),
    transmission: oneOf(sp.transmission, ["AT", "MT", "CVT", "AMT", "other"] as const),
    fuel: oneOf(sp.fuel, ["petrol", "diesel", "hybrid", "plugin_hybrid", "electric", "lpg", "other"] as const),
    steering: oneOf(sp.steering, ["RHD", "LHD"] as const),
    drive: oneOf(sp.drive, ["2WD", "4WD", "AWD"] as const),
    includeSold: sp.includeSold === "1",
    sort: oneOf(sp.sort, ["newest", "price_asc", "price_desc", "year_desc", "mileage_asc"] as const),
    page: int(sp.page),
  };

  const { result, facets } = await withAnonDb(async (tx) => ({
    result: await listCatalog(tx, filters, locale),
    facets: await getCatalogFacets(tx, filters.make),
  }));

  const pageHref = (page: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "page") qs.set(k, v);
    if (page > 1) qs.set("page", String(page));
    const s = qs.toString();
    return `/${locale}/vehicles${s ? `?${s}` : ""}`;
  };
  const activeCount = Object.entries(filters).filter(([k, v]) => v !== undefined && v !== false && !["sort", "page"].includes(k)).length;

  const filterForm = (
    <FilterFields dict={dict} filters={filters} facets={facets} />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t.title}</h1>
          <p className="num mt-1 text-muted">{fmt(t.results, { count: formatNumber(result.total, locale) })}</p>
        </div>
      </div>

      <form action={`/${locale}/vehicles`} className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Filters: sidebar on desktop, collapsible on mobile */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <CollapsibleFilters label={t.filters} activeCount={activeCount}>
            {filterForm}
          </CollapsibleFilters>
        </aside>

        <section aria-live="polite">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="includeSold" value="1" defaultChecked={filters.includeSold} className="size-4 accent-brand" />
              {t.includeSold}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">{t.sort}</span>
              <AutoSubmitSelect name="sort" defaultValue={filters.sort ?? "newest"} className="input h-9 w-auto py-1 text-sm">
                <option value="newest">{t.sortNewest}</option>
                <option value="price_asc">{t.sortPriceAsc}</option>
                <option value="price_desc">{t.sortPriceDesc}</option>
                <option value="year_desc">{t.sortYearDesc}</option>
                <option value="mileage_asc">{t.sortMileageAsc}</option>
              </AutoSubmitSelect>
            </label>
          </div>

          {result.items.length === 0 ? (
            <EmptyState icon={<SearchX className="size-8" />} title={t.noResults}>
              {t.noResultsHint}{" "}
              <Link href={`/${locale}/vehicles`} className="font-semibold text-brand hover:underline">{t.resetFilters}</Link>
            </EmptyState>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((v) => (
                <VehicleCard key={v.id} vehicle={v} dict={dict} locale={locale} />
              ))}
            </div>
          )}

          {result.pages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
              {result.page > 1 ? (
                <Link href={pageHref(result.page - 1)} className={buttonClass("secondary", "sm")}>
                  <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden /> {t.previous}
                </Link>
              ) : null}
              <span className="num text-sm text-muted">{fmt(t.page, { page: result.page, pages: result.pages })}</span>
              {result.page < result.pages ? (
                <Link href={pageHref(result.page + 1)} className={buttonClass("secondary", "sm")}>
                  {t.next} <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden />
                </Link>
              ) : null}
            </nav>
          )}
        </section>
      </form>
    </div>
  );
}

function FilterFields({
  dict,
  filters,
  facets,
}: {
  dict: Dictionary;
  filters: CatalogFilters;
  facets: Awaited<ReturnType<typeof getCatalogFacets>>;
}) {
  const t = dict.catalog;
  const v = dict.vehicle;
  const year = new Date().getFullYear();
  const years = Array.from({ length: 25 }, (_, i) => year - i);
  const select = (name: string, label: string, value: string | undefined, options: [string, string][], anyLabel = t.any) => (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <select name={name} defaultValue={value ?? ""} className="input font-normal">
        <option value="">{anyLabel}</option>
        {options.map(([val, text]) => (
          <option key={val} value={val}>{text}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t.keyword}
        <input name="q" defaultValue={filters.q} className="input font-normal" />
      </label>
      {select("make", t.make, filters.make, facets.makes.filter((m) => m.count > 0 || m.slug === filters.make).map((m) => [m.slug, `${m.name} (${m.count})`]), t.anyMake)}
      {filters.make && select("model", t.model, filters.model, facets.models.filter((m) => m.count > 0 || m.slug === filters.model).map((m) => [m.slug, `${m.name} (${m.count})`]), t.anyModel)}
      {select("body", t.body, filters.body, facets.bodies.filter((b) => b.count > 0 || b.code === filters.body).map((b) => [b.code, `${v.bodyTypes[b.code as keyof typeof v.bodyTypes] ?? b.code} (${b.count})`]), t.anyBody)}
      <div className="grid grid-cols-2 gap-2">
        {select("yearFrom", t.yearFrom, filters.yearFrom?.toString(), years.map((y) => [String(y), String(y)]))}
        {select("yearTo", t.yearTo, filters.yearTo?.toString(), years.map((y) => [String(y), String(y)]))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t.priceMin}
          <input name="priceMin" type="number" min={0} step="any" inputMode="numeric" defaultValue={filters.priceMin} className="input num font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t.priceMax}
          <input name="priceMax" type="number" min={0} step="any" inputMode="numeric" defaultValue={filters.priceMax} className="input num font-normal" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t.mileageMax}
        <input name="mileageMax" type="number" min={0} step="any" inputMode="numeric" defaultValue={filters.mileageMax} className="input num font-normal" />
      </label>
      {select("transmission", t.transmission, filters.transmission, Object.entries(v.transmissionValues))}
      {select("fuel", t.fuel, filters.fuel, Object.entries(v.fuelValues))}
      <div className="grid grid-cols-2 gap-2">
        {select("steering", t.steering, filters.steering, Object.entries(v.steeringValues).map(([k]) => [k, k]))}
        {select("drive", t.drive, filters.drive, Object.entries(v.driveValues))}
      </div>
      <div className="flex gap-2 pt-1">
        <button className={buttonClass("primary", "md", "flex-1")}>{t.applyFilters}</button>
        <Link href="?" className={buttonClass("secondary", "md")}>{t.resetFilters}</Link>
      </div>
    </div>
  );
}
