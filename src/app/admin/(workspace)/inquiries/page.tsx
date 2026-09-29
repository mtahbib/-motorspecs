import { CalendarClock } from "lucide-react";
import { isPast } from "@/lib/time";
import Link from "next/link";
import { EmptyRow, PageHeader, Table, Tabs, Td, Th } from "@/components/admin/kit";
import { DemoBadge, StatusBadge } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { formatRelative } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";

export const metadata = { title: "Inquiry inbox" };

type Row = {
  id: string; ref_no: string; subject: string; kind: string; status: string; last_message_at: string; follow_up_at: string | null;
  customer_id: string; customer_name: string; customer_code: string; assigned: string | null; is_demo: boolean;
  vehicle_ref: string | null; last_body: string | null; last_sender: string | null; pending_offer: number | null;
};

const TABS = ["needs_reply", "unassigned", "open", "closed", "all"] as const;

export default async function InboxPage({ searchParams }: PageProps<"/admin/inquiries">) {
  const viewer = await requireStaff();
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(String(sp.tab)) ? (String(sp.tab) as (typeof TABS)[number]) : "needs_reply";
  const mine = sp.mine === "1";
  const t = adminT;

  const { rows, counts } = await withDb(async (tx) => {
    const base = `
      from public.inquiries i
      join public.customers c on c.id = i.customer_id
      left join lateral (select m.body, m.sender_role from public.messages m where m.inquiry_id = i.id order by m.created_at desc limit 1) lm on true`;
    const conditions: Record<string, string> = {
      needs_reply: "i.status not in ('won', 'lost', 'closed') and lm.sender_role = 'customer'",
      unassigned: "c.assigned_staff_id is null and i.status not in ('won', 'lost', 'closed')",
      open: "i.status not in ('won', 'lost', 'closed')",
      closed: "i.status in ('won', 'lost', 'closed')",
      all: "true",
    };
    const mineSql = mine ? " and c.assigned_staff_id = auth.uid()" : "";
    const [counts] = await tx.query<Record<string, number>>(
      `select ${Object.entries(conditions).map(([k, cond]) => `count(*) filter (where ${cond}${mineSql})::int as ${k}`).join(", ")} ${base}`,
    );
    const rows = await tx.query<Row>(
      `select i.id, i.ref_no, i.subject, i.kind, i.status, i.last_message_at, i.follow_up_at, i.is_demo,
              c.id as customer_id, c.full_name as customer_name, c.customer_code,
              (select s.display_name from public.staff_directory s where s.id = c.assigned_staff_id) as assigned,
              (select ref_no from public.vehicles v where v.id = i.vehicle_id) as vehicle_ref,
              lm.body as last_body, lm.sender_role as last_sender,
              (select o.amount_usd from public.offers o where o.inquiry_id = i.id and o.status = 'pending' and o.kind = 'customer_offer' order by o.created_at desc limit 1) as pending_offer
       ${base}
       where ${conditions[tab]}${mineSql}
       order by (lm.sender_role = 'customer') desc, i.last_message_at desc
       limit 200`,
    );
    return { rows, counts };
  });

  const href = (k: string) => `/admin/inquiries?tab=${k}${mine ? "&mine=1" : ""}`;
  const labels: Record<string, string> = { needs_reply: "Needs reply", unassigned: "Unassigned", open: "Open", closed: "Closed", all: "All" };

  return (
    <div>
      <PageHeader
        title="Inquiry inbox"
        description="Every question and offer from customers. Conversations are routed to the customer's salesperson; unassigned ones wait here for the admin."
        actions={
          <Link href={`/admin/inquiries?tab=${tab}${mine ? "" : "&mine=1"}`} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${mine ? "border-brand bg-brand-soft text-brand" : "border-line-strong text-muted hover:text-ink"}`}>
            {mine ? "Showing my customers" : "Only my customers"}
          </Link>
        }
      />
      <Tabs
        current={tab}
        items={TABS.filter((k) => k !== "unassigned" || viewer.isAdmin).map((k) => ({ key: k, label: labels[k], href: href(k), count: counts[k] }))}
      />
      <Table>
        <thead>
          <tr><Th>Customer</Th><Th>Conversation</Th><Th>Salesperson</Th><Th>Status</Th><Th>Updated</Th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={5}>{tab === "needs_reply" ? "You're all caught up." : t.common.noResults}</EmptyRow>}
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-page/50">
              <Td>
                <Link href={`/admin/customers/${r.customer_id}`} className="font-semibold hover:text-brand">{r.customer_name}</Link>
                <p className="num text-xs text-muted">{r.customer_code} {r.is_demo && <DemoBadge />}</p>
              </Td>
              <Td className="max-w-md">
                <Link href={`/admin/inquiries/${r.id}`} className="font-medium hover:text-brand">
                  {r.last_sender === "customer" && r.status !== "won" && <span className="me-1.5 inline-block size-2 rounded-full bg-brand align-middle" />}
                  {r.subject}
                </Link>
                <p className="num text-xs text-muted">{r.ref_no}{r.vehicle_ref && ` · ${r.vehicle_ref}`}{r.kind === "offer" && " · offer"}</p>
                {r.last_body && <p className="mt-1 line-clamp-1 text-xs text-muted">{r.last_sender === "customer" ? "Customer: " : ""}{r.last_body}</p>}
                {r.pending_offer && <p className="mt-1 text-xs font-semibold text-warn">Offer waiting: USD {r.pending_offer.toLocaleString("en-US")}</p>}
              </Td>
              <Td>{r.assigned ?? <span className="font-semibold text-warn">Unassigned</span>}</Td>
              <Td>
                <StatusBadge status={r.status} label={t.status.inquiry[r.status as keyof typeof t.status.inquiry]} />
                {r.follow_up_at && (
                  <p className={`mt-1 inline-flex items-center gap-1 text-xs ${isPast(r.follow_up_at) ? "font-semibold text-danger" : "text-muted"}`}>
                    <CalendarClock className="size-3" /> {formatRelative(r.follow_up_at)}
                  </p>
                )}
              </Td>
              <Td className="text-xs whitespace-nowrap text-muted">{formatRelative(r.last_message_at)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
