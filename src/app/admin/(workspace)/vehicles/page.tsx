import { Camera, Plus, Search, Star } from "lucide-react";
import Link from "next/link";
import { EmptyRow, PageHeader, Table, Tabs, Td, Th } from "@/components/admin/kit";
import { VehicleThumb } from "@/components/portal/inquiry-list";
import { Alert, ButtonLink, DemoBadge, StatusBadge } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { formatNumber, formatRelative, formatUsd } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";

export const metadata = { title: "Vehicles" };

const STATUSES = ["all", "draft", "published", "reserved", "sold", "archived"] as const;

export default async function VehiclesAdminPage({ searchParams }: PageProps<"/admin/vehicles">) {
  const viewer = await requireStaff();
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(String(sp.status)) ? String(sp.status) : "all";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const t = adminT;

  const { rows, counts } = await withDb(async (tx) => {
    const params: unknown[] = [];
    const where = ["true"];
    if (status !== "all") { params.push(status); where.push(`v.status = $${params.length}`); }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(v.ref_no ilike $${params.length} or v.chassis_no ilike $${params.length} or mk.name ilike $${params.length} or md.name ilike $${params.length}
        or exists (select 1 from public.vehicle_translations t where t.vehicle_id = v.id and t.title ilike $${params.length}))`);
    }
    const rows = await tx.query<{
      id: string; ref_no: string; status: string; is_featured: boolean; is_demo: boolean; reg_year: number | null; mileage_km: number | null;
      operating_hours: number | null; price_visibility: string; fob_price_usd: number | null; updated_at: string; make: string | null; model: string | null;
      title: string | null; photos: number; cover: { bucket: string; storage_path: string } | null; blockers: string[]; inquiries: number; internal_cost_usd: number | null;
    }>(
      `select v.id, v.ref_no, v.status, v.is_featured, v.is_demo, v.reg_year, v.mileage_km, v.operating_hours, v.price_visibility, v.fob_price_usd, v.updated_at,
              mk.name as make, md.name as model,
              (select title from public.vehicle_translations where vehicle_id = v.id and locale = 'en') as title,
              (select count(*)::int from public.vehicle_media m where m.vehicle_id = v.id and m.kind = 'photo') as photos,
              (select jsonb_build_object('bucket', m.bucket, 'storage_path', m.storage_path) from public.vehicle_media m
                where m.vehicle_id = v.id and m.kind = 'photo' and m.is_public order by m.sort_order limit 1) as cover,
              case when v.status = 'draft' then public.vehicle_blockers_for_row(v) else '{}'::text[] end as blockers,
              (select count(*)::int from public.inquiries i where i.vehicle_id = v.id and i.status not in ('won', 'lost', 'closed')) as inquiries,
              (select internal_cost_usd from public.vehicle_private where vehicle_id = v.id) as internal_cost_usd
         from public.vehicles v left join public.makes mk on mk.id = v.make_id left join public.models md on md.id = v.model_id
        where ${where.join(" and ")}
        order by case v.status when 'draft' then 0 when 'published' then 1 when 'reserved' then 2 when 'sold' then 3 else 4 end, v.updated_at desc
        limit 300`,
      params,
    );
    const counts = await tx.query<{ status: string; n: number }>("select status, count(*)::int as n from public.vehicles group by status");
    return { rows, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number> };
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader
        title="Vehicles"
        description="Listing CMS. Save incomplete vehicles as drafts; publish when the checklist is complete."
        actions={<ButtonLink href="/admin/vehicles/new"><Plus className="size-4" /> New vehicle</ButtonLink>}
      />
      {sp.deleted && <Alert tone="ok" className="mb-4">Draft deleted.</Alert>}
      <form className="mb-4 flex gap-2">
        <input type="hidden" name="status" value={status} />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Reference, chassis, make, model or title" className="input ps-9" aria-label="Search vehicles" />
        </div>
        <button className="h-10 rounded-[10px] bg-ink px-4 text-sm font-semibold text-white">Search</button>
      </form>
      <Tabs
        current={status}
        items={STATUSES.map((s) => ({
          key: s,
          label: s === "all" ? "All" : t.status.vehicle[s],
          href: `/admin/vehicles?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
          count: s === "all" ? total : counts[s] ?? 0,
        }))}
      />
      <Table>
        <thead><tr><Th>Vehicle</Th><Th>Year / km</Th><Th className="text-end">FOB price</Th><Th>Status</Th><Th className="text-end">Open inquiries</Th><Th>Updated</Th></tr></thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={6}>No vehicles.</EmptyRow>}
          {rows.map((v) => (
            <tr key={v.id} className="hover:bg-page/50">
              <Td>
                <Link href={`/admin/vehicles/${v.id}`} className="flex items-center gap-3">
                  <VehicleThumb cover={v.cover} className="h-11 w-16" />
                  <span className="min-w-0">
                    <span className="block font-semibold hover:text-brand">{v.title || [v.make, v.model].filter(Boolean).join(" ") || "Untitled draft"}</span>
                    <span className="num flex items-center gap-1.5 text-xs text-muted">
                      {v.ref_no}
                      <span className="inline-flex items-center gap-0.5"><Camera className="size-3" /> {v.photos}</span>
                      {v.is_featured && <Star className="size-3 fill-warn text-warn" aria-label="Featured" />}
                      {v.is_demo && <DemoBadge />}
                    </span>
                  </span>
                </Link>
              </Td>
              <Td className="num text-xs">
                {v.reg_year ?? "—"}
                <br />
                <span className="text-muted">{v.operating_hours != null ? `${formatNumber(v.operating_hours)} h` : v.mileage_km != null ? `${formatNumber(v.mileage_km)} km` : "—"}</span>
              </Td>
              <Td className="num text-end">
                {formatUsd(v.fob_price_usd)}
                {v.price_visibility === "ask" && <p className="text-xs text-muted">shown as “Ask”</p>}
                {viewer.isAdmin && v.internal_cost_usd != null && v.fob_price_usd != null && (
                  <p className="text-xs text-ok">margin {formatUsd(v.fob_price_usd - v.internal_cost_usd)}</p>
                )}
              </Td>
              <Td>
                <StatusBadge status={v.status} label={t.status.vehicle[v.status as keyof typeof t.status.vehicle]} />
                {v.blockers.length > 0 && <p className="mt-1 text-xs text-warn">{v.blockers.length} item{v.blockers.length > 1 ? "s" : ""} before publishing</p>}
              </Td>
              <Td className="num text-end">{v.inquiries || "—"}</Td>
              <Td className="text-xs text-muted">{formatRelative(v.updated_at)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
