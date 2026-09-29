import "server-only";
import type { Tx } from "../db";
import type { Locale } from "../i18n/config";
import { pgArray } from "./util";

export type VehicleCard = {
  id: string;
  ref_no: string;
  slug: string;
  make_name: string | null;
  model_name: string | null;
  body_type: string | null;
  reg_year: number | null;
  reg_month: number | null;
  mileage_km: number | null;
  operating_hours: number | null;
  engine_cc: number | null;
  transmission: string | null;
  fuel: string | null;
  drive: string | null;
  steering: string | null;
  exterior_color: string | null;
  price_visibility: "public" | "ask";
  fob_price_usd: number | null;
  previous_price_usd: number | null;
  status: "published" | "reserved" | "sold" | "draft" | "archived";
  is_featured: boolean;
  is_demo: boolean;
  location_name: string | null;
  title: string | null;
  cover_bucket: string | null;
  cover_path: string | null;
  photo_count: number;
};

export type CatalogFilters = {
  q?: string;
  make?: string;
  model?: string;
  body?: string;
  yearFrom?: number;
  yearTo?: number;
  priceMin?: number;
  priceMax?: number;
  mileageMax?: number;
  transmission?: string;
  fuel?: string;
  steering?: string;
  drive?: string;
  includeSold?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "year_desc" | "mileage_asc";
  page?: number;
};

export const PAGE_SIZE = 12;

const safeLocale = (locale: Locale) => (["en", "ja", "ar"].includes(locale) ? locale : "en");

const cardColumns = (locale: Locale) => `
  v.id, v.ref_no, v.slug, v.make_name, v.model_name, v.body_type, v.reg_year, v.reg_month, v.mileage_km,
  v.operating_hours, v.engine_cc, v.transmission, v.fuel, v.drive, v.steering, v.exterior_color,
  v.price_visibility, v.fob_price_usd, v.previous_price_usd, v.status, v.is_featured, v.is_demo, v.location_name,
  coalesce(
    (select t.title from public.vehicle_translations t where t.vehicle_id = v.id and t.locale = '${safeLocale(locale)}' and coalesce(t.title, '') <> ''),
    (select t.title from public.vehicle_translations t where t.vehicle_id = v.id and t.locale = 'en')
  ) as title,
  cover.bucket as cover_bucket, cover.storage_path as cover_path,
  (select count(*)::int from public.vehicle_media m where m.vehicle_id = v.id and m.kind = 'photo' and m.is_public) as photo_count`;

const coverJoin = `
  left join lateral (
    select m.bucket, m.storage_path from public.vehicle_media m
    where m.vehicle_id = v.id and m.kind = 'photo' and m.is_public
    order by m.sort_order, m.created_at limit 1
  ) cover on true`;

export async function listCatalog(tx: Tx, filters: CatalogFilters, locale: Locale) {
  const where: string[] = ["v.is_listed"];
  const params: unknown[] = [];
  const p = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (!filters.includeSold) where.push("v.status in ('published', 'reserved')");
  if (filters.q) {
    const term = p(`%${filters.q.trim()}%`);
    where.push(`(v.make_name ilike ${term} or v.model_name ilike ${term} or v.ref_no ilike ${term}
      or v.chassis_no ilike ${term} or v.model_code ilike ${term} or v.grade ilike ${term}
      or exists (select 1 from public.vehicle_translations t where t.vehicle_id = v.id and t.title ilike ${term}))`);
  }
  if (filters.make) where.push(`v.make_slug = ${p(filters.make)}`);
  if (filters.model) where.push(`v.model_slug = ${p(filters.model)}`);
  if (filters.body) where.push(`v.body_type = ${p(filters.body)}`);
  if (filters.yearFrom) where.push(`coalesce(v.reg_year, v.manufacture_year) >= ${p(filters.yearFrom)}`);
  if (filters.yearTo) where.push(`coalesce(v.reg_year, v.manufacture_year) <= ${p(filters.yearTo)}`);
  if (filters.priceMin) where.push(`v.fob_price_usd >= ${p(filters.priceMin)}`);
  if (filters.priceMax) where.push(`v.fob_price_usd <= ${p(filters.priceMax)}`);
  if (filters.mileageMax) where.push(`v.mileage_km <= ${p(filters.mileageMax)}`);
  if (filters.transmission) where.push(`v.transmission = ${p(filters.transmission)}`);
  if (filters.fuel) where.push(`v.fuel = ${p(filters.fuel)}`);
  if (filters.steering) where.push(`v.steering = ${p(filters.steering)}`);
  if (filters.drive) where.push(`v.drive = ${p(filters.drive)}`);

  const order = {
    newest: "v.published_at desc nulls last, v.ref_no desc",
    price_asc: "v.fob_price_usd asc nulls last, v.published_at desc",
    price_desc: "v.fob_price_usd desc nulls last, v.published_at desc",
    year_desc: "v.reg_year desc nulls last, v.published_at desc",
    mileage_asc: "v.mileage_km asc nulls last, v.published_at desc",
  }[filters.sort ?? "newest"];

  const page = Math.max(1, filters.page ?? 1);
  const whereSql = where.join(" and ");
  const [{ total }] = await tx.query<{ total: number }>(
    `select count(*)::int as total from public.catalog_vehicles v where ${whereSql}`,
    params,
  );
  const items = await tx.query<VehicleCard>(
    `select ${cardColumns(locale)} from public.catalog_vehicles v ${coverJoin}
     where ${whereSql}
     order by case v.status when 'sold' then 2 else 0 end, ${order}
     limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
    params,
  );
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function listFeatured(tx: Tx, locale: Locale, limit = 6) {
  return tx.query<VehicleCard>(
    `select ${cardColumns(locale)} from public.catalog_vehicles v ${coverJoin}
     where v.is_listed and v.status = 'published' and v.is_featured
     order by v.published_at desc limit ${limit}`,
  );
}

export async function listLatest(tx: Tx, locale: Locale, limit = 8) {
  return tx.query<VehicleCard>(
    `select ${cardColumns(locale)} from public.catalog_vehicles v ${coverJoin}
     where v.is_listed and v.status = 'published'
     order by v.published_at desc limit ${limit}`,
  );
}

export async function listCardsByIds(tx: Tx, ids: string[], locale: Locale) {
  if (!ids.length) return [];
  return tx.query<VehicleCard>(
    `select ${cardColumns(locale)} from public.catalog_vehicles v ${coverJoin}
     where v.id = any($1::uuid[])`,
    [pgArray(ids)],
  );
}

export async function getCatalogFacets(tx: Tx, make?: string) {
  const makes = await tx.query<{ slug: string; name: string; count: number }>(
    `select mk.slug, mk.name, count(v.id)::int as count
       from public.makes mk
       left join public.catalog_vehicles v on v.make_id = mk.id and v.is_listed and v.status in ('published', 'reserved')
      group by mk.slug, mk.name, mk.sort_order
      order by mk.sort_order, mk.name`,
  );
  const models = make
    ? await tx.query<{ slug: string; name: string; count: number }>(
        `select md.slug, md.name, count(v.id)::int as count
           from public.models md join public.makes mk on mk.id = md.make_id
           left join public.catalog_vehicles v on v.model_id = md.id and v.is_listed and v.status in ('published', 'reserved')
          where mk.slug = $1
          group by md.slug, md.name order by md.name`,
        [make],
      )
    : [];
  const bodies = await tx.query<{ code: string; count: number }>(
    `select b.code, count(v.id)::int as count
       from public.body_types b
       left join public.catalog_vehicles v on v.body_type = b.code and v.is_listed and v.status in ('published', 'reserved')
      group by b.code, b.sort_order order by b.sort_order`,
  );
  return { makes, models, bodies };
}

export type VehicleDetail = VehicleCard & {
  chassis_no: string | null;
  model_code: string | null;
  engine_code: string | null;
  condition_grade: string | null;
  make_slug: string | null;
  manufacture_year: number | null;
  grade: string | null;
  interior_color: string | null;
  doors: number | null;
  seats: number | null;
  has_360_view: boolean;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  m3: number | null;
  weight_kg: number | null;
  gross_weight_kg: number | null;
  max_load_kg: number | null;
  tyre_front: string | null;
  tyre_rear: string | null;
  is_listed: boolean;
  translation: { locale: Locale; title: string | null; description: string | null; remarks: string | null } | null;
  translation_is_fallback: boolean;
  features: { code: string; category: string }[];
  media: { id: string; kind: string; bucket: string; storage_path: string; caption: string | null; mime_type: string | null }[];
};

export async function getVehicleBySlug(tx: Tx, slug: string, locale: Locale): Promise<VehicleDetail | null> {
  const [row] = await tx.query<Omit<VehicleDetail, "translation" | "translation_is_fallback" | "features" | "media">>(
    `select ${cardColumns(locale)}, v.chassis_no, v.model_code, v.engine_code, v.condition_grade, v.make_slug,
            v.manufacture_year, v.grade, v.interior_color, v.doors, v.seats, v.has_360_view, v.length_mm, v.width_mm,
            v.height_mm, v.m3, v.weight_kg, v.gross_weight_kg, v.max_load_kg, v.tyre_front, v.tyre_rear, v.is_listed
       from public.catalog_vehicles v ${coverJoin}
      where v.slug = $1`,
    [slug],
  );
  if (!row) return null;

  const translations = await tx.query<{ locale: Locale; title: string | null; description: string | null; remarks: string | null }>(
    `select locale, title, description, remarks from public.vehicle_translations where vehicle_id = $1`,
    [row.id],
  );
  const preferred = translations.find((t) => t.locale === locale && (t.title || t.description));
  const english = translations.find((t) => t.locale === "en") ?? null;
  const translation = preferred ?? english;

  const features = await tx.query<{ code: string; category: string }>(
    `select f.code, f.category from public.vehicle_features vf join public.features f on f.code = vf.feature_code
      where vf.vehicle_id = $1 order by f.sort_order`,
    [row.id],
  );
  const media = await tx.query<VehicleDetail["media"][number]>(
    `select id, kind, bucket, storage_path, caption, mime_type from public.vehicle_media
      where vehicle_id = $1 and is_public order by sort_order, created_at`,
    [row.id],
  );
  return {
    ...row,
    translation,
    translation_is_fallback: !preferred && locale !== "en" && !!english,
    features,
    media,
  };
}

export async function listSimilar(tx: Tx, vehicle: { id: string; body_type: string | null }, locale: Locale) {
  return tx.query<VehicleCard>(
    `select ${cardColumns(locale)} from public.catalog_vehicles v ${coverJoin}
      where v.is_listed and v.status = 'published' and v.id <> $1 and v.body_type is not distinct from $2
      order by v.published_at desc limit 4`,
    [vehicle.id, vehicle.body_type],
  );
}

export async function getFavoriteIds(tx: Tx): Promise<Set<string>> {
  const rows = await tx.query<{ vehicle_id: string }>(
    `select vehicle_id from public.favorites where customer_id = public.current_customer_id()`,
  );
  return new Set(rows.map((r) => r.vehicle_id));
}
