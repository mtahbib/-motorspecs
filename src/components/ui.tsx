import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover shadow-sm",
  secondary: "bg-white text-ink border border-line-strong hover:border-ink/40 hover:bg-page",
  ghost: "text-ink hover:bg-ink/5",
  danger: "bg-danger text-white hover:bg-danger/90",
  dark: "bg-ink text-white hover:bg-graphite-3",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-10 px-4 text-[0.95rem] gap-2 rounded-[10px]",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return clsx(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

type Tone = "neutral" | "brand" | "ok" | "warn" | "danger" | "info" | "dark";

const tones: Record<Tone, string> = {
  neutral: "bg-page text-muted border-line",
  brand: "bg-brand-soft text-brand-ink border-brand/20",
  ok: "bg-ok-soft text-ok border-ok/20",
  warn: "bg-warn-soft text-warn border-warn/25",
  danger: "bg-danger-soft text-danger border-danger/20",
  info: "bg-info-soft text-[#1c4f8f] border-[#1c4f8f]/15",
  dark: "bg-ink text-white border-ink",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Colour mapping for every status value used across the app. */
const statusTones: Record<string, Tone> = {
  // vehicles
  published: "ok", reserved: "warn", sold: "dark", draft: "neutral", archived: "neutral",
  // inquiries
  new: "brand", open: "info", quoted: "info", negotiating: "warn", won: "ok", lost: "neutral", closed: "neutral",
  // offers
  pending: "warn", accepted: "ok", declined: "danger", withdrawn: "neutral", expired: "neutral", superseded: "neutral",
  // reservations
  active: "warn", released: "neutral", converted: "ok",
  // sales
  awaiting_payment: "warn", partially_paid: "warn", paid: "ok", shipping: "info", delivered: "ok", completed: "ok", cancelled: "danger",
  // payments
  recorded: "warn", verified: "ok", void: "danger",
  // shipments
  awaiting_booking: "neutral", booked: "info", at_port: "info", in_transit: "brand", arrived: "ok",
  // customers
  lead: "brand", inactive: "neutral", merged: "neutral", unverified: "neutral", rejected: "danger",
  // tasks
  done: "ok",
};

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  return (
    <Badge tone={statusTones[status] ?? "neutral"} className={className}>
      {label ?? status.replace(/_/g, " ")}
    </Badge>
  );
}

export function DemoBadge({ label = "Demo" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded border border-dashed border-warn/50 bg-warn-soft px-1.5 text-[0.65rem] font-bold tracking-wider text-warn uppercase">
      {label}
    </span>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "ok" | "warn" | "danger";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const styles = {
    info: "bg-info-soft border-[#1c4f8f]/15 text-[#173f72]",
    ok: "bg-ok-soft border-ok/20 text-[#0b6440]",
    warn: "bg-warn-soft border-warn/25 text-[#8a4700]",
    danger: "bg-danger-soft border-danger/20 text-[#9a1f1f]",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={clsx("rounded-xl border px-4 py-3 text-sm", styles, className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={clsx(title && "mt-0.5")}>{children}</div>}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
        {optional && <span className="ms-1.5 text-xs font-normal text-subtle">({optional})</span>}
      </label>
      {children}
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-white/60 px-6 py-14 text-center">
      {icon && <div className="mb-3 text-subtle">{icon}</div>}
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: ReactNode; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="label-caps mb-1 text-brand">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function KeyValue({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={clsx("grid grid-cols-1 sm:grid-cols-2", className)}>
      {items.map((item, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0 sm:odd:pe-5 sm:even:ps-5">
          <dt className="text-muted">{item.label}</dt>
          <dd className="num text-end font-semibold text-ink">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
