import type { ReactNode } from "react";

export function PortalHeader({ title, intro, action }: { title: string; intro?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        {intro && <p className="mt-1 max-w-2xl text-muted">{intro}</p>}
      </div>
      {action}
    </div>
  );
}
