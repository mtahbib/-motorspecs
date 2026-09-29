import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { isPast } from "@/lib/time";
import Link from "next/link";
import { completeTask } from "@/app/admin/actions/tasks";
import { resetDemoData } from "@/app/admin/actions/demo";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { PageHeader, Panel, Stat } from "@/components/admin/kit";
import { Alert, StatusBadge } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import { formatDateTime, formatRelative, formatUsd } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const viewer = await requireStaff();
  const sp = await searchParams;
  const t = adminT;

  const data = await withDb(async (tx) => {
    const [stats] = await tx.query<{
      customers: number; unassigned: number; needs_reply: number; new_inquiries: number; tasks_due: number; tasks_overdue: number;
      reservations: number; expiring: number; awaiting_payment: number; outstanding: number; to_verify: number;
      in_transit: number; published: number; drafts: number;
    }>(
      `select
        (select count(*)::int from public.customers where status in ('lead', 'active')) as customers,
        (select count(*)::int from public.customers where assigned_staff_id is null and status in ('lead', 'active')) as unassigned,
        (select count(*)::int from public.inquiries i where i.status not in ('won', 'lost', 'closed')
           and (select m.sender_role from public.messages m where m.inquiry_id = i.id order by m.created_at desc limit 1) = 'customer') as needs_reply,
        (select count(*)::int from public.inquiries where status = 'new') as new_inquiries,
        (select count(*)::int from public.tasks where status = 'open' and assigned_to = auth.uid() and due_at < now() + interval '1 day') as tasks_due,
        (select count(*)::int from public.tasks where status = 'open' and assigned_to = auth.uid() and due_at < now()) as tasks_overdue,
        (select count(*)::int from public.reservations where status = 'active') as reservations,
        (select count(*)::int from public.reservations where status = 'active' and reserved_until < now() + interval '48 hours') as expiring,
        (select count(*)::int from public.sales where status in ('awaiting_payment', 'partially_paid')) as awaiting_payment,
        (select coalesce(sum(s.total_usd - coalesce((select sum(p.amount_usd) from public.payments p where p.sale_id = s.id and p.status <> 'void'), 0)), 0)
           from public.sales s where s.status in ('awaiting_payment', 'partially_paid')) as outstanding,
        (select count(*)::int from public.payments where status = 'recorded') as to_verify,
        (select count(*)::int from public.shipments where status in ('booked', 'at_port', 'in_transit', 'arrived')) as in_transit,
        (select count(*)::int from public.vehicles where status = 'published') as published,
        (select count(*)::int from public.vehicles where status = 'draft') as drafts`,
    );
    const tasks = await tx.query<{ id: string; title: string; due_at: string; priority: string; customer_id: string | null; customer_name: string | null; inquiry_id: string | null }>(
      `select t.id, t.title, t.due_at, t.priority, t.customer_id, t.inquiry_id, c.full_name as customer_name
         from public.tasks t left join public.customers c on c.id = t.customer_id
        where t.status = 'open' and t.assigned_to = auth.uid()
        order by t.due_at limit 6`,
    );
    const inquiries = await tx.query<{ id: string; ref_no: string; subject: string; status: string; last_message_at: string; customer_name: string; assigned: string | null; last_sender: string | null }>(
      `select i.id, i.ref_no, i.subject, i.status, i.last_message_at, c.full_name as customer_name,
              (select s.display_name from public.staff_directory s where s.id = c.assigned_staff_id) as assigned,
              (select m.sender_role from public.messages m where m.inquiry_id = i.id order by m.created_at desc limit 1) as last_sender
         from public.inquiries i join public.customers c on c.id = i.customer_id
        where i.status not in ('won', 'lost', 'closed')
        order by i.last_message_at desc limit 6`,
    );
    const activity = await tx.query<{ id: number; occurred_at: string; summary: string | null; action: string; entity_type: string; actor: string | null }>(
      `select a.id, a.occurred_at, a.summary, a.action, a.entity_type,
              (select s.display_name from public.staff_directory s where s.id = a.actor_id) as actor
         from public.activity_log a order by a.occurred_at desc limit 8`,
    );
    return { stats, tasks, inquiries, activity };
  });
  const s = data.stats;
  const firstName = viewer.displayName.split(" ")[0];

  return (
    <div>
      <PageHeader
        title={`Good day, ${firstName}`}
        description={
          viewer.isAdmin
            ? "You can see every customer and deal. Customers assigned to you appear under “Mine”."
            : `You are working with ${s.customers} assigned customer${s.customers === 1 ? "" : "s"}.`
        }
      />
      {sp.error === "admin_only" && <Alert tone="warn" className="mb-5">That area is available to the owner/admin only.</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Inquiries needing a reply" value={s.needs_reply} hint={`${s.new_inquiries} new`} href="/admin/inquiries?tab=needs_reply" tone={s.needs_reply ? "brand" : undefined} />
        <Stat label="My follow-ups due" value={s.tasks_due} hint={s.tasks_overdue ? `${s.tasks_overdue} overdue` : "Today and tomorrow"} href="/admin/tasks" tone={s.tasks_overdue ? "danger" : undefined} />
        <Stat label="Active reservations" value={s.reservations} hint={s.expiring ? `${s.expiring} expire within 48 h` : "None expiring soon"} href="/admin/reservations" tone={s.expiring ? "warn" : undefined} />
        <Stat label="Awaiting payment" value={s.awaiting_payment} hint={`${formatUsd(s.outstanding)} outstanding`} href="/admin/sales?status=open" />
        {viewer.isAdmin && <Stat label="Unassigned customers" value={s.unassigned} hint="Assign to a salesperson" href="/admin/customers?assigned=none" tone={s.unassigned ? "warn" : undefined} />}
        {viewer.isAdmin && <Stat label="Payments to verify" value={s.to_verify} hint="Recorded by sales" href="/admin/sales?payments=to_verify" tone={s.to_verify ? "warn" : undefined} />}
        <Stat label="Shipments under way" value={s.in_transit} href="/admin/shipping" />
        <Stat label="Published vehicles" value={s.published} hint={`${s.drafts} drafts`} href="/admin/vehicles" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="My follow-ups" actions={<Link href="/admin/tasks" className="text-sm font-semibold text-brand hover:underline">All tasks</Link>} bodyClassName="p-0">
          {data.tasks.length === 0 ? (
            <p className="p-5 text-sm text-muted">No open follow-ups. Nice work.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.tasks.map((task) => {
                const overdue = isPast(task.due_at);
                return (
                  <li key={task.id} className="flex items-center gap-3 px-5 py-3">
                    <ActionForm action={completeTask}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <SubmitButton variant="secondary" size="sm" pendingLabel="…">Done</SubmitButton>
                    </ActionForm>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{task.title}</p>
                      <p className="text-xs text-muted">
                        {task.customer_name && (
                          <Link href={`/admin/customers/${task.customer_id}`} className="hover:underline">{task.customer_name}</Link>
                        )}
                        {task.inquiry_id && (
                          <>
                            {" · "}
                            <Link href={`/admin/inquiries/${task.inquiry_id}`} className="hover:underline">conversation</Link>
                          </>
                        )}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${overdue ? "text-danger" : "text-muted"}`}>
                      {overdue ? <AlertTriangle className="size-3.5" aria-hidden /> : <Clock className="size-3.5" aria-hidden />}
                      {formatRelative(task.due_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Latest conversations" actions={<Link href="/admin/inquiries" className="text-sm font-semibold text-brand hover:underline">Inbox</Link>} bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {data.inquiries.map((i) => (
              <li key={i.id}>
                <Link href={`/admin/inquiries/${i.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-page/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {i.last_sender === "customer" && <span className="me-2 inline-block size-2 rounded-full bg-brand align-middle" title="Awaiting reply" />}
                      {i.customer_name} <span className="font-normal text-muted">— {i.subject}</span>
                    </p>
                    <p className="text-xs text-muted">{i.ref_no} · {i.assigned ?? <span className="font-semibold text-warn">Unassigned</span>}</p>
                  </div>
                  <StatusBadge status={i.status} label={t.status.inquiry[i.status as keyof typeof t.status.inquiry]} />
                  <span className="hidden text-xs text-muted sm:block">{formatRelative(i.last_message_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Recent activity" className="mt-6" actions={<Link href="/admin/activity" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">Activity log <ArrowRight className="size-4" /></Link>} bodyClassName="p-0">
        <ul className="divide-y divide-line">
          {data.activity.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
              <span className="w-40 shrink-0 text-xs text-muted">{formatDateTime(a.occurred_at)}</span>
              <span className="font-medium">{a.actor ?? "System"}</span>
              <span className="min-w-0 flex-1 text-muted">{a.summary ?? `${a.action} ${a.entity_type.replace(/_/g, " ")}`}</span>
            </li>
          ))}
        </ul>
      </Panel>

      {isDemoMode && viewer.isAdmin && (
        <Panel title="Demo data" className="mt-6">
          <p className="text-sm text-muted">Restore the original sample customers, vehicles and deals. Everything created while testing will be removed.</p>
          <ActionForm action={resetDemoData} confirm="Reset all demo data? Changes made while testing will be lost." className="mt-3">
            <SubmitButton variant="secondary" pendingLabel="Resetting…">Reset demo data</SubmitButton>
          </ActionForm>
        </Panel>
      )}
    </div>
  );
}
