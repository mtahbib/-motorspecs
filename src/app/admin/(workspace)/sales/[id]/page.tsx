import Link from "next/link";
import { todayIsoDate } from "@/lib/time";
import { notFound } from "next/navigation";
import { recordPayment, setSaleStatus, updateSale, verifyPayment, voidPayment } from "@/app/admin/actions/deals";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { DocumentsPanel, type AdminDocument } from "@/components/admin/documents-panel";
import { Label, PageHeader, Panel } from "@/components/admin/kit";
import { ShipmentForm, type ShipmentValues } from "@/components/admin/shipment-form";
import { ShipmentProgress } from "@/components/shipment-progress";
import { Alert, DemoBadge, KeyValue, StatusBadge } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatUsd } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";

type Sale = {
  id: string; sale_no: string; invoice_no: string | null; status: string; incoterm: string; price_usd: number; freight_usd: number;
  insurance_usd: number; other_charges_usd: number; total_usd: number; notes: string | null; sold_at: string; completed_at: string | null;
  cancelled_at: string | null; cancel_reason: string | null; is_demo: boolean; inquiry_id: string | null;
  customer_id: string; customer_name: string; customer_code: string; vehicle_id: string; vehicle_ref: string; vehicle_title: string | null;
  staff_name: string | null; internal_cost_usd: number | null;
};

export default async function SalePage({ params }: PageProps<"/admin/sales/[id]">) {
  const viewer = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = adminT;

  const data = await withDb(async (tx) => {
    const [sale] = await tx.query<Sale>(
      `select s.*, c.full_name as customer_name, c.customer_code, v.ref_no as vehicle_ref,
              (select title from public.vehicle_translations where vehicle_id = v.id and locale = 'en') as vehicle_title,
              (select display_name from public.profiles where id = s.staff_id) as staff_name,
              (select internal_cost_usd from public.vehicle_private where vehicle_id = v.id) as internal_cost_usd
         from public.sales s join public.customers c on c.id = s.customer_id join public.vehicles v on v.id = s.vehicle_id
        where s.id = $1`,
      [id],
    );
    if (!sale) return null;
    const payments = await tx.query<{
      id: string; amount_usd: number; method: string; reference: string | null; paid_on: string; status: string; note: string | null;
      recorded_by_name: string | null; verified_by_name: string | null; verified_at: string | null; void_reason: string | null;
    }>(
      `select p.*, (select display_name from public.profiles where id = p.recorded_by) as recorded_by_name,
              (select display_name from public.profiles where id = p.verified_by) as verified_by_name
         from public.payments p where p.sale_id = $1 order by p.paid_on, p.created_at`,
      [id],
    );
    const [shipment] = await tx.query<ShipmentValues>("select * from public.shipments where sale_id = $1", [id]);
    const events = shipment
      ? await tx.query<{ id: string; status: string; note: string | null; visible_to_customer: boolean; created_at: string; by_name: string | null }>(
          `select e.id, e.status, e.note, e.visible_to_customer, e.created_at, (select display_name from public.profiles where id = e.created_by) as by_name
             from public.shipment_events e where e.shipment_id = $1 order by e.created_at desc`,
          [shipment.id],
        )
      : [];
    const documents = await tx.query<AdminDocument>(
      `select d.id, d.kind, d.title, d.file_name, d.size_bytes, d.shared_with_customer, d.created_at,
              (select display_name from public.profiles where id = d.uploaded_by) as uploaded_by_name
         from public.documents d where d.sale_id = $1 and d.deleted_at is null order by d.created_at desc`,
      [id],
    );
    return { sale, payments, shipment, events, documents };
  });
  if (!data) notFound();
  const s = data.sale;
  const paid = data.payments.filter((p) => p.status !== "void").reduce((sum, p) => sum + p.amount_usd, 0);
  const verified = data.payments.filter((p) => p.status === "verified").reduce((sum, p) => sum + p.amount_usd, 0);
  const balance = Math.max(0, s.total_usd - paid);
  const cancelled = s.status === "cancelled";
  const today = todayIsoDate();

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/sales", label: "Sales" }}
        title={`Sale ${s.sale_no}`}
        meta={
          <>
            <StatusBadge status={s.status} label={t.status.sale[s.status as keyof typeof t.status.sale]} />
            <Link href={`/admin/customers/${s.customer_id}`} className="font-semibold text-ink hover:text-brand">{s.customer_name}</Link>
            <span>· {s.customer_code} · {formatDate(s.sold_at)} · {s.staff_name}</span>
            {s.is_demo && <DemoBadge />}
          </>
        }
      />
      {cancelled && <Alert tone="danger" className="mb-5">Cancelled {formatDateTime(s.cancelled_at)} — {s.cancel_reason}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Payments" actions={<span className="num text-sm text-muted">Paid {formatUsd(paid, "en", 2)} of {formatUsd(s.total_usd, "en", 2)}</span>}>
            <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-page" role="progressbar" aria-valuenow={Math.round((paid / s.total_usd) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Paid">
              <div className="flex h-full">
                <div className="bg-ok" style={{ width: `${Math.min(100, (verified / s.total_usd) * 100)}%` }} />
                <div className="bg-warn" style={{ width: `${Math.min(100, ((paid - verified) / s.total_usd) * 100)}%` }} />
              </div>
            </div>
            <p className="mb-4 flex flex-wrap gap-4 text-xs text-muted">
              <span><span className="me-1 inline-block size-2 rounded-full bg-ok" />Verified {formatUsd(verified, "en", 2)}</span>
              <span><span className="me-1 inline-block size-2 rounded-full bg-warn" />Recorded, not yet verified {formatUsd(paid - verified, "en", 2)}</span>
              <span className="font-semibold text-ink">Balance {formatUsd(balance, "en", 2)}</span>
            </p>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {data.payments.length === 0 && <li className="px-4 py-3 text-sm text-muted">No payments recorded.</li>}
              {data.payments.map((p) => (
                <li key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${p.status === "void" ? "opacity-60" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`num font-semibold ${p.status === "void" ? "line-through" : ""}`}>{formatUsd(p.amount_usd, "en", 2)} <span className="text-xs font-normal text-muted">{p.method.replace("_", " ")}</span></p>
                    <p className="text-xs text-muted">
                      Paid {formatDate(p.paid_on)}{p.reference && ` · ref ${p.reference}`} · recorded by {p.recorded_by_name}
                      {p.verified_by_name && ` · verified by ${p.verified_by_name} ${formatDate(p.verified_at)}`}
                      {p.void_reason && ` · void: ${p.void_reason}`}
                    </p>
                  </div>
                  <StatusBadge status={p.status} label={t.status.payment[p.status as keyof typeof t.status.payment]} />
                  {viewer.isAdmin && p.status === "recorded" && (
                    <ActionForm action={verifyPayment}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <SubmitButton size="sm" pendingLabel="…">Verify</SubmitButton>
                    </ActionForm>
                  )}
                  {viewer.isAdmin && p.status !== "void" && (
                    <details className="basis-full">
                      <summary className="cursor-pointer text-xs font-semibold text-danger">Void this payment…</summary>
                      <ActionForm action={voidPayment} className="mt-2 flex gap-2">
                        <input type="hidden" name="paymentId" value={p.id} />
                        <input name="reason" required maxLength={500} placeholder="Reason (required)" className="input h-8 py-1 text-sm" aria-label="Void reason" />
                        <SubmitButton size="sm" variant="danger" pendingLabel="…">Void</SubmitButton>
                      </ActionForm>
                    </details>
                  )}
                </li>
              ))}
            </ul>
            {!cancelled && (
              <details className="mt-4 rounded-xl border border-line" open={data.payments.length === 0}>
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand">Record a payment received</summary>
                <ActionForm action={recordPayment} resetOnSuccess className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
                  <input type="hidden" name="saleId" value={s.id} />
                  <div><Label htmlFor="p-amount">Amount (USD)</Label><input id="p-amount" name="amount" type="number" min={0.01} step={0.01} required defaultValue={balance || undefined} className="input num" /></div>
                  <div><Label htmlFor="p-date">Date received</Label><input id="p-date" name="paidOn" type="date" required defaultValue={today} className="input" /></div>
                  <div>
                    <Label htmlFor="p-method">Method</Label>
                    <select id="p-method" name="method" defaultValue="bank_transfer" className="input">
                      <option value="bank_transfer">Bank transfer (TT)</option><option value="card">Card</option><option value="cash">Cash</option><option value="other">Other</option>
                    </select>
                  </div>
                  <div><Label htmlFor="p-ref" optional>Bank reference</Label><input id="p-ref" name="reference" maxLength={120} className="input" /></div>
                  <div className="sm:col-span-2"><Label htmlFor="p-note" optional>Note</Label><input id="p-note" name="note" maxLength={1000} className="input" /></div>
                  <div className="sm:col-span-2"><SubmitButton pendingLabel="Saving…">Record payment</SubmitButton></div>
                </ActionForm>
              </details>
            )}
          </Panel>

          {data.shipment && (
            <Panel title="Shipping & export">
              <ShipmentProgress status={data.shipment.status} labels={t.status.shipment} />
              <div className="mt-6">{cancelled ? <p className="text-sm text-muted">Sale cancelled.</p> : <ShipmentForm shipment={data.shipment} />}</div>
              {data.events.length > 0 && (
                <ol className="mt-6 border-s-2 border-line ps-4">
                  {data.events.map((e) => (
                    <li key={e.id} className="relative pb-3 text-sm">
                      <span className="absolute -start-[1.4rem] top-1.5 size-2.5 rounded-full bg-brand" />
                      <p className="font-semibold">{t.status.shipment[e.status as keyof typeof t.status.shipment] ?? e.status}{!e.visible_to_customer && <span className="ms-2 text-xs font-normal text-muted">(staff only)</span>}</p>
                      {e.note && <p className="text-muted">{e.note}</p>}
                      <p className="text-xs text-subtle">{formatDateTime(e.created_at)}{e.by_name && ` · ${e.by_name}`}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          )}

          <DocumentsPanel customerId={s.customer_id} saleId={s.id} documents={data.documents} title="Sale documents" />
        </div>

        <aside className="flex flex-col gap-6">
          <Panel title="Order">
            <KeyValue
              className="!grid-cols-1"
              items={[
                { label: "Vehicle", value: <Link href={`/admin/vehicles/${s.vehicle_id}`} className="hover:text-brand">{s.vehicle_ref}</Link> },
                { label: "Terms", value: s.incoterm },
                { label: "Vehicle price", value: formatUsd(s.price_usd, "en", 2) },
                { label: "Freight", value: formatUsd(s.freight_usd, "en", 2) },
                { label: "Insurance", value: formatUsd(s.insurance_usd, "en", 2) },
                { label: "Other charges", value: formatUsd(s.other_charges_usd, "en", 2) },
                { label: "Total", value: <strong>{formatUsd(s.total_usd, "en", 2)}</strong> },
                ...(viewer.isAdmin && s.internal_cost_usd != null
                  ? [{ label: "Gross margin (admin only)", value: <span className="text-ok">{formatUsd(s.price_usd - s.internal_cost_usd, "en", 0)}</span> }]
                  : []),
              ]}
            />
            <p className="mt-2 text-xs text-muted">{s.vehicle_title}</p>
            {s.inquiry_id && <Link href={`/admin/inquiries/${s.inquiry_id}`} className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">Open conversation</Link>}
          </Panel>

          <Panel title="Invoice & notes">
            <ActionForm action={updateSale} className="flex flex-col gap-3">
              <input type="hidden" name="saleId" value={s.id} />
              <div><Label htmlFor="inv">Invoice number</Label><input id="inv" name="invoiceNo" defaultValue={s.invoice_no ?? ""} maxLength={60} className="input" /></div>
              <div><Label htmlFor="snotes" optional>Internal notes</Label><textarea id="snotes" name="notes" defaultValue={s.notes ?? ""} rows={3} maxLength={2000} className="input" /></div>
              <SubmitButton variant="secondary" pendingLabel="Saving…">Save</SubmitButton>
            </ActionForm>
          </Panel>

          {!cancelled && s.status !== "completed" && (
            <Panel title="Close out">
              <div className="flex flex-col gap-3">
                {s.status !== "delivered" && (
                  <ActionForm action={setSaleStatus}>
                    <input type="hidden" name="saleId" value={s.id} />
                    <input type="hidden" name="status" value="delivered" />
                    <SubmitButton variant="secondary" pendingLabel="…">Mark delivered</SubmitButton>
                  </ActionForm>
                )}
                <ActionForm action={setSaleStatus} confirm={balance > 0 ? "There is still a balance outstanding. Complete anyway?" : undefined}>
                  <input type="hidden" name="saleId" value={s.id} />
                  <input type="hidden" name="status" value="completed" />
                  <SubmitButton pendingLabel="…">Mark completed</SubmitButton>
                </ActionForm>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-danger">Cancel sale…</summary>
                  <ActionForm action={setSaleStatus} confirm="Cancel this sale? The vehicle will be listed as available again." className="mt-2 flex flex-col gap-2">
                    <input type="hidden" name="saleId" value={s.id} />
                    <input type="hidden" name="status" value="cancelled" />
                    <input name="reason" required maxLength={500} placeholder="Reason (required)" className="input" aria-label="Cancel reason" />
                    <SubmitButton variant="danger" pendingLabel="…">Cancel sale</SubmitButton>
                  </ActionForm>
                </details>
              </div>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
