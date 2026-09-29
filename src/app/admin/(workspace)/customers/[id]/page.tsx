import { KeyRound, Link2, Mail, MessageCircle, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addCustomerNote, createInquiryForCustomer, createInviteCode, reassignCustomer, updateCustomer,
} from "@/app/admin/actions/customers";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { CustomerFields } from "@/components/admin/customer-fields";
import { DocumentsPanel, type AdminDocument } from "@/components/admin/documents-panel";
import { EmptyRow, Label, PageHeader, Panel, Table, Td, Th } from "@/components/admin/kit";
import { TasksPanel, type TaskRow } from "@/components/admin/tasks-panel";
import { Alert, Badge, DemoBadge, StatusBadge } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { countryName, formatDate, formatDateTime, formatRelative, formatUsd } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";
import { listStaffOptions, listVehicleOptions } from "@/lib/queries/admin";

type Customer = {
  id: string; customer_code: string; full_name: string; company_name: string | null; email: string | null; phone: string | null;
  whatsapp: string | null; country_code: string | null; city: string | null; address_line: string | null; postal_code: string | null;
  destination_port: string | null; preferred_language: string; preferred_contact: string; status: string; verification_status: string;
  verified_name: string | null; verified_company: string | null; verified_at: string | null; assigned_staff_id: string | null;
  assigned_name: string | null; source: string; tags: string[]; is_demo: boolean; linked: boolean; created_at: string;
  created_by_name: string | null; merged_into: string | null;
};

export default async function CustomerPage({ params, searchParams }: PageProps<"/admin/customers/[id]">) {
  const viewer = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = adminT;

  const data = await withDb(async (tx) => {
    const [customer] = await tx.query<Customer>(
      `select c.*, (c.auth_user_id is not null) as linked,
              (select s.display_name from public.staff_directory s where s.id = c.assigned_staff_id) as assigned_name,
              (select s.display_name from public.staff_directory s where s.id = c.created_by) as created_by_name
         from public.customers c where c.id = $1`,
      [id],
    );
    if (!customer) return null;
    const assignments = await tx.query<{ id: string; from_name: string | null; to_name: string | null; by_name: string | null; reason: string | null; created_at: string }>(
        `select a.id, a.reason, a.created_at,
                (select display_name from public.profiles where id = a.from_staff_id) as from_name,
                (select display_name from public.profiles where id = a.to_staff_id) as to_name,
                (select display_name from public.profiles where id = a.assigned_by) as by_name
           from public.customer_assignments a where a.customer_id = $1 order by a.created_at desc`,
        [id],
      );
    const notes = await tx.query<{ id: string; body: string; created_at: string; author: string | null; inquiry_ref: string | null; inquiry_id: string | null }>(
        `select n.id, n.body, n.created_at, n.inquiry_id,
                (select display_name from public.profiles where id = n.author_id) as author,
                (select ref_no from public.inquiries where id = n.inquiry_id) as inquiry_ref
           from public.internal_notes n where n.customer_id = $1 order by n.created_at desc`,
        [id],
      );
    const inquiries = await tx.query<{ id: string; ref_no: string; subject: string; status: string; last_message_at: string; vehicle_ref: string | null }>(
        `select i.id, i.ref_no, i.subject, i.status, i.last_message_at, (select ref_no from public.vehicles where id = i.vehicle_id) as vehicle_ref
           from public.inquiries i where i.customer_id = $1 order by i.last_message_at desc`,
        [id],
      );
    const reservations = await tx.query<{ id: string; status: string; reserved_until: string; agreed_price_usd: number | null; vehicle_ref: string }>(
        `select r.id, r.status, r.reserved_until, r.agreed_price_usd, v.ref_no as vehicle_ref
           from public.reservations r join public.vehicles v on v.id = r.vehicle_id where r.customer_id = $1 order by r.created_at desc`,
        [id],
      );
    const sales = await tx.query<{ id: string; sale_no: string; status: string; total_usd: number; sold_at: string; vehicle_ref: string }>(
        `select s.id, s.sale_no, s.status, s.total_usd, s.sold_at, v.ref_no as vehicle_ref
           from public.sales s join public.vehicles v on v.id = s.vehicle_id where s.customer_id = $1 order by s.sold_at desc`,
        [id],
      );
    const documents = await tx.query<AdminDocument>(
        `select d.id, d.kind, d.title, d.file_name, d.size_bytes, d.shared_with_customer, d.created_at,
                (select display_name from public.profiles where id = d.uploaded_by) as uploaded_by_name,
                (select sale_no from public.sales where id = d.sale_id) as sale_no
           from public.documents d where d.customer_id = $1 and d.deleted_at is null order by d.created_at desc`,
        [id],
      );
    const tasks = await tx.query<TaskRow>(
        `select t.id, t.title, t.due_at, t.status, t.priority, t.assigned_to, (select display_name from public.profiles where id = t.assigned_to) as assignee
           from public.tasks t where t.customer_id = $1 order by t.due_at`,
        [id],
      );
    const activity = await tx.query<{ id: number; occurred_at: string; summary: string | null; action: string; entity_type: string; actor: string | null; details: Record<string, unknown> }>(
        `select a.id, a.occurred_at, a.summary, a.action, a.entity_type, a.details,
                (select display_name from public.profiles where id = a.actor_id) as actor
           from public.activity_log a where a.customer_id = $1 order by a.occurred_at desc limit 40`,
        [id],
      );
    const invite = await tx.query<{ code_hint: string; expires_at: string; created_at: string }>(
        `select code_hint, expires_at, created_at from public.customer_invites
          where customer_id = $1 and used_at is null and revoked_at is null and expires_at > now() order by created_at desc limit 1`,
        [id],
      );
    const staff = await listStaffOptions(tx);
    const vehicles = await listVehicleOptions(tx);
    return { customer, assignments, notes, inquiries, reservations, sales, documents, tasks, activity, invite: invite[0], staff, vehicles };
  });
  if (!data) notFound();
  const c = data.customer;

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/customers", label: "Customers" }}
        title={c.full_name}
        meta={
          <>
            <span className="num font-semibold text-ink">{c.customer_code}</span>
            {c.company_name && <span>· {c.company_name}</span>}
            <StatusBadge status={c.status} label={t.status.customer[c.status as keyof typeof t.status.customer]} />
            <StatusBadge status={c.verification_status} label={t.status.verification[c.verification_status as keyof typeof t.status.verification]} />
            {c.linked ? <Badge tone="ok"><Link2 className="size-3" /> Portal login linked</Badge> : <Badge>No portal login</Badge>}
            {c.is_demo && <DemoBadge />}
          </>
        }
        actions={
          <details className="relative">
            <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-[10px] bg-brand px-4 text-sm font-semibold text-white">
              <Plus className="size-4" /> New conversation
            </summary>
            <div className="card absolute end-0 z-20 mt-2 w-80 p-4">
              <ActionForm action={createInquiryForCustomer} className="flex flex-col gap-3">
                <input type="hidden" name="customerId" value={c.id} />
                <div>
                  <Label htmlFor="ni-subject">Subject</Label>
                  <input id="ni-subject" name="subject" required maxLength={200} className="input" placeholder="e.g. Phone inquiry about vans" />
                </div>
                <div>
                  <Label htmlFor="ni-vehicle" optional>Vehicle</Label>
                  <select id="ni-vehicle" name="vehicleId" className="input">
                    <option value="">—</option>
                    {data.vehicles.map((v) => <option key={v.id} value={v.id}>{v.ref_no} · {v.title}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="ni-message" optional>First message to customer</Label>
                  <textarea id="ni-message" name="message" rows={3} maxLength={5000} className="input" />
                </div>
                <SubmitButton pendingLabel="Creating…">Create</SubmitButton>
              </ActionForm>
            </div>
          </details>
        }
      />
      {sp.created && <Alert tone="ok" className="mb-5">Customer created. Next: add a follow-up, or open a conversation.</Alert>}
      {c.merged_into && <Alert tone="warn" className="mb-5">This record was merged into <Link className="underline" href={`/admin/customers/${c.merged_into}`}>another customer</Link>.</Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Conversations & deals" bodyClassName="p-0">
            <Table className="rounded-none border-0 shadow-none">
              <thead>
                <tr><Th>Reference</Th><Th>Subject</Th><Th>Vehicle</Th><Th>Status</Th><Th>Updated</Th></tr>
              </thead>
              <tbody>
                {data.inquiries.length === 0 && data.sales.length === 0 && <EmptyRow colSpan={5}>No conversations yet.</EmptyRow>}
                {data.inquiries.map((i) => (
                  <tr key={i.id} className="hover:bg-page/50">
                    <Td><Link href={`/admin/inquiries/${i.id}`} className="num font-semibold text-brand hover:underline">{i.ref_no}</Link></Td>
                    <Td>{i.subject}</Td>
                    <Td className="num">{i.vehicle_ref ?? "—"}</Td>
                    <Td><StatusBadge status={i.status} label={t.status.inquiry[i.status as keyof typeof t.status.inquiry]} /></Td>
                    <Td className="text-xs text-muted">{formatRelative(i.last_message_at)}</Td>
                  </tr>
                ))}
                {data.reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-page/50">
                    <Td><Link href="/admin/reservations" className="font-semibold text-brand hover:underline">Reservation</Link></Td>
                    <Td>Hold until {formatDateTime(r.reserved_until)} {r.agreed_price_usd ? `· ${formatUsd(r.agreed_price_usd)}` : ""}</Td>
                    <Td className="num">{r.vehicle_ref}</Td>
                    <Td><StatusBadge status={r.status} label={t.status.reservation[r.status as keyof typeof t.status.reservation]} /></Td>
                    <Td />
                  </tr>
                ))}
                {data.sales.map((s) => (
                  <tr key={s.id} className="hover:bg-page/50">
                    <Td><Link href={`/admin/sales/${s.id}`} className="num font-semibold text-brand hover:underline">{s.sale_no}</Link></Td>
                    <Td>Sale · {formatUsd(s.total_usd)}</Td>
                    <Td className="num">{s.vehicle_ref}</Td>
                    <Td><StatusBadge status={s.status} label={t.status.sale[s.status as keyof typeof t.status.sale]} /></Td>
                    <Td className="text-xs text-muted">{formatDate(s.sold_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>

          <Panel title="Internal notes" bodyClassName="p-0">
            <ActionForm action={addCustomerNote} resetOnSuccess className="border-b border-line p-5">
              <input type="hidden" name="customerId" value={c.id} />
              <label htmlFor="note-body" className="sr-only">Add a note</label>
              <textarea id="note-body" name="body" required rows={2} maxLength={5000} className="input" placeholder="Add a note — only staff can see this" />
              <div className="mt-2"><SubmitButton size="sm" pendingLabel="Saving…">Add note</SubmitButton></div>
            </ActionForm>
            {data.notes.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No notes yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.notes.map((n) => (
                  <li key={n.id} className="px-5 py-3">
                    <p className="whitespace-pre-line text-sm">{n.body}</p>
                    <p className="mt-1 text-xs text-muted">
                      {n.author ?? "—"} · {formatDateTime(n.created_at)}
                      {n.inquiry_ref && <> · <Link href={`/admin/inquiries/${n.inquiry_id}`} className="hover:underline">{n.inquiry_ref}</Link></>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <DocumentsPanel customerId={c.id} documents={data.documents} />

          <Panel title="Edit details">
            <ActionForm action={updateCustomer} className="flex flex-col gap-5">
              <input type="hidden" name="id" value={c.id} />
              <CustomerFields values={c} />
              <div className="grid gap-4 rounded-xl bg-page p-4 sm:grid-cols-2">
                <p className="label-caps sm:col-span-2">Managed by MotorSpecs — read-only for the customer</p>
                <div>
                  <Label htmlFor="c-status">Status</Label>
                  <select id="c-status" name="status" defaultValue={c.status === "merged" ? "inactive" : c.status} className="input">
                    <option value="lead">Lead</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="c-verification">Verification</Label>
                  <select id="c-verification" name="verification_status" defaultValue={c.verification_status} className="input">
                    {Object.entries(t.status.verification).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="c-vname" optional>Verified name</Label>
                  <input id="c-vname" name="verified_name" defaultValue={c.verified_name ?? ""} maxLength={160} className="input" />
                </div>
                <div>
                  <Label htmlFor="c-vcompany" optional>Verified company</Label>
                  <input id="c-vcompany" name="verified_company" defaultValue={c.verified_company ?? ""} maxLength={160} className="input" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="c-tags" optional>Tags (comma separated)</Label>
                  <input id="c-tags" name="tags" defaultValue={c.tags.join(", ")} maxLength={300} className="input" />
                </div>
              </div>
              <div><SubmitButton pendingLabel="Saving…">Save customer</SubmitButton></div>
            </ActionForm>
          </Panel>

          <Panel title="Activity history" bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {data.activity.length === 0 && <li className="px-5 py-4 text-sm text-muted">No activity recorded.</li>}
              {data.activity.map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-3 px-5 py-2.5 text-sm">
                  <span className="w-40 shrink-0 text-xs text-muted">{formatDateTime(a.occurred_at)}</span>
                  <span className="font-medium">{a.actor ?? "System"}</span>
                  <span className="min-w-0 flex-1 text-muted">{a.summary ?? describeActivity(a)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <Panel title="Contact">
            <ul className="flex flex-col gap-2 text-sm">
              {c.email && <li className="flex items-center gap-2"><Mail className="size-4 text-muted" /> <a className="hover:underline" href={`mailto:${c.email}`}>{c.email}</a></li>}
              {c.phone && <li className="flex items-center gap-2"><Phone className="size-4 text-muted" /> <a className="num hover:underline" href={`tel:${c.phone}`}>{c.phone}</a></li>}
              {c.whatsapp && <li className="flex items-center gap-2"><MessageCircle className="size-4 text-muted" /> <span className="num">{c.whatsapp}</span></li>}
              <li className="text-muted">{[c.city, countryName(c.country_code)].filter(Boolean).join(", ")}{c.destination_port && ` · Port: ${c.destination_port}`}</li>
              <li className="text-xs text-muted">Prefers {c.preferred_contact} · Language {c.preferred_language.toUpperCase()} · Source {c.source}</li>
              <li className="text-xs text-muted">Created {formatDate(c.created_at)}{c.created_by_name && ` by ${c.created_by_name}`}</li>
            </ul>
          </Panel>

          <Panel title="Salesperson">
            <p className="text-sm">Currently: <strong>{c.assigned_name ?? "Unassigned"}</strong></p>
            {viewer.isAdmin ? (
              <ActionForm action={reassignCustomer} className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="customerId" value={c.id} />
                <Label htmlFor="reassign-staff">Assign to</Label>
                <select id="reassign-staff" name="staffId" defaultValue={c.assigned_staff_id ?? ""} className="input">
                  <option value="">Unassigned</option>
                  {data.staff.map((s) => <option key={s.id} value={s.id}>{s.display_name} ({t.roles[s.role]})</option>)}
                </select>
                <input name="reason" maxLength={500} placeholder="Reason (kept in history)" className="input" aria-label="Reason" />
                <SubmitButton variant="secondary" pendingLabel="Saving…">Save assignment</SubmitButton>
                <p className="text-xs text-muted">All conversations, deals and documents move with the customer. Open follow-ups transfer to the new salesperson.</p>
              </ActionForm>
            ) : (
              <p className="mt-2 text-xs text-muted">Only the owner/admin can reassign customers.</p>
            )}
            {data.assignments.length > 0 && (
              <ol className="mt-4 border-s-2 border-line ps-3 text-xs">
                {data.assignments.map((a) => (
                  <li key={a.id} className="pb-2">
                    <p><span className="font-semibold">{a.to_name ?? "Unassigned"}</span>{a.from_name && <span className="text-muted"> (from {a.from_name})</span>}</p>
                    <p className="text-muted">{formatDateTime(a.created_at)}{a.by_name && ` · by ${a.by_name}`}</p>
                    {a.reason && <p className="italic text-muted">“{a.reason}”</p>}
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Portal access">
            {c.linked ? (
              <p className="text-sm">This customer signs in to the website and sees their own inquiries, deals and shared documents.</p>
            ) : (
              <>
                <p className="text-sm text-muted">
                  No website login is linked. When the customer has registered, give them a one-time link code. Matching email or phone is never enough to connect records.
                </p>
                {data.invite && (
                  <p className="mt-2 text-xs text-muted">Active code ending <strong className="num">{data.invite.code_hint}</strong> · expires {formatDate(data.invite.expires_at)}</p>
                )}
                <ActionForm
                  action={createInviteCode}
                  className="mt-3"
                  confirm={data.invite ? "Create a new code? The previous code will stop working." : undefined}
                  resultCode={{ hint: "Customer enters it at My Account Info → Link an existing record. Valid 14 days." }}
                >
                  <input type="hidden" name="customerId" value={c.id} />
                  <SubmitButton variant="secondary" pendingLabel="Creating…"><KeyRound className="size-4" /> Create link code</SubmitButton>
                </ActionForm>
              </>
            )}
          </Panel>

          <TasksPanel tasks={data.tasks} customerId={c.id} staff={data.staff} canAssign={viewer.isAdmin} viewerId={viewer.user.id} />
        </aside>
      </div>
    </div>
  );
}

function describeActivity(a: { action: string; entity_type: string; details: Record<string, unknown> }) {
  const changes = (a.details?.changes ?? {}) as Record<string, { old: unknown; new: unknown }>;
  const keys = Object.keys(changes);
  const label = a.entity_type.replace(/_/g, " ");
  if (a.action === "update" && keys.length) {
    return `Updated ${label}: ${keys
      .slice(0, 4)
      .map((k) => `${k.replace(/_/g, " ")} ${fmtVal(changes[k].old)} → ${fmtVal(changes[k].new)}`)
      .join(", ")}`;
  }
  return `${a.action === "insert" ? "Created" : a.action} ${label}`;
}

function fmtVal(v: unknown) {
  if (v === null || v === undefined || v === "") return "∅";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 24 ? `${s.slice(0, 24)}…` : s;
}
