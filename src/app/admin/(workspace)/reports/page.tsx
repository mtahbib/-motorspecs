import Link from "next/link";
import { PageHeader, Panel, Stat, Table, Td, Th } from "@/components/admin/kit";
import { requireAdmin, withDb } from "@/lib/auth/session";
import { formatNumber, formatUsd } from "@/lib/format";

export const metadata = { title: "Reports" };

type Month = { month: string; sales: number; revenue: number; received: number };

export default async function ReportsPage() {
  await requireAdmin();
  const data = await withDb(async (tx) => {
    const months = await tx.query<Month>(
      `with m as (select generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') as month)
       select to_char(m.month, 'YYYY-MM') as month,
              (select count(*)::int from public.sales s where s.status <> 'cancelled' and date_trunc('month', s.sold_at) = m.month) as sales,
              (select coalesce(sum(s.total_usd), 0) from public.sales s where s.status <> 'cancelled' and date_trunc('month', s.sold_at) = m.month) as revenue,
              (select coalesce(sum(p.amount_usd), 0) from public.payments p where p.status <> 'void' and date_trunc('month', p.paid_on) = m.month) as received
         from m order by m.month`,
    );
    const people = await tx.query<{ id: string; name: string; customers: number; open_inquiries: number; quotes_30d: number; active_reservations: number; sales_90d: number; revenue_90d: number; overdue_tasks: number }>(
      `select p.id, p.display_name as name,
              (select count(*)::int from public.customers c where c.assigned_staff_id = p.id and c.status in ('lead', 'active')) as customers,
              (select count(*)::int from public.inquiries i join public.customers c on c.id = i.customer_id
                where c.assigned_staff_id = p.id and i.status not in ('won', 'lost', 'closed')) as open_inquiries,
              (select count(*)::int from public.offers o where o.created_by = p.id and o.kind <> 'customer_offer' and o.created_at > now() - interval '30 days') as quotes_30d,
              (select count(*)::int from public.reservations r where r.reserved_by = p.id and r.status = 'active') as active_reservations,
              (select count(*)::int from public.sales s where s.staff_id = p.id and s.status <> 'cancelled' and s.sold_at > now() - interval '90 days') as sales_90d,
              (select coalesce(sum(s.total_usd), 0) from public.sales s where s.staff_id = p.id and s.status <> 'cancelled' and s.sold_at > now() - interval '90 days') as revenue_90d,
              (select count(*)::int from public.tasks t where t.assigned_to = p.id and t.status = 'open' and t.due_at < now()) as overdue_tasks
         from public.profiles p where p.role in ('admin', 'sales') and p.is_active order by revenue_90d desc, name`,
    );
    const [funnel] = await tx.query<{ inquiries: number; quoted: number; reserved: number; won: number }>(
      `select count(*)::int as inquiries,
              count(*) filter (where exists (select 1 from public.offers o where o.inquiry_id = i.id and o.kind <> 'customer_offer'))::int as quoted,
              count(*) filter (where exists (select 1 from public.reservations r where r.inquiry_id = i.id))::int as reserved,
              count(*) filter (where i.status = 'won')::int as won
         from public.inquiries i where i.created_at > now() - interval '90 days'`,
    );
    const aging = await tx.query<{ id: string; ref_no: string; title: string | null; days: number; fob_price_usd: number | null; inquiries: number }>(
      `select v.id, v.ref_no, (select title from public.vehicle_translations where vehicle_id = v.id and locale = 'en') as title,
              extract(day from now() - v.published_at)::int as days, v.fob_price_usd,
              (select count(*)::int from public.inquiries i where i.vehicle_id = v.id) as inquiries
         from public.vehicles v where v.status = 'published' order by v.published_at asc limit 8`,
    );
    const [stock] = await tx.query<{ published: number; value: number; margin: number | null }>(
      `select count(*)::int as published, coalesce(sum(v.fob_price_usd), 0) as value,
              sum(v.fob_price_usd - vp.internal_cost_usd) as margin
         from public.vehicles v left join public.vehicle_private vp on vp.vehicle_id = v.id where v.status = 'published'`,
    );
    return { months, people, funnel, aging, stock };
  });

  const maxRevenue = Math.max(1, ...data.months.map((m) => Math.max(m.revenue, m.received)));
  const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString("en", { month: "short", year: "2-digit", timeZone: "UTC" });
  const f = data.funnel;
  const pct = (n: number) => (f.inquiries ? `${Math.round((n / f.inquiries) * 100)}%` : "—");

  return (
    <div>
      <PageHeader title="Reports" description="Sales, collections, pipeline and stock at a glance. Figures include demo data while demo mode is on." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sales, last 6 months" value={data.months.reduce((a, m) => a + m.sales, 0)} hint={formatUsd(data.months.reduce((a, m) => a + m.revenue, 0))} />
        <Stat label="Received, last 6 months" value={formatUsd(data.months.reduce((a, m) => a + m.received, 0))} />
        <Stat label="Published stock" value={data.stock.published} hint={`${formatUsd(data.stock.value)} at list price`} />
        <Stat label="Potential stock margin" value={data.stock.margin != null ? formatUsd(data.stock.margin) : "—"} hint="List price minus recorded cost" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Sales value by month (USD)">
          <MonthBars months={data.months} max={maxRevenue} field="revenue" label={monthLabel} />
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-brand">Show as table</summary>
            <table className="mt-2 w-full text-sm">
              <thead><tr className="text-xs text-muted"><th className="py-1 text-start">Month</th><th className="text-end">Sales</th><th className="text-end">Value</th><th className="text-end">Received</th></tr></thead>
              <tbody>
                {data.months.map((m) => (
                  <tr key={m.month} className="border-t border-line"><td className="py-1">{monthLabel(m.month)}</td><td className="num text-end">{m.sales}</td><td className="num text-end">{formatUsd(m.revenue)}</td><td className="num text-end">{formatUsd(m.received)}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        </Panel>
        <Panel title="Payments received by month (USD)">
          <MonthBars months={data.months} max={maxRevenue} field="received" label={monthLabel} />
          <p className="mt-4 text-xs text-muted">Includes payments recorded but not yet verified; void payments are excluded.</p>
        </Panel>
      </div>

      <Panel title="Pipeline — inquiries opened in the last 90 days" className="mt-6">
        <ol className="grid gap-3 sm:grid-cols-4">
          {[
            ["Inquiries", f.inquiries, "100%"],
            ["Quoted", f.quoted, pct(f.quoted)],
            ["Reserved", f.reserved, pct(f.reserved)],
            ["Won", f.won, pct(f.won)],
          ].map(([label, n, p], i) => (
            <li key={label as string} className="rounded-xl bg-page p-4">
              <p className="label-caps">{i + 1}. {label}</p>
              <p className="num mt-1 font-display text-3xl font-bold">{n}</p>
              <p className="text-xs text-muted">{p} of inquiries</p>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div>
          <h2 className="mb-3 font-display text-lg font-bold">Team (last 90 days)</h2>
          <Table>
            <thead><tr><Th>Salesperson</Th><Th className="text-end">Customers</Th><Th className="text-end">Open inq.</Th><Th className="text-end">Quotes 30d</Th><Th className="text-end">Reserved</Th><Th className="text-end">Sales</Th><Th className="text-end">Value</Th><Th className="text-end">Overdue</Th></tr></thead>
            <tbody>
              {data.people.map((p) => (
                <tr key={p.id}>
                  <Td className="font-semibold">{p.name}</Td>
                  <Td className="num text-end">{p.customers}</Td>
                  <Td className="num text-end">{p.open_inquiries}</Td>
                  <Td className="num text-end">{p.quotes_30d}</Td>
                  <Td className="num text-end">{p.active_reservations}</Td>
                  <Td className="num text-end">{p.sales_90d}</Td>
                  <Td className="num text-end font-semibold">{formatUsd(p.revenue_90d)}</Td>
                  <Td className={`num text-end ${p.overdue_tasks ? "font-semibold text-danger" : ""}`}>{p.overdue_tasks}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div>
          <h2 className="mb-3 font-display text-lg font-bold">Longest-listed vehicles</h2>
          <Table>
            <thead><tr><Th>Vehicle</Th><Th className="text-end">Days</Th><Th className="text-end">Inquiries</Th></tr></thead>
            <tbody>
              {data.aging.map((v) => (
                <tr key={v.id}>
                  <Td><Link href={`/admin/vehicles/${v.id}`} className="font-semibold hover:text-brand">{v.ref_no}</Link><p className="text-xs text-muted">{v.title}</p></Td>
                  <Td className={`num text-end ${v.days > 45 ? "font-semibold text-warn" : ""}`}>{formatNumber(v.days)}</Td>
                  <Td className="num text-end">{v.inquiries}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-muted">Consider a price review for stock listed over 45 days with few inquiries.</p>
        </div>
      </div>
    </div>
  );
}

/** Single-series vertical bars: one hue, value labels on non-zero bars, native hover titles. */
function MonthBars({ months, max, field, label }: { months: Month[]; max: number; field: "revenue" | "received"; label: (m: string) => string }) {
  return (
    <div role="img" aria-label={months.map((m) => `${label(m.month)}: ${formatUsd(m[field])}`).join(", ")}>
      <div className="flex h-52 items-end gap-3 border-b border-line-strong">
        {months.map((m) => {
          const h = (m[field] / max) * 100;
          return (
            <div key={m.month} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${label(m.month)}: ${formatUsd(m[field])}`}>
              {m[field] > 0 && <span className="num text-[0.7rem] font-semibold text-ink">${formatNumber(Math.round(m[field] / 1000))}k</span>}
              <div className="w-full max-w-12 rounded-t bg-brand transition-opacity group-hover:opacity-80" style={{ height: `${m[field] > 0 ? Math.max(h, 2) : 0}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-3">
        {months.map((m) => (
          <span key={m.month} className="flex-1 text-center text-xs text-muted">{label(m.month)}</span>
        ))}
      </div>
    </div>
  );
}
