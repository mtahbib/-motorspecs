"use client";

import clsx from "clsx";
import { BadgeCheck, CarFront, Handshake, Heart, LayoutGrid, MessageSquare, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const icons = { overview: LayoutGrid, profile: UserRound, account: BadgeCheck, favorites: Heart, inquiries: MessageSquare, reserved: Handshake, purchased: CarFront };

export function PortalNav({ locale, items }: { locale: string; items: { key: keyof typeof icons; label: string; badge?: number }[] }) {
  const pathname = usePathname();
  const base = `/${locale}/account`;
  return (
    <nav aria-label="Account" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
      {items.map(({ key, label, badge }) => {
        const href = key === "overview" ? base : `${base}/${key}`;
        const active = key === "overview" ? pathname === base : pathname.startsWith(href);
        const Icon = icons[key];
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-ink text-white" : "text-muted hover:bg-white hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="flex-1">{label}</span>
            {!!badge && <span className={clsx("num rounded-full px-1.5 text-xs font-semibold", active ? "bg-white/20" : "bg-brand text-white")}>{badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
