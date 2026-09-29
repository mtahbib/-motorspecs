import { completeTask, createTask } from "@/app/admin/actions/tasks";
import { isPast, defaultFollowUpJst } from "@/lib/time";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { Label, Panel } from "@/components/admin/kit";
import { StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { StaffOption } from "@/lib/queries/admin";

export type TaskRow = { id: string; title: string; due_at: string; status: string; priority: string; assignee: string | null; assigned_to: string };

export function TasksPanel({
  tasks,
  customerId,
  inquiryId,
  staff,
  canAssign,
  viewerId,
}: {
  tasks: TaskRow[];
  customerId: string;
  inquiryId?: string;
  staff: StaffOption[];
  canAssign: boolean;
  viewerId: string;
}) {
  const open = tasks.filter((t) => t.status === "open");
  return (
    <Panel title="Follow-ups" bodyClassName="p-0">
      {open.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">No open follow-ups.</p>
      ) : (
        <ul className="divide-y divide-line">
          {open.map((t) => {
            const overdue = isPast(t.due_at);
            return (
              <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.title}</p>
                  <p className={`text-xs ${overdue ? "font-semibold text-danger" : "text-muted"}`}>
                    {formatDateTime(t.due_at)} · {t.assignee ?? "—"} {t.priority === "high" && <StatusBadge status="pending" label="High" className="ms-1" />}
                  </p>
                </div>
                {(canAssign || t.assigned_to === viewerId) && (
                  <ActionForm action={completeTask}>
                    <input type="hidden" name="taskId" value={t.id} />
                    <SubmitButton variant="secondary" size="sm" pendingLabel="…">Done</SubmitButton>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <details className="border-t border-line">
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-brand">Schedule a follow-up</summary>
        <ActionForm action={createTask} resetOnSuccess className="grid gap-3 px-5 pb-5">
          <input type="hidden" name="customerId" value={customerId} />
          {inquiryId && <input type="hidden" name="inquiryId" value={inquiryId} />}
          <div>
            <Label htmlFor={`task-title-${inquiryId ?? customerId}`}>What needs doing?</Label>
            <input id={`task-title-${inquiryId ?? customerId}`} name="title" required maxLength={200} className="input" placeholder="e.g. Call about deposit" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`task-due-${inquiryId ?? customerId}`}>Due (Japan time)</Label>
              <input id={`task-due-${inquiryId ?? customerId}`} name="dueAt" type="datetime-local" required defaultValue={defaultFollowUpJst()} className="input" />
            </div>
            <div>
              <Label htmlFor={`task-priority-${inquiryId ?? customerId}`}>Priority</Label>
              <select id={`task-priority-${inquiryId ?? customerId}`} name="priority" defaultValue="normal" className="input">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          {canAssign && (
            <div>
              <Label htmlFor={`task-assignee-${inquiryId ?? customerId}`}>Assign to</Label>
              <select id={`task-assignee-${inquiryId ?? customerId}`} name="assignedTo" defaultValue={viewerId} className="input">
                {staff.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <SubmitButton pendingLabel="Saving…">Add follow-up</SubmitButton>
          </div>
        </ActionForm>
      </details>
    </Panel>
  );
}
