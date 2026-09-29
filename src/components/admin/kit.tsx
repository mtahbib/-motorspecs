import clsx from "clsx";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  meta?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
          {meta && <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">{meta}</div>}
          {description && <p className="mt-1 max-w-3xl text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={clsx("card overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
          {title && <h2 className="font-display text-lg font-bold">{title}</h2>}
          {actions}
        </header>
      )}
      <div className={clsx("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("card overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={clsx("border-b border-line bg-page/70 px-4 py-2.5 text-start text-xs font-semibold tracking-wide text-muted uppercase", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx("border-b border-line px-4 py-3 align-top", className)}>{children}</td>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-muted">
        {children}
      </td>
    </tr>
  );
}

/** Link-based tabs (server rendered; state lives in the URL). */
export function Tabs({ items, current }: { items: { key: string; label: ReactNode; href: string; count?: number }[]; current: string }) {
  return (
    <nav className="scrollbar-none mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === current ? "page" : undefined}
          className={clsx(
            "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold",
            item.key === current ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className={clsx("num rounded-full px-1.5 text-xs", item.key === current ? "bg-brand text-white" : "bg-page text-muted")}>{item.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function Stat({ label, value, hint, href, tone }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; tone?: "warn" | "brand" | "danger" }) {
  const body = (
    <>
      <span className="label-caps">{label}</span>
      <span className={clsx("num font-display text-4xl font-bold", tone === "warn" && "text-warn", tone === "brand" && "text-brand", tone === "danger" && "text-danger")}>{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </>
  );
  return href ? (
    <Link href={href} className="card flex flex-col gap-1 p-5 transition-shadow hover:shadow-[var(--shadow-lift)]">
      {body}
    </Link>
  ) : (
    <div className="card flex flex-col gap-1 p-5">{body}</div>
  );
}

export function Label({ children, htmlFor, optional }: { children: ReactNode; htmlFor?: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
      {children}
      {optional && <span className="ms-1 text-xs font-normal text-subtle">(optional)</span>}
    </label>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-muted">{children}</p>;
}
