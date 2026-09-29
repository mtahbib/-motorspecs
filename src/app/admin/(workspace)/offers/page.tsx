import Link from "next/link";
import { EmptyRow, PageHeader, Table, Tabs, Td, Th } from "@/components/admin/kit";
import { StatusBadge } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { formatDate, formatRelative, formatUsd } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";

export const metadata = { title: "Offers & quotes" };

export default async function OffersPage({ searchParams }: PageProps<"/admin/offers">) {
  await requireStaff();
  const sp = await searchParams;
  const tab = ["pending", "customer", "accepted", "all"].includes(String(sp.tab)) ? String(sp.tab) : "pending";
  const t = adminT;
  const where = {
    pending: "o.status = 'pending'",
    customer: "o.status = 'pending' and o.kind = 'customer_offer'",
    accepted: "o.status = 'accepted'",
    all: "true",
  }[tab];

  const rows = await withDb((tx) =>
    tx.query<{
      id: string; kind: string; status: string; amount_usd: number; incoterm: string; freight_usd: number | null; insurance_usd: number | null;
      inspection_usd: number | null; valid_until: string | null; created_at: string; inquiry_id: string; inquiry_ref: string;
      customer_id: string; customer_name: string; vehicle_ref: string | null; list_price: number | null; created_by_name: string | null;
    }>(
      `select o.id, o.kind, o.status, o.amount_usd, o.incoterm, o.freight_usd, o.insurance_usd, o.inspection_usd, o.valid_until, o.created_at,
              o.inquiry_id, i.ref_no as inquiry_ref, c.id as customer_id, c.full_name as customer_name,
              v.ref_no as vehicle_ref, v.fob_price_usd as list_price,
              (select display_name from public.profiles where id = o.created_by and role <> 'customer') as created_by_name
         from public.offers o
         join public.inquiries i on i.id = o.inquiry_id
         join public.customers c on c.id = o.customer_id
         left join public.vehicles v on v.id = o.vehicle_id
        where ${where}
        order by o.created_at desc limit 200`,
    ),
  );

  return (
    <div>
      <PageHeader title="Offers & quotations" description="Customer offers (bids) and the quotations and counter-offers sent by staff. Open a conversation to respond." />
      <Tabs
        current={tab}
        items={[
          { key: "pending", label: "Pending", href: "/admin/offers?tab=pending" },
          { key: "customer", label: "Customer offers to answer", href: "/admin/offers?tab=customer" },
          { key: "accepted", label: "Accepted", href: "/admin/offers?tab=accepted" },
          { key: "all", label: "All", href: "/admin/offers?tab=all" },
        ]}
      />
      <Table>
        <thead>
          <tr><Th>Type</Th><Th>Customer</Th><Th>Vehicle</Th><Th className="text-end">Amount</Th><Th className="text-end">vs list price</Th><Th>Status</Th><Th>Created</Th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={7}>No offers here.</EmptyRow>}
          {rows.map((o) => {
            const diff = o.list_price ? o.amount_usd - o.list_price : null;
            return (
              <tr key={o.id} className="hover:bg-page/50">
                <Td>
                  <Link href={`/admin/inquiries/${o.inquiry_id}`} className="font-semibold hover:text-brand">{t.status.offerKind[o.kind as keyof typeof t.status.offerKind]}</Link>
                  <p className="num text-xs text-muted">{o.inquiry_ref}{o.created_by_name && ` · by ${o.created_by_name}`}</p>
                </Td>
                <Td><Link href={`/admin/customers/${o.customer_id}`} className="hover:text-brand">{o.customer_name}</Link></Td>
                <Td className="num">{o.vehicle_ref ?? "—"}</Td>
                <Td className="num text-end font-semibold">
                  {formatUsd(o.amount_usd)} <span className="text-xs font-normal text-muted">{o.incoterm}</span>
                  {(o.freight_usd || o.insurance_usd || o.inspection_usd) && (
                    <p className="text-xs font-normal text-muted">+ {formatUsd((o.freight_usd ?? 0) + (o.insurance_usd ?? 0) + (o.inspection_usd ?? 0))} extras</p>
                  )}
                </Td>
                <Td className={`num text-end text-xs ${diff != null && diff < 0 ? "text-danger" : "text-muted"}`}>
                  {diff == null ? "—" : `${diff >= 0 ? "+" : ""}${formatUsd(diff)}`}
                </Td>
                <Td>
                  <StatusBadge status={o.status} label={t.status.offer[o.status as keyof typeof t.status.offer]} />
                  {o.valid_until && o.status === "pending" && <p className="mt-1 text-xs text-muted">until {formatDate(o.valid_until)}</p>}
                </Td>
                <Td className="text-xs text-muted">{formatRelative(o.created_at)}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
