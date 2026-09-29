import Link from "next/link";
import { PageHeader, Panel, Tabs } from "@/components/admin/kit";
import { ShipmentForm, type ShipmentValues } from "@/components/admin/shipment-form";
import { SHIPMENT_STEPS } from "@/components/shipment-progress";
import { EmptyState, StatusBadge } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";

export const metadata = { title: "Shipping" };

export default async function ShippingPage({ searchParams }: PageProps<"/admin/shipping">) {
  await requireStaff();
  const sp = await searchParams;
  const tab = sp.tab === "released" ? "released" : "active";
  const t = adminT;
  const rows = await withDb((tx) =>
    tx.query<ShipmentValues & { sale_id: string; sale_no: string; sale_status: string; customer_id: string; customer_name: string; vehicle_ref: string; updated_at: string }>(
      `select sh.*, s.sale_no, s.status as sale_status, c.id as customer_id, c.full_name as customer_name, v.ref_no as vehicle_ref
         from public.shipments sh join public.sales s on s.id = sh.sale_id join public.customers c on c.id = sh.customer_id join public.vehicles v on v.id = s.vehicle_id
        where s.status <> 'cancelled' and ${tab === "active" ? "sh.status <> 'released'" : "sh.status = 'released'"}
        order by sh.eta nulls last, sh.updated_at desc limit 100`,
    ),
  );
  const byStage = SHIPMENT_STEPS.map((step) => ({ step, count: rows.filter((r) => r.status === step).length }));

  return (
    <div>
      <PageHeader title="Shipping & export" description="Every stage change is timestamped and shown to the customer in their portal." />
      {tab === "active" && (
        <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {byStage.filter((b) => b.step !== "released").map((b) => (
            <div key={b.step} className="card px-3 py-2">
              <p className="text-xs text-muted">{t.status.shipment[b.step]}</p>
              <p className="num font-display text-2xl font-bold">{b.count}</p>
            </div>
          ))}
        </div>
      )}
      <Tabs current={tab} items={[{ key: "active", label: "In progress", href: "/admin/shipping" }, { key: "released", label: "Released", href: "/admin/shipping?tab=released" }]} />
      {rows.length === 0 && <EmptyState title="No shipments here." />}
      <div className="flex flex-col gap-4">
        {rows.map((r) => (
          <Panel
            key={r.id}
            title={
              <span className="flex flex-wrap items-center gap-2 text-base">
                <Link href={`/admin/sales/${r.sale_id}`} className="num hover:text-brand">{r.sale_no}</Link>
                <span className="font-normal text-muted">· {r.vehicle_ref} · <Link href={`/admin/customers/${r.customer_id}`} className="hover:underline">{r.customer_name}</Link></span>
              </span>
            }
            actions={
              <div className="flex items-center gap-2">
                {r.eta && <span className="text-xs text-muted">ETA {formatDate(r.eta)}</span>}
                <StatusBadge status={r.status} label={t.status.shipment[r.status as keyof typeof t.status.shipment]} />
              </div>
            }
          >
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-brand">
                Update {r.vessel_name ? `(${r.vessel_name}${r.voyage_no ? ` ${r.voyage_no}` : ""})` : ""}
              </summary>
              <div className="mt-3"><ShipmentForm shipment={r} /></div>
            </details>
          </Panel>
        ))}
      </div>
    </div>
  );
}
