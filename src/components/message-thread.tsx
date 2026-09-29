import clsx from "clsx";
import { Info } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

export type ThreadMessage = {
  id: string;
  sender_role: "customer" | "admin" | "sales" | "system";
  sender_name: string | null;
  body: string;
  created_at: string;
};

/**
 * Chat-style conversation. `perspective` decides which side is "mine":
 * customers see their own messages on the end side, staff see staff messages there.
 */
export function MessageThread({
  messages,
  perspective,
  locale,
  labels,
}: {
  messages: ThreadMessage[];
  perspective: "customer" | "staff";
  locale: Locale;
  labels: { you: string; them: string; system: string };
}) {
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) => {
        if (m.sender_role === "system") {
          return (
            <li key={m.id} className="mx-auto flex max-w-md items-start gap-2 rounded-xl bg-info-soft px-3 py-2 text-xs text-[#173f72]">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                <span className="font-semibold">{labels.system}: </span>
                {m.body}
                <span className="ms-2 text-[#173f72]/60">{formatDateTime(m.created_at, locale)}</span>
              </span>
            </li>
          );
        }
        const fromCustomer = m.sender_role === "customer";
        const mine = perspective === "customer" ? fromCustomer : !fromCustomer;
        const name = fromCustomer ? (perspective === "customer" ? labels.you : m.sender_name ?? labels.them) : m.sender_name ?? labels.them;
        return (
          <li key={m.id} className={clsx("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
            <span className="px-1 text-xs text-muted">
              <span className="font-semibold text-ink">{name}</span> · {formatDateTime(m.created_at, locale)}
            </span>
            <p
              dir="auto"
              className={clsx(
                "max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed",
                mine ? "rounded-ee-md bg-brand text-white" : "rounded-es-md border border-line bg-white text-ink",
              )}
            >
              {m.body}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
