import Link from "next/link";
import { notFound } from "next/navigation";
import { addCustomerNote, reassignCustomer } from "@/app/admin/actions/customers";
import { convertToSale, reserveVehicle } from "@/app/admin/actions/deals";
import { decideCustomerOffer, sendQuotation, setInquiryStatus, staffReply } from "@/app/admin/actions/inquiries";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldHint, Label, PageHeader, Panel } from "@/components/admin/kit";
import { TasksPanel, type TaskRow } from "@/components/admin/tasks-panel";
import { MessageThread, type ThreadMessage } from "@/components/message-thread";
import { OfferCard } from "@/components/offer-card";
import { VehicleThumb } from "@/components/portal/inquiry-list";
import { Alert, DemoBadge, StatusBadge } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { countryName, formatDateTime, formatUsd } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";
import { listStaffOptions } from "@/lib/queries/admin";
import type { Offer } from "@/lib/queries/portal";

type Inquiry = {
  id: string; ref_no: string; subject: string; kind: string; status: string; destination_port: string | null; created_at: string; is_demo: boolean;
  customer_id: string; customer_name: string; customer_code: string; company_name: string | null; country_code: string | null;
  preferred_language: string; assigned_staff_id: string | null; assigned_name: string | null; customer_port: string | null;
  vehicle: { id: string; ref_no: string; status: string; title: string | null; fob_price_usd: number | null; price_visibility: string; cover: { bucket: string; storage_path: string } | null } | null;
  active_reservation: { id: string; customer_id: string; reserved_until: string; agreed_price_usd: number | null } | null;
  sale_id: string | null;
};

export default async function StaffInquiryPage({ params }: PageProps<"/admin/inquiries/[id]">) {
  const viewer = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = adminT;

  const data = await withDb(async (tx) => {
    const [inquiry] = await tx.query<Inquiry>(
      `select i.id, i.ref_no, i.subject, i.kind, i.status, i.destination_port, i.created_at, i.is_demo,
              c.id as customer_id, c.full_name as customer_name, c.customer_code, c.company_name, c.country_code, c.preferred_language,
              c.assigned_staff_id, c.destination_port as customer_port,
              (select s.display_name from public.staff_directory s where s.id = c.assigned_staff_id) as assigned_name,
              (select jsonb_build_object('id', v.id, 'ref_no', v.ref_no, 'status', v.status, 'fob_price_usd', v.fob_price_usd, 'price_visibility', v.price_visibility,
                        'title', (select t.title from public.vehicle_translations t where t.vehicle_id = v.id and t.locale = 'en'),
                        'cover', (select jsonb_build_object('bucket', m.bucket, 'storage_path', m.storage_path) from public.vehicle_media m
                                   where m.vehicle_id = v.id and m.kind = 'photo' and m.is_public order by m.sort_order limit 1))
                 from public.vehicles v where v.id = i.vehicle_id) as vehicle,
              (select jsonb_build_object('id', r.id, 'customer_id', r.customer_id, 'reserved_until', r.reserved_until, 'agreed_price_usd', r.agreed_price_usd)
                 from public.reservations r where r.vehicle_id = i.vehicle_id and r.status = 'active') as active_reservation,
              (select s.id from public.sales s where s.inquiry_id = i.id and s.status <> 'cancelled' limit 1) as sale_id
         from public.inquiries i join public.customers c on c.id = i.customer_id
        where i.id = $1`,
      [id],
    );
    if (!inquiry) return null;
    const messages = await tx.query<ThreadMessage>(
      `select m.id, m.sender_role, m.body, m.created_at,
              coalesce((select display_name from public.profiles p where p.id = m.sender_id and p.role <> 'customer'), null) as sender_name
         from public.messages m where m.inquiry_id = $1 order by m.created_at`,
      [id],
    );
    const offers = await tx.query<Offer & { created_by_name: string | null }>(
      `select o.*, (select display_name from public.profiles where id = o.created_by and role <> 'customer') as created_by_name
         from public.offers o where o.inquiry_id = $1 order by o.created_at desc`,
      [id],
    );
    const notes = await tx.query<{ id: string; body: string; created_at: string; author: string | null }>(
      `select n.id, n.body, n.created_at, (select display_name from public.profiles where id = n.author_id) as author
         from public.internal_notes n where n.inquiry_id = $1 order by n.created_at desc`,
      [id],
    );
    const tasks = await tx.query<TaskRow>(
      `select t.id, t.title, t.due_at, t.status, t.priority, t.assigned_to, (select display_name from public.profiles where id = t.assigned_to) as assignee
         from public.tasks t where t.inquiry_id = $1 order by t.due_at`,
      [id],
    );
    return { inquiry, messages, offers, notes, tasks, staff: await listStaffOptions(tx) };
  });
  if (!data) notFound();
  const i = data.inquiry;
  const v = i.vehicle;
  const closed = ["won", "lost", "closed"].includes(i.status);
  const accepted = data.offers.find((o) => o.status === "accepted");
  const acceptedTotal = accepted ? accepted.amount_usd + (accepted.freight_usd ?? 0) + (accepted.insurance_usd ?? 0) + (accepted.inspection_usd ?? 0) : null;
  const reservationIsThisCustomer = i.active_reservation?.customer_id === i.customer_id;

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/inquiries", label: "Inbox" }}
        title={i.subject}
        meta={
          <>
            <span className="num font-semibold text-ink">{i.ref_no}</span>
            <StatusBadge status={i.status} label={t.status.inquiry[i.status as keyof typeof t.status.inquiry]} />
            <span>· opened {formatDateTime(i.created_at)}</span>
            {i.is_demo && <DemoBadge />}
          </>
        }
        actions={
          <ActionForm action={setInquiryStatus} className="flex items-center gap-2">
            <input type="hidden" name="inquiryId" value={i.id} />
            <label htmlFor="inq-status" className="sr-only">Status</label>
            <select id="inq-status" name="status" defaultValue={["new", "reserved"].includes(i.status) ? "open" : i.status} className="input h-10 w-auto">
              {(["open", "quoted", "negotiating", "won", "lost", "closed"] as const).map((s) => <option key={s} value={s}>{t.status.inquiry[s]}</option>)}
            </select>
            <SubmitButton variant="secondary" pendingLabel="…">Set status</SubmitButton>
          </ActionForm>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {v && (
            <div className="card flex flex-wrap items-center gap-4 p-4">
              <VehicleThumb cover={v.cover} className="h-16 w-24" />
              <div className="min-w-0 flex-1">
                <Link href={`/admin/vehicles/${v.id}`} className="font-semibold hover:text-brand">{v.title ?? v.ref_no}</Link>
                <p className="num text-xs text-muted">{v.ref_no} · {v.price_visibility === "public" ? `FOB ${formatUsd(v.fob_price_usd)}` : `Ask for price (internal FOB ${formatUsd(v.fob_price_usd)})`}</p>
              </div>
              <StatusBadge status={v.status} label={t.status.vehicle[v.status as keyof typeof t.status.vehicle]} />
            </div>
          )}

          <Panel title="Conversation with customer">
            <MessageThread messages={data.messages} perspective="staff" locale="en" labels={{ you: "You", them: i.customer_name, system: "Update" }} />
            {!closed ? (
              <ActionForm action={staffReply} resetOnSuccess className="mt-5 border-t border-line pt-4">
                <input type="hidden" name="inquiryId" value={i.id} />
                <label htmlFor="reply" className="text-sm font-semibold">Reply to {i.customer_name}</label>
                <textarea id="reply" name="body" rows={3} maxLength={5000} required className="input mt-1.5" placeholder="The customer sees this in their portal" />
                <div className="mt-2 flex items-center gap-3">
                  <SubmitButton pendingLabel="Sending…">Send reply</SubmitButton>
                  <span className="text-xs text-muted">Customer language: {i.preferred_language.toUpperCase()}</span>
                </div>
              </ActionForm>
            ) : (
              <p className="mt-4 text-sm text-muted">This conversation is {i.status}. Change the status to reopen it.</p>
            )}
          </Panel>

          <Panel title="Internal notes (staff only)">
            <ActionForm action={addCustomerNote} resetOnSuccess>
              <input type="hidden" name="customerId" value={i.customer_id} />
              <input type="hidden" name="inquiryId" value={i.id} />
              <label htmlFor="inq-note" className="sr-only">Note</label>
              <textarea id="inq-note" name="body" rows={2} maxLength={5000} required className="input" placeholder="Never shown to the customer" />
              <div className="mt-2"><SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">Add note</SubmitButton></div>
            </ActionForm>
            <ul className="mt-4 flex flex-col gap-3">
              {data.notes.map((n) => (
                <li key={n.id} className="rounded-xl border border-warn/25 bg-warn-soft/50 px-4 py-3">
                  <p className="whitespace-pre-line text-sm">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">{n.author} · {formatDateTime(n.created_at)}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <Panel title="Customer">
            <Link href={`/admin/customers/${i.customer_id}`} className="font-semibold hover:text-brand">{i.customer_name}</Link>
            <p className="num text-xs text-muted">{i.customer_code}{i.company_name && ` · ${i.company_name}`} · {countryName(i.country_code)}</p>
            <p className="mt-2 text-sm">Salesperson: <strong>{i.assigned_name ?? "Unassigned"}</strong></p>
            {viewer.isAdmin && (
              <ActionForm action={reassignCustomer} className="mt-3 flex gap-2">
                <input type="hidden" name="customerId" value={i.customer_id} />
                <input type="hidden" name="reason" value={`Assigned from inquiry ${i.ref_no}`} />
                <label htmlFor="assign" className="sr-only">Assign customer</label>
                <select id="assign" name="staffId" defaultValue={i.assigned_staff_id ?? ""} className="input">
                  <option value="">Unassigned</option>
                  {data.staff.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                </select>
                <SubmitButton variant="secondary" pendingLabel="…">Assign</SubmitButton>
              </ActionForm>
            )}
          </Panel>

          <Panel title="Offers & quotations">
            <div className="flex flex-col gap-3">
              {data.offers.length === 0 && <p className="text-sm text-muted">No offers yet.</p>}
              {data.offers.map((o) => (
                <OfferCard
                  key={o.id}
                  offer={o}
                  locale="en"
                  labels={{ kinds: t.status.offerKind, statuses: t.status.offer, validUntil: "Valid until", freight: "Freight", insurance: "Insurance", inspection: "Inspection", total: "Total", incoterm: "Terms" }}
                  actions={
                    o.status === "pending" ? (
                      o.kind === "customer_offer" ? (
                        <>
                          <ActionForm action={decideCustomerOffer}>
                            <input type="hidden" name="offerId" value={o.id} />
                            <input type="hidden" name="decision" value="accepted" />
                            <SubmitButton size="sm" pendingLabel="…">Accept</SubmitButton>
                          </ActionForm>
                          <ActionForm action={decideCustomerOffer}>
                            <input type="hidden" name="offerId" value={o.id} />
                            <input type="hidden" name="decision" value="declined" />
                            <SubmitButton size="sm" variant="secondary" pendingLabel="…">Decline</SubmitButton>
                          </ActionForm>
                        </>
                      ) : (
                        <ActionForm action={decideCustomerOffer}>
                          <input type="hidden" name="offerId" value={o.id} />
                          <input type="hidden" name="decision" value="withdrawn" />
                          <SubmitButton size="sm" variant="ghost" pendingLabel="…">Withdraw</SubmitButton>
                        </ActionForm>
                      )
                    ) : undefined
                  }
                />
              ))}
            </div>
            {!closed && (
              <details className="mt-4 rounded-xl border border-line">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand">Send a quotation or counter-offer</summary>
                <ActionForm action={sendQuotation} resetOnSuccess className="grid grid-cols-2 gap-3 px-4 pb-4">
                  <input type="hidden" name="inquiryId" value={i.id} />
                  <div className="col-span-2">
                    <Label htmlFor="q-kind">Type</Label>
                    <select id="q-kind" name="kind" className="input" defaultValue="quotation">
                      <option value="quotation">Quotation</option>
                      <option value="counter_offer">Counter-offer</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="q-amount">Vehicle price (USD)</Label>
                    <input id="q-amount" name="amount" type="number" min={1} step="any" required defaultValue={v?.fob_price_usd ?? undefined} className="input num" />
                  </div>
                  <div>
                    <Label htmlFor="q-incoterm">Terms</Label>
                    <select id="q-incoterm" name="incoterm" className="input" defaultValue="FOB">
                      <option value="FOB">FOB</option>
                      <option value="CFR">CFR (incl. freight)</option>
                      <option value="CIF">CIF (freight + insurance)</option>
                    </select>
                  </div>
                  <div><Label htmlFor="q-freight" optional>Freight</Label><input id="q-freight" name="freight" type="number" min={0} step="any" className="input num" /></div>
                  <div><Label htmlFor="q-insurance" optional>Insurance</Label><input id="q-insurance" name="insurance" type="number" min={0} step="any" className="input num" /></div>
                  <div><Label htmlFor="q-inspection" optional>Inspection</Label><input id="q-inspection" name="inspection" type="number" min={0} step="any" className="input num" /></div>
                  <div><Label htmlFor="q-valid">Valid (days)</Label><input id="q-valid" name="validDays" type="number" min={1} max={60} defaultValue={7} required className="input num" /></div>
                  <div className="col-span-2"><Label htmlFor="q-port" optional>Destination port</Label><input id="q-port" name="destinationPort" defaultValue={i.destination_port ?? i.customer_port ?? ""} maxLength={120} className="input" /></div>
                  <div className="col-span-2"><Label htmlFor="q-msg" optional>Message</Label><textarea id="q-msg" name="message" rows={2} maxLength={2000} className="input" /></div>
                  <div className="col-span-2"><SubmitButton pendingLabel="Sending…">Send to customer</SubmitButton></div>
                </ActionForm>
              </details>
            )}
          </Panel>

          {v && (
            <Panel title="Reservation & sale">
              {data.inquiry.sale_id ? (
                <p className="text-sm">Sold. <Link href={`/admin/sales/${data.inquiry.sale_id}`} className="font-semibold text-brand hover:underline">Open the sale</Link></p>
              ) : i.active_reservation ? (
                reservationIsThisCustomer ? (
                  <div className="flex flex-col gap-3">
                    <Alert tone="warn">Reserved for this customer until {formatDateTime(i.active_reservation.reserved_until)}.</Alert>
                    <ActionForm
                      action={convertToSale}
                      className="grid grid-cols-2 gap-3"
                      resultLink={{ prefix: "/admin/sales/", key: "saleId", label: "Open sale" }}
                    >
                      <input type="hidden" name="reservationId" value={i.active_reservation.id} />
                      <div><Label htmlFor="s-price">Vehicle price</Label><input id="s-price" name="price" type="number" min={1} required defaultValue={accepted?.amount_usd ?? i.active_reservation.agreed_price_usd ?? v.fob_price_usd ?? undefined} className="input num" /></div>
                      <div>
                        <Label htmlFor="s-inc">Terms</Label>
                        <select id="s-inc" name="incoterm" defaultValue={accepted?.incoterm ?? "FOB"} className="input"><option>FOB</option><option>CFR</option><option>CIF</option></select>
                      </div>
                      <div><Label htmlFor="s-freight" optional>Freight</Label><input id="s-freight" name="freight" type="number" min={0} defaultValue={accepted?.freight_usd ?? undefined} className="input num" /></div>
                      <div><Label htmlFor="s-ins" optional>Insurance</Label><input id="s-ins" name="insurance" type="number" min={0} defaultValue={accepted?.insurance_usd ?? undefined} className="input num" /></div>
                      <div className="col-span-2"><Label htmlFor="s-other" optional>Other charges (inspection etc.)</Label><input id="s-other" name="other" type="number" min={0} defaultValue={accepted?.inspection_usd ?? undefined} className="input num" /></div>
                      <div className="col-span-2"><SubmitButton pendingLabel="Creating…">Convert to sale</SubmitButton></div>
                    </ActionForm>
                  </div>
                ) : (
                  <Alert tone="danger">This vehicle is reserved for another customer until {formatDateTime(i.active_reservation.reserved_until)}.</Alert>
                )
              ) : v.status === "published" ? (
                <ActionForm action={reserveVehicle} className="grid grid-cols-2 gap-3">
                  <input type="hidden" name="vehicleId" value={v.id} />
                  <input type="hidden" name="customerId" value={i.customer_id} />
                  <input type="hidden" name="inquiryId" value={i.id} />
                  {accepted && <input type="hidden" name="offerId" value={accepted.id} />}
                  <div><Label htmlFor="r-days">Hold for (days)</Label><input id="r-days" name="holdDays" type="number" min={1} max={30} defaultValue={5} required className="input num" /></div>
                  <div><Label htmlFor="r-price" optional>Agreed total</Label><input id="r-price" name="agreedPrice" type="number" min={1} defaultValue={acceptedTotal ?? undefined} className="input num" /></div>
                  <div className="col-span-2"><Label htmlFor="r-notes" optional>Notes</Label><input id="r-notes" name="notes" maxLength={2000} className="input" /></div>
                  <div className="col-span-2">
                    <SubmitButton pendingLabel="Reserving…">Reserve for {i.customer_name.split(" ")[0]}</SubmitButton>
                    <FieldHint>Only one active reservation per vehicle is allowed. The website shows “Reserved”.</FieldHint>
                  </div>
                </ActionForm>
              ) : (
                <p className="text-sm text-muted">Vehicle is {v.status}; it cannot be reserved.</p>
              )}
            </Panel>
          )}

          <TasksPanel tasks={data.tasks} customerId={i.customer_id} inquiryId={i.id} staff={data.staff} canAssign={viewer.isAdmin} viewerId={viewer.user.id} />
        </aside>
      </div>
    </div>
  );
}
