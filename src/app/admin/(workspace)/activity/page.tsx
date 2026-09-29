import Link from "next/link";
import { EmptyRow, PageHeader, Table, Td, Th } from "@/components/admin/kit";
import { AutoSubmitSelect } from "@/components/site/auto-submit";
import { requireStaff, withDb } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Activity log" };

const ENTITIES = ["customer", "inquiry", "offer", "reservation", "sale", "payment", "shipment", "document", "vehicle", "vehicle_private", "staff_user", "customer_invite"];

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  const viewer = await requireStaff();
  const sp = await searchParams;
  const entity = typeof sp.entity === "string" && ENTITIES.includes(sp.entity) ? sp.entity : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const rows = await withDb((tx) =>
    tx.query<{ id: number; occurred_at: string; actor: string | null; actor_role: string | null; action: string; entity_type: string; entity_id: string | null; customer_id: string | null; customer_name: string | null; summary: string | null; details: { changes?: Record<string, { old: unknown; new: unknown }> } }>(
      `select a.id, a.occurred_at, a.actor_role, a.action, a.entity_type, a.entity_id, a.customer_id, a.summary, a.details,
              (select display_name from public.profiles where id = a.actor_id) as actor,
              (select full_name from public.customers where id = a.customer_id) as customer_name
         from public.activity_log a
        where ($1 = '' or a.entity_type = $1)
        order by a.occurred_at desc, a.id desc limit 100 offset ${(page - 1) * 100}`,
      [entity],
    ),
  );

  return (
    <div>
      <PageHeader
        title="Activity log"
        description={
          viewer.isAdmin
            ? "Timestamped, append-only record of sensitive changes: assignments, prices, statuses, payments, documents and staff roles. It cannot be edited or deleted from the app."
            : "Your own actions and activity on customers assigned to you."
        }
        actions={
          <form>
            <AutoSubmitSelect name="entity" defaultValue={entity} className="input w-auto" aria-label="Filter by type">
              <option value="">All types</option>
              {ENTITIES.map((e) => <option key={e} value={e}>{e.replace(/_/g, " ")}</option>)}
            </AutoSubmitSelect>
          </form>
        }
      />
      <Table>
        <thead><tr><Th>When</Th><Th>Who</Th><Th>What</Th><Th>Customer</Th></tr></thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={4}>No activity.</EmptyRow>}
          {rows.map((a) => (
            <tr key={a.id}>
              <Td className="text-xs whitespace-nowrap text-muted">{formatDateTime(a.occurred_at)}</Td>
              <Td className="text-sm">{a.actor ?? (a.actor_role === "customer" ? "Customer" : "System")}<p className="text-xs text-muted">{a.actor_role}</p></Td>
              <Td className="text-sm">
                <span className="me-2 rounded bg-page px-1.5 py-0.5 text-xs font-semibold">{a.entity_type.replace(/_/g, " ")} · {a.action}</span>
                {a.summary ?? changeSummary(a.details)}
              </Td>
              <Td className="text-sm">{a.customer_id ? <Link href={`/admin/customers/${a.customer_id}`} className="hover:text-brand">{a.customer_name ?? "—"}</Link> : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link href={`/admin/activity?page=${page - 1}&entity=${entity}`} className="font-semibold text-brand">← Newer</Link> : <span />}
        {rows.length === 100 && <Link href={`/admin/activity?page=${page + 1}&entity=${entity}`} className="font-semibold text-brand">Older →</Link>}
      </div>
    </div>
  );
}

function changeSummary(details: { changes?: Record<string, { old: unknown; new: unknown }> }) {
  const changes = details?.changes;
  if (!changes) return null;
  return Object.entries(changes)
    .slice(0, 5)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${short(v.old)} → ${short(v.new)}`)
    .join("; ");
}

function short(v: unknown) {
  if (v === null || v === undefined || v === "") return "∅";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 30 ? `${s.slice(0, 30)}…` : s;
}
