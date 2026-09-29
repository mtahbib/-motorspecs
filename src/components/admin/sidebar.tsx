"use client";

import clsx from "clsx";
import {
  Activity, CalendarClock, CarFront, ChartColumn, ClipboardList, FileText, Handshake, Inbox, LayoutDashboard, Menu, Receipt,
  Ship, ShieldCheck, Tag, Users, UserCog, X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

const icons = {
  dashboard: LayoutDashboard, inbox: Inbox, customers: Users, offers: Tag, tasks: CalendarClock, reservations: Handshake,
  sales: Receipt, shipping: Ship, documents: FileText, vehicles: CarFront, staff: UserCog, activity: Activity,
  reports: ChartColumn, security: ShieldCheck, clipboard: ClipboardList,
};

export type SidebarItem = { key: keyof typeof icons; href: string; label: string; badge?: number };
export type SidebarGroup = { label: string; items: SidebarItem[] };

export function AdminSidebar({ groups, footer }: { groups: SidebarGroup[]; footer: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const nav = (
    <nav className="flex flex-col gap-5" aria-label="Workspace">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[0.68rem] font-semibold tracking-widest text-white/35 uppercase">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = icons[item.key];
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-brand text-white" : "text-white/70 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    {!!item.badge && (
                      <span className={clsx("num rounded-full px-1.5 text-xs font-bold", active ? "bg-white/25" : "bg-brand text-white")}>{item.badge}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between bg-graphite px-4 lg:hidden">
        <Link href="/admin" aria-label="Dashboard">
          <Image src="/brand/motorspecs-logo-light.png" alt="MotorSpecs" width={1080} height={240} className="h-7 w-auto" />
        </Link>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Menu" className="grid size-10 place-items-center rounded-lg text-white hover:bg-white/10">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && <div className="fixed inset-0 z-40 bg-ink/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside
        className={clsx(
          "fixed inset-y-0 start-0 z-50 flex w-64 flex-col bg-graphite transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link href="/admin" className="flex h-16 shrink-0 items-center px-5" aria-label="Dashboard">
          <Image src="/brand/motorspecs-logo-light.png" alt="MotorSpecs" width={1080} height={240} className="h-7 w-auto" />
        </Link>
        <div className="scrollbar-none flex-1 overflow-y-auto px-3 pb-4">{nav}</div>
        <div className="border-t border-white/10 p-3">{footer}</div>
      </aside>
    </>
  );
}
