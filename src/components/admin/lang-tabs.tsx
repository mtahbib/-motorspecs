"use client";

import clsx from "clsx";
import { useState, type ReactNode } from "react";

/** Tabs that keep every panel mounted (so all languages submit with the form). */
export function LangTabs({ tabs }: { tabs: { key: string; label: ReactNode; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl bg-page p-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={clsx("flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold", active === t.key ? "bg-white shadow-sm" : "text-muted hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" hidden={active !== t.key}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
