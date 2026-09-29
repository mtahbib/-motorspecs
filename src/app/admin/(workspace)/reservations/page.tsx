import Link from "next/link";
import { isWithinHours } from "@/lib/time";
import { convertToSale, expireOverdueReservations, extendReservation, releaseReservation, reserveVehicle } from "@/app/admin/actions/deals";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { EmptyRow, Label, PageHeader, Panel, Table, Tabs, Td, Th } from "@/components/admin/kit";
import { StatusBadge } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { formatDateTime, formatRelative, formatUsd } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";
import { listVehicleOptions } from "@/lib/queries/admin";

export const metadata = { title: "Reservations" };

export default async function ReservationsPage({ searchParams }: PageProps<"/admin/reservations">) {
  await requireStaff();
  const sp = await searchParams;
  const tab = sp.tab === "history" ? "history" : "active";
  const t = adminT;

  const { rows, vehicles, customers } = await withDb(async (tx) => ({
    rows: await tx.query<{
      id: string; status: string; reserved_until: string; agreed_price_usd: number | null; notes: string | null; release_reason: string | null;
      created_at: string; customer_id: string; customer_name: string; vehicle_id: string; vehicle_ref: string; vehicle_title: string | null;
      fob_price_usd: number | null; inquiry_id: string | null; reserved_by: string | null; sale_id: string | null;
    }>(
      `select r.id, r.status, r.reserved_until, r.agreed_price_usd, r.notes, r.release_reason, r.created_at, r.inquiry_id,
              c.id as customer_id, c.full_name as customer_name, v.id as vehicle_id, v.ref_no as vehicle_ref, v.fob_price_usd,
              (select title from public.vehicle_translations where vehicle_id = v.id and locale = 'en') as vehicle_title,
              (select display_name from public.profiles where id = r.reserved_by) as reserved_by,
              (select s.id from public.sales s where s.reservation_id = r.id limit 1) as sale_id
         from public.reservations r join public.customers c on c.id = r.customer_id join public.vehicles v on v.id = r.vehicle_id
        where ${tab === "active" ? "r.status = 'active'" : "r.status <> 'active'"}
        order by ${tab === "active" ? "r.reserved_until" : "r.updated_at desc"} limit 200`,
    ),
    vehicles: await listVehicleOptions(tx, ["published"]),
    customers: await tx.query<{ id: string; full_name: string; customer_code: string }>(
      "select id, full_name, customer_code from public.customers where status in ('lead', 'active') order by full_name limit 500",
    ),
  }));

  return (
    <div>
      <PageHeader
        title="Reservations"
        description="A vehicle can be held for one customer at a time. Reserved vehicles show as “Reserved” on the website and cannot be sold to anyone else."
        actions={
          <ActionForm action={expireOverdueReservations}>
            <SubmitButton variant="secondary" pendingLabel="Checking…">Expire overdue holds</SubmitButton>
          </ActionForm>
        }
      />
      <Tabs current={tab} items={[{ key: "active", label: "Active", href: "/admin/reservations" }, { key: "history", label: "History", href: "/admin/reservations?tab=history" }]} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Table>
          <thead><tr><Th>Vehicle</Th><Th>Customer</Th><Th>Held until</Th><Th className="text-end">Agreed</Th><Th>{tab === "active" ? "Actions" : "Outcome"}</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5}>{tab === "active" ? "No vehicles are reserved right now." : "No history yet."}</EmptyRow>}
            {rows.map((r) => {
              const soon = isWithinHours(r.reserved_until, 48);
              return (
                <tr key={r.id} className="align-top hover:bg-page/50">
                  <Td>
                    <Link href={`/admin/vehicles/${r.vehicle_id}`} className="font-semibold hover:text-brand">{r.vehicle_ref}</Link>
                    <p className="text-xs text-muted">{r.vehicle_title}</p>
                  </Td>
                  <Td>
                    <Link href={`/admin/customers/${r.customer_id}`} className="hover:text-brand">{r.customer_name}</Link>
                    <p className="text-xs text-muted">by {r.reserved_by ?? "—"}{r.inquiry_id && <> · <Link href={`/admin/inquiries/${r.inquiry_id}`} className="hover:underline">conversation</Link></>}</p>
                  </Td>
                  <Td className={tab === "active" && soon ? "font-semibold text-warn" : ""}>
                    {formatDateTime(r.reserved_until)}
                    {tab === "active" && <p className="text-xs font-normal text-muted">{formatRelative(r.reserved_until)}</p>}
                  </Td>
                  <Td className="num text-end">{formatUsd(r.agreed_price_usd ?? r.fob_price_usd)}</Td>
                  <Td>
                    {tab === "active" ? (
                      <div className="flex flex-col gap-2">
                        <details>
                          <summary className="cursor-pointer text-sm font-semibold text-brand">Convert to sale</summary>
                          <ActionForm
                            action={convertToSale}
                            className="mt-2 grid grid-cols-2 gap-2"
                            resultLink={{ prefix: "/admin/sales/", key: "saleId", label: "Open sale" }}
                          >
                            <input type="hidden" name="reservationId" value={r.id} />
                            <input name="price" type="number" min={1} required defaultValue={r.agreed_price_usd ?? r.fob_price_usd ?? undefined} className="input num" aria-label="Vehicle price" />
                            <select name="incoterm" className="input" aria-label="Terms" defaultValue="FOB"><option>FOB</option><option>CFR</option><option>CIF</option></select>
                            <input name="freight" type="number" min={0} placeholder="Freight" className="input num" aria-label="Freight" />
                            <input name="insurance" type="number" min={0} placeholder="Insurance" className="input num" aria-label="Insurance" />
                            <div className="col-span-2"><SubmitButton size="sm" pendingLabel="…">Create sale</SubmitButton></div>
                          </ActionForm>
                        </details>
                        <ActionForm action={extendReservation} className="flex items-center gap-2">
                          <input type="hidden" name="reservationId" value={r.id} />
                          <input name="days" type="number" min={1} max={30} defaultValue={3} className="input num h-8 w-16 py-1" aria-label="Days" />
                          <SubmitButton size="sm" variant="secondary" pendingLabel="…">Extend</SubmitButton>
                        </ActionForm>
                        <ActionForm action={releaseReservation} className="flex items-center gap-2">
                          <input type="hidden" name="reservationId" value={r.id} />
                          <input name="reason" required maxLength={500} placeholder="Reason" className="input h-8 py-1" aria-label="Release reason" />
                          <SubmitButton size="sm" variant="ghost" pendingLabel="…">Release</SubmitButton>
                        </ActionForm>
                      </div>
                    ) : (
                      <div>
                        <StatusBadge status={r.status} label={t.status.reservation[r.status as keyof typeof t.status.reservation]} />
                        {r.release_reason && <p className="mt-1 text-xs text-muted">{r.release_reason}</p>}
                        {r.sale_id && <Link href={`/admin/sales/${r.sale_id}`} className="mt-1 block text-xs font-semibold text-brand hover:underline">Open sale</Link>}
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>

        <Panel title="Reserve a vehicle" className="h-fit">
          <p className="mb-3 text-xs text-muted">Usually done from a conversation. Use this for deals agreed by phone or in person.</p>
          <ActionForm action={reserveVehicle} resetOnSuccess className="flex flex-col gap-3">
            <div>
              <Label htmlFor="rv-vehicle">Vehicle (available only)</Label>
              <select id="rv-vehicle" name="vehicleId" required className="input">
                <option value="">Choose…</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.ref_no} · {v.title}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="rv-customer">Customer</Label>
              <select id="rv-customer" name="customerId" required className="input">
                <option value="">Choose…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name} ({c.customer_code})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="rv-days">Hold days</Label><input id="rv-days" name="holdDays" type="number" min={1} max={30} defaultValue={5} className="input num" /></div>
              <div><Label htmlFor="rv-price" optional>Agreed</Label><input id="rv-price" name="agreedPrice" type="number" min={1} className="input num" /></div>
            </div>
            <div><Label htmlFor="rv-notes" optional>Notes</Label><input id="rv-notes" name="notes" maxLength={2000} className="input" /></div>
            <SubmitButton pendingLabel="Reserving…">Reserve</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </div>
  );
}
