import clsx from "clsx";
import { Check } from "lucide-react";

export const SHIPMENT_STEPS = ["awaiting_booking", "booked", "at_port", "in_transit", "arrived", "released"] as const;

/** Horizontal stepper for the shipping stages (wraps to a list on small screens). */
export function ShipmentProgress({ status, labels }: { status: string; labels: Record<string, string> }) {
  const current = SHIPMENT_STEPS.indexOf(status as (typeof SHIPMENT_STEPS)[number]);
  return (
    <ol className="grid grid-cols-3 gap-y-4 sm:grid-cols-6">
      {SHIPMENT_STEPS.map((step, i) => {
        const done = i < current || (i === current && step === "released");
        const active = i === current && step !== "released";
        return (
          <li key={step} className="relative flex flex-col items-center gap-1.5 text-center">
            {i > 0 && (
              <span aria-hidden className={clsx("absolute top-3.5 end-1/2 h-0.5 w-full -z-0", i <= current ? "bg-brand" : "bg-line")} />
            )}
            <span
              className={clsx(
                "relative z-10 grid size-7 place-items-center rounded-full border-2 text-xs font-bold",
                done && "border-brand bg-brand text-white",
                active && "border-brand bg-white text-brand ring-4 ring-brand/15",
                !done && !active && "border-line-strong bg-white text-subtle",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={clsx("px-1 text-[0.72rem] leading-tight", active || done ? "font-semibold text-ink" : "text-muted")}>{labels[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}
