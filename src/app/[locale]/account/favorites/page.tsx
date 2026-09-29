import { Heart } from "lucide-react";
import { notFound } from "next/navigation";
import { PortalHeader } from "@/components/portal/portal-header";
import { VehicleCard } from "@/components/site/vehicle-card";
import { ButtonLink, EmptyState } from "@/components/ui";
import { requireCustomer, withDb } from "@/lib/auth/session";
import { getDictionary, isLocale } from "@/lib/i18n";
import { getFavoriteIds, listCardsByIds } from "@/lib/queries/catalog";

export default async function FavoritesPage({ params }: PageProps<"/[locale]/account/favorites">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireCustomer(locale);
  const dict = getDictionary(locale);
  const items = await withDb(async (tx) => listCardsByIds(tx, [...(await getFavoriteIds(tx))], locale));

  return (
    <div>
      <PortalHeader title={dict.portal.favoritesTitle} />
      {items.length === 0 ? (
        <EmptyState icon={<Heart className="size-8" />} title={dict.portal.favoritesEmpty}>
          <ButtonLink href={`/${locale}/vehicles`} className="mt-4">{dict.home.browseStock}</ButtonLink>
        </EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((v) => (
            <VehicleCard key={v.id} vehicle={v} dict={dict} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
