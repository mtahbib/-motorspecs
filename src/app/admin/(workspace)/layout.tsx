import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { AdminSidebar, type SidebarGroup } from "@/components/admin/sidebar";
import { Toaster } from "@/components/admin/toaster";
import { requireStaff, withDb } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import { initials } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";

export default async function WorkspaceLayout({ children }: LayoutProps<"/admin">) {
  const viewer = await requireStaff();
  const t = adminT;

  // Badge counts (RLS scopes them to what this staff member can see).
  const counts = await withDb(async (tx) => {
    const [row] = await tx.query<{ needs_reply: number; tasks_due: number; to_verify: number; unassigned: number }>(
      `select
         (select count(*)::int from public.inquiries i
           where i.status not in ('won', 'lost', 'closed')
             and (select m.sender_role from public.messages m where m.inquiry_id = i.id order by m.created_at desc limit 1) = 'customer') as needs_reply,
         (select count(*)::int from public.tasks where status = 'open' and assigned_to = auth.uid() and due_at < now() + interval '1 day') as tasks_due,
         (select count(*)::int from public.payments where status = 'recorded') as to_verify,
         (select count(*)::int from public.customers where assigned_staff_id is null and status in ('lead', 'active')) as unassigned`,
    );
    return row;
  });

  const groups: SidebarGroup[] = [
    {
      label: t.nav.groups.work,
      items: [
        { key: "dashboard", href: "/admin", label: t.nav.dashboard },
        { key: "inbox", href: "/admin/inquiries", label: t.nav.inbox, badge: counts.needs_reply },
        { key: "customers", href: "/admin/customers", label: t.nav.customers, badge: viewer.isAdmin ? counts.unassigned : undefined },
        { key: "tasks", href: "/admin/tasks", label: t.nav.tasks, badge: counts.tasks_due },
      ],
    },
    {
      label: t.nav.groups.deals,
      items: [
        { key: "offers", href: "/admin/offers", label: t.nav.offers },
        { key: "reservations", href: "/admin/reservations", label: t.nav.reservations },
        { key: "sales", href: "/admin/sales", label: t.nav.sales, badge: viewer.isAdmin ? counts.to_verify : undefined },
        { key: "shipping", href: "/admin/shipping", label: t.nav.shipping },
        { key: "documents", href: "/admin/documents", label: t.nav.documents },
      ],
    },
    { label: t.nav.groups.inventory, items: [{ key: "vehicles", href: "/admin/vehicles", label: t.nav.vehicles }] },
    {
      label: t.nav.groups.admin,
      items: [
        ...(viewer.isAdmin
          ? ([
              { key: "staff", href: "/admin/staff", label: t.nav.staff },
              { key: "reports", href: "/admin/reports", label: t.nav.reports },
            ] as const)
          : []),
        { key: "activity", href: "/admin/activity", label: t.nav.activity },
        { key: "security", href: "/admin/security", label: t.nav.security },
      ],
    },
  ];

  return (
    <div className="lg:flex">
      <AdminSidebar
        groups={groups}
        footer={
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{initials(viewer.displayName)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{viewer.displayName}</p>
              <p className="text-xs text-white/50">{t.roles[viewer.role]}</p>
            </div>
            <Link href="/en" className="grid size-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white" title={t.nav.viewSite} aria-label={t.nav.viewSite}>
              <ExternalLink className="size-4" />
            </Link>
            <form action={signOut}>
              <input type="hidden" name="next" value="/admin/login" />
              <button className="grid size-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white" title={t.nav.signOut} aria-label={t.nav.signOut}>
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        }
      />
      <div className="min-w-0 flex-1">
        {isDemoMode && (
          <div className="border-b border-warn/30 bg-warn-soft px-4 py-1.5 text-center text-xs font-medium text-[#8a4700] sm:px-8">
            Demo mode — fictional sample data stored in a local embedded database. Payment details are placeholders.
          </div>
        )}
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
        <Toaster />
      </div>
    </div>
  );
}
