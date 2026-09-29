import Link from "next/link";
import { EmptyRow, PageHeader, Table, Tabs, Td, Th } from "@/components/admin/kit";
import { DemoBadge, StatusBadge } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { formatDate, formatUsd } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";

export const metadata = { title: "Sales & payments" };

export default async function SalesPage({ searchParams }: PageProps<"/admin/sales">) {
  const viewer = await requireStaff();
  const sp = await searchParams;
  const tab = sp.payments === "to_verify" ? "to_verify" : ["open", "shipping", "done", "all"].includes(String(sp.status)) ? String(sp.status) : "open";
  const t = adminT;
  const where = {
    open: "s.status in ('awaiting_payment', 'partially_paid', 'paid')",
    shipping: "s.status in ('shipping', 'delivered')",
    done: "s.status in ('completed', 'cancelled')",
    all: "true",
    to_verify: "exists (select 1 from public.payments p where p.sale_id = s.id and p.status = 'recorded')",
  }[tab];

  const rows = await withDb((tx) =>
    tx.query<{
      id: string; sale_no: string; invoice_no: string | null; status: string; total_usd: number; paid: number; to_verify: number; sold_at: string;
      customer_id: string; customer_name: string; vehicle_ref: string; staff_name: string | null; is_demo: boolean;
    }>(
      `select s.id, s.sale_no, s.invoice_no, s.status, s.total_usd, s.sold_at, s.is_demo,
              coalesce((select sum(p.amount_usd) from public.payments p where p.sale_id = s.id and p.status <> 'void'), 0) as paid,
              (select count(*)::int from public.payments p where p.sale_id = s.id and p.status = 'recorded') as to_verify,
              c.id as customer_id, c.full_name as customer_name, v.ref_no as vehicle_ref,
              (select display_name from public.profiles where id = s.staff_id) as staff_name
         from public.sales s join public.customers c on c.id = s.customer_id join public.vehicles v on v.id = s.vehicle_id
        where ${where} order by s.sold_at desc limit 200`,
    ),
  );

  const tabs = [
    { key: "open", label: "Awaiting payment", href: "/admin/sales?status=open" },
    { key: "shipping", label: "Shipping", href: "/admin/sales?status=shipping" },
    { key: "done", label: "Completed / cancelled", href: "/admin/sales?status=done" },
    { key: "all", label: "All", href: "/admin/sales?status=all" },
    ...(viewer.isAdmin ? [{ key: "to_verify", label: "Payments to verify", href: "/admin/sales?payments=to_verify" }] : []),
  ];

  return (
    <div>
      <PageHeader title="Sales & payments" description="Sales are created from reservations. Salespeople record payments; the owner/admin verifies them. Payment records are never deleted." />
      <Tabs current={tab} items={tabs} />
      <Table>
        <thead><tr><Th>Order</Th><Th>Customer</Th><Th>Vehicle</Th><Th className="text-end">Total</Th><Th className="text-end">Balance</Th><Th>Status</Th><Th>Date</Th></tr></thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={7}>No sales here.</EmptyRow>}
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-page/50">
              <Td>
                <Link href={`/admin/sales/${s.id}`} className="num font-semibold hover:text-brand">{s.sale_no}</Link>
                <p className="num text-xs text-muted">{s.invoice_no ?? "No invoice no."} {s.is_demo && <DemoBadge />}</p>
              </Td>
              <Td><Link href={`/admin/customers/${s.customer_id}`} className="hover:text-brand">{s.customer_name}</Link><p className="text-xs text-muted">{s.staff_name}</p></Td>
              <Td className="num">{s.vehicle_ref}</Td>
              <Td className="num text-end font-semibold">{formatUsd(s.total_usd, "en", 2)}</Td>
              <Td className={`num text-end ${s.total_usd - s.paid > 0 && s.status !== "cancelled" ? "text-warn" : "text-muted"}`}>{formatUsd(Math.max(0, s.total_usd - s.paid), "en", 2)}</Td>
              <Td>
                <StatusBadge status={s.status} label={t.status.sale[s.status as keyof typeof t.status.sale]} />
                {s.to_verify > 0 && <p className="mt-1 text-xs font-semibold text-warn">{s.to_verify} payment{s.to_verify > 1 ? "s" : ""} to verify</p>}
              </Td>
              <Td className="text-xs text-muted">{formatDate(s.sold_at)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
