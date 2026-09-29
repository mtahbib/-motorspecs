"use client";

import clsx from "clsx";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Filters are always visible on desktop and collapsible on small screens. */
export function CollapsibleFilters({ label, activeCount, children }: { label: string; activeCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 font-semibold lg:pointer-events-none lg:px-5 lg:pt-5 lg:pb-1"
      >
        <span className="inline-flex items-center gap-2 lg:label-caps">
          <SlidersHorizontal className="size-4" aria-hidden /> {label}
          {activeCount > 0 && <span className="num rounded-full bg-brand px-2 text-xs text-white">{activeCount}</span>}
        </span>
        <ChevronDown className={clsx("size-4 transition-transform lg:hidden", open && "rotate-180")} aria-hidden />
      </button>
      <div className={clsx("border-t border-line p-4 lg:block lg:border-0 lg:p-5 lg:pt-3", open ? "block" : "hidden")}>{children}</div>
    </div>
  );
}
