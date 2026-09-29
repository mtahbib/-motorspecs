import { ArrowRight, BadgeCheck, Handshake, Search, Tag } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, SectionTitle } from "@/components/ui";
import { VehicleCard } from "@/components/site/vehicle-card";
import { GaugeArc } from "@/components/site/gauge-arc";
import { getViewer, withAnonDb } from "@/lib/auth/session";
import { getDictionary, isLocale } from "@/lib/i18n";
import { getCatalogFacets, listFeatured, listLatest } from "@/lib/queries/catalog";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.home;
  const [viewer, data] = await Promise.all([
    getViewer(),
    withAnonDb(async (tx) => ({
      featured: await listFeatured(tx, locale, 8),
      latest: await listLatest(tx, locale, 4),
      facets: await getCatalogFacets(tx),
    })),
  ]);
  const bodies = data.facets.bodies.filter((b) => b.count > 0);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-graphite text-white">
        <GaugeArc className="pointer-events-none absolute -end-40 -top-24 w-[720px] opacity-[0.16] sm:-end-24" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20">
          <p className="label-caps text-[#7d9bff]">{t.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">{t.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">{t.subtitle}</p>
          <form action={`/${locale}/vehicles`} className="mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-2xl sm:flex-row">
            <label htmlFor="hero-q" className="sr-only">{dict.common.search}</label>
            <div className="flex flex-1 items-center gap-2 px-3">
              <Search className="size-5 shrink-0 text-subtle" aria-hidden />
              <input id="hero-q" name="q" placeholder={t.searchPlaceholder} className="h-11 w-full bg-transparent text-ink outline-none placeholder:text-subtle" />
            </div>
            <select name="make" aria-label={dict.catalog.make} className="input h-11 border-0 bg-page text-ink sm:w-44">
              <option value="">{dict.catalog.anyMake}</option>
              {data.facets.makes.filter((m) => m.count > 0).map((m) => (
                <option key={m.slug} value={m.slug}>{m.name} ({m.count})</option>
              ))}
            </select>
            <button className="h-11 rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-hover">{t.browseStock}</button>
          </form>
          <div className="mt-6 flex flex-wrap gap-2">
            {bodies.slice(0, 7).map((b) => (
              <Link key={b.code} href={`/${locale}/vehicles?body=${b.code}`} className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:border-white/40 hover:text-white">
                {dict.vehicle.bodyTypes[b.code as keyof typeof dict.vehicle.bodyTypes] ?? b.code}
                <span className="num ms-1.5 text-white/40">{b.count}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-3">
          {[
            { icon: BadgeCheck, title: t.trust1Title, body: t.trust1Body },
            { icon: Tag, title: t.trust2Title, body: t.trust2Body },
            { icon: Handshake, title: t.trust3Title, body: t.trust3Body },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-0.5 text-sm text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {data.featured.length > 0 && (
          <section className="pt-14">
            <SectionTitle
              title={t.featured}
              action={
                <Link href={`/${locale}/vehicles`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                  {dict.common.viewAll} <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
                </Link>
              }
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {data.featured.map((v) => (
                <VehicleCard key={v.id} vehicle={v} dict={dict} locale={locale} />
              ))}
            </div>
          </section>
        )}

        <section id="how-it-works" className="scroll-mt-8 pt-16">
          <div className="card overflow-hidden">
            <div className="grid lg:grid-cols-[1fr_2fr]">
              <div className="bg-ink p-8 text-white">
                <div className="gauge-rule mb-5 w-32" />
                <h2 className="font-display text-3xl font-bold">{t.stepsTitle}</h2>
                <p className="mt-3 text-white/65">{t.ctaBody}</p>
                {!viewer && (
                  <ButtonLink href={`/${locale}/register`} className="mt-6">
                    {dict.common.register}
                  </ButtonLink>
                )}
              </div>
              <ol className="grid gap-px bg-line sm:grid-cols-2">
                {[t.step1, t.step2, t.step3, t.step4].map((step, i) => (
                  <li key={i} className="flex gap-4 bg-white p-6">
                    <span className="num font-display text-4xl font-bold leading-none text-brand/25">{String(i + 1).padStart(2, "0")}</span>
                    <p className="pt-1 font-medium leading-snug">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {data.latest.length > 0 && (
          <section className="pt-16">
            <SectionTitle title={t.latest} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {data.latest.map((v) => (
                <VehicleCard key={v.id} vehicle={v} dict={dict} locale={locale} />
              ))}
            </div>
          </section>
        )}

        {!viewer && (
          <section className="pt-16">
            <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-brand px-8 py-10 text-white sm:px-12">
              <GaugeArc className="pointer-events-none absolute -bottom-40 -end-24 w-[420px] opacity-20" tone="light" />
              <h2 className="font-display text-3xl font-bold">{t.ctaTitle}</h2>
              <p className="mt-2 max-w-xl text-white/80">{t.ctaBody}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href={`/${locale}/register`} variant="dark">{dict.common.register}</ButtonLink>
                <ButtonLink href={`/${locale}/vehicles`} variant="secondary">{t.browseStock}</ButtonLink>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
