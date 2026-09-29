import Link from "next/link";
import { isPast } from "@/lib/time";
import { cancelTask, completeTask, createTask } from "@/app/admin/actions/tasks";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { EmptyRow, Label, PageHeader, Panel, Table, Tabs, Td, Th } from "@/components/admin/kit";
import { StatusBadge } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { formatDateTime, formatRelative } from "@/lib/format";
import { listStaffOptions } from "@/lib/queries/admin";

export const metadata = { title: "Follow-ups" };

export default async function TasksPage({ searchParams }: PageProps<"/admin/tasks">) {
  const viewer = await requireStaff();
  const sp = await searchParams;
  const tab = ["mine", "team", "done"].includes(String(sp.tab)) ? String(sp.tab) : "mine";
  const where = { mine: "t.status = 'open' and t.assigned_to = auth.uid()", team: "t.status = 'open'", done: "t.status <> 'open'" }[tab];

  const { tasks, staff, customers } = await withDb(async (tx) => ({
    tasks: await tx.query<{
      id: string; title: string; notes: string | null; due_at: string; priority: string; status: string; completed_at: string | null;
      assigned_to: string; assignee: string | null; customer_id: string | null; customer_name: string | null; inquiry_id: string | null; inquiry_ref: string | null;
    }>(
      `select t.id, t.title, t.notes, t.due_at, t.priority, t.status, t.completed_at, t.assigned_to, t.customer_id, t.inquiry_id,
              (select display_name from public.profiles where id = t.assigned_to) as assignee,
              (select full_name from public.customers where id = t.customer_id) as customer_name,
              (select ref_no from public.inquiries where id = t.inquiry_id) as inquiry_ref
         from public.tasks t where ${where}
        order by ${tab === "done" ? "coalesce(t.completed_at, t.updated_at) desc" : "t.due_at"} limit 200`,
    ),
    staff: await listStaffOptions(tx),
    customers: await tx.query<{ id: string; full_name: string; customer_code: string }>(
      "select id, full_name, customer_code from public.customers where status in ('lead', 'active') order by full_name limit 500",
    ),
  }));

  return (
    <div>
      <PageHeader title="Follow-ups" description="Reminders to call, chase or quote. Due times are Japan time." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <Tabs
            current={tab}
            items={[
              { key: "mine", label: "My open follow-ups", href: "/admin/tasks?tab=mine" },
              { key: "team", label: viewer.isAdmin ? "Everyone's open" : "Open on my customers", href: "/admin/tasks?tab=team" },
              { key: "done", label: "Completed", href: "/admin/tasks?tab=done" },
            ]}
          />
          <Table>
            <thead><tr><Th>Follow-up</Th><Th>Customer</Th><Th>Due</Th><Th>Owner</Th><Th /></tr></thead>
            <tbody>
              {tasks.length === 0 && <EmptyRow colSpan={5}>Nothing to follow up.</EmptyRow>}
              {tasks.map((task) => {
                const overdue = task.status === "open" && isPast(task.due_at);
                const canAct = task.status === "open" && (viewer.isAdmin || task.assigned_to === viewer.user.id);
                return (
                  <tr key={task.id} className="hover:bg-page/50">
                    <Td>
                      <p className="font-medium">{task.title} {task.priority === "high" && <StatusBadge status="pending" label="High" />}</p>
                      {task.notes && <p className="text-xs text-muted">{task.notes}</p>}
                      {task.inquiry_id && <Link href={`/admin/inquiries/${task.inquiry_id}`} className="num text-xs text-brand hover:underline">{task.inquiry_ref}</Link>}
                    </Td>
                    <Td>{task.customer_id ? <Link href={`/admin/customers/${task.customer_id}`} className="hover:text-brand">{task.customer_name}</Link> : "—"}</Td>
                    <Td className={overdue ? "font-semibold text-danger" : ""}>
                      {formatDateTime(task.due_at)}
                      <p className="text-xs font-normal text-muted">{task.status === "open" ? formatRelative(task.due_at) : <StatusBadge status={task.status} />}</p>
                    </Td>
                    <Td>{task.assignee}</Td>
                    <Td>
                      {canAct && (
                        <div className="flex gap-1">
                          <ActionForm action={completeTask}><input type="hidden" name="taskId" value={task.id} /><SubmitButton size="sm" variant="secondary" pendingLabel="…">Done</SubmitButton></ActionForm>
                          <ActionForm action={cancelTask}><input type="hidden" name="taskId" value={task.id} /><SubmitButton size="sm" variant="ghost" pendingLabel="…">Cancel</SubmitButton></ActionForm>
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        <Panel title="New follow-up" className="h-fit">
          <ActionForm action={createTask} resetOnSuccess className="flex flex-col gap-3">
            <div><Label htmlFor="nt-title">Title</Label><input id="nt-title" name="title" required maxLength={200} className="input" /></div>
            <div>
              <Label htmlFor="nt-customer" optional>Customer</Label>
              <select id="nt-customer" name="customerId" className="input" defaultValue="">
                <option value="">—</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name} ({c.customer_code})</option>)}
              </select>
            </div>
            <div><Label htmlFor="nt-due">Due (Japan time)</Label><input id="nt-due" name="dueAt" type="datetime-local" required className="input" /></div>
            <div>
              <Label htmlFor="nt-priority">Priority</Label>
              <select id="nt-priority" name="priority" defaultValue="normal" className="input"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select>
            </div>
            {viewer.isAdmin && (
              <div>
                <Label htmlFor="nt-assignee">Assign to</Label>
                <select id="nt-assignee" name="assignedTo" defaultValue={viewer.user.id} className="input">
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                </select>
              </div>
            )}
            <div><Label htmlFor="nt-notes" optional>Notes</Label><textarea id="nt-notes" name="notes" rows={2} maxLength={2000} className="input" /></div>
            <SubmitButton pendingLabel="Saving…">Add follow-up</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </div>
  );
}
