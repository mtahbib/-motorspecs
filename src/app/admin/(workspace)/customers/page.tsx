import { Link2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { EmptyRow, PageHeader, Table, Td, Th } from "@/components/admin/kit";
import { AutoSubmitSelect } from "@/components/site/auto-submit";
import { ButtonLink, DemoBadge, StatusBadge } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { countryName, formatRelative } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";
import { listStaffOptions } from "@/lib/queries/admin";

export const metadata = { title: "Customers" };

type Row = {
  id: string; customer_code: string; full_name: string; company_name: string | null; email: string | null; phone: string | null;
  country_code: string | null; status: string; verification_status: string; is_demo: boolean; linked: boolean;
  assigned: string | null; open_deals: number; last_activity: string | null; tags: string[];
};

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const viewer = await requireStaff();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const assigned = typeof sp.assigned === "string" ? sp.assigned : "all";
  const status = typeof sp.status === "string" && ["lead", "active", "inactive", "merged"].includes(sp.status) ? sp.status : "";
  const t = adminT;

  const { rows, staff } = await withDb(async (tx) => {
    const where: string[] = ["true"];
    const params: unknown[] = [];
    const p = (v: unknown) => (params.push(v), `$${params.length}`);
    if (q) {
      const term = p(`%${q}%`);
      where.push(`(c.full_name ilike ${term} or c.company_name ilike ${term} or c.email ilike ${term} or c.phone ilike ${term} or c.customer_code ilike ${term} or c.whatsapp ilike ${term})`);
    }
    if (assigned === "me") where.push("c.assigned_staff_id = auth.uid()");
    else if (assigned === "none") where.push("c.assigned_staff_id is null");
    else if (/^[0-9a-f-]{36}$/.test(assigned)) where.push(`c.assigned_staff_id = ${p(assigned)}`);
    if (status) where.push(`c.status = ${p(status)}`);
    else where.push("c.status <> 'merged'");

    const rows = await tx.query<Row>(
      `select c.id, c.customer_code, c.full_name, c.company_name, c.email, c.phone, c.country_code, c.status, c.verification_status,
              c.is_demo, c.tags, (c.auth_user_id is not null) as linked,
              (select s.display_name from public.staff_directory s where s.id = c.assigned_staff_id) as assigned,
              ((select count(*) from public.inquiries i where i.customer_id = c.id and i.status not in ('won', 'lost', 'closed'))
               + (select count(*) from public.sales s where s.customer_id = c.id and s.status not in ('completed', 'cancelled')))::int as open_deals,
              greatest(c.updated_at, (select max(i.last_message_at) from public.inquiries i where i.customer_id = c.id)) as last_activity
         from public.customers c
        where ${where.join(" and ")}
        order by last_activity desc nulls last
        limit 200`,
      params,
    );
    return { rows, staff: await listStaffOptions(tx) };
  });

  return (
    <div>
      <PageHeader
        title="Customers"
        description={viewer.isAdmin ? "The master customer database. Every inquiry, deal and document stays with the customer, even when reassigned." : "Customers assigned to you."}
        actions={<ButtonLink href="/admin/customers/new"><Plus className="size-4" /> New customer</ButtonLink>}
      />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Name, company, email, phone or customer ID" className="input ps-9" aria-label="Search customers" />
        </div>
        <AutoSubmitSelect name="assigned" defaultValue={assigned} className="input w-auto" aria-label="Assigned to">
          <option value="all">{viewer.isAdmin ? "All salespeople" : "All my customers"}</option>
          <option value="me">Assigned to me</option>
          {viewer.isAdmin && <option value="none">Unassigned</option>}
          {viewer.isAdmin && staff.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="status" defaultValue={status} className="input w-auto" aria-label="Status">
          <option value="">Any status</option>
          {Object.entries(t.status.customer).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </AutoSubmitSelect>
        <button className="h-10 rounded-[10px] bg-ink px-4 text-sm font-semibold text-white">Search</button>
      </form>

      <Table>
        <thead>
          <tr>
            <Th>Customer</Th>
            <Th>Country</Th>
            <Th>Contact</Th>
            <Th>Assigned to</Th>
            <Th>Status</Th>
            <Th className="text-end">Open deals</Th>
            <Th>Last activity</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={7}>No customers match.</EmptyRow>}
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-page/50">
              <Td>
                <Link href={`/admin/customers/${c.id}`} className="font-semibold hover:text-brand">{c.full_name}</Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <span className="num">{c.customer_code}</span>
                  {c.company_name && <span>· {c.company_name}</span>}
                  {c.linked && <span title="Has a portal login" className="inline-flex items-center gap-0.5 text-ok"><Link2 className="size-3" /> portal</span>}
                  {c.is_demo && <DemoBadge />}
                </div>
              </Td>
              <Td>{countryName(c.country_code)}</Td>
              <Td className="text-xs">
                <div className="truncate">{c.email ?? "—"}</div>
                <div className="num text-muted">{c.phone}</div>
              </Td>
              <Td>{c.assigned ?? <span className="font-semibold text-warn">Unassigned</span>}</Td>
              <Td>
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge status={c.status} label={t.status.customer[c.status as keyof typeof t.status.customer]} />
                  <StatusBadge status={c.verification_status} label={t.status.verification[c.verification_status as keyof typeof t.status.verification]} />
                </div>
              </Td>
              <Td className="num text-end font-semibold">{c.open_deals || "—"}</Td>
              <Td className="text-xs text-muted">{formatRelative(c.last_activity)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
