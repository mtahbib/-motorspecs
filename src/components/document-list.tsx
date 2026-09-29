import { Download, FileText } from "lucide-react";
import { formatBytes, formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

export function DocumentList({
  documents,
  locale,
  kindLabels,
  downloadLabel,
  emptyLabel,
}: {
  documents: { id: string; kind: string; title: string; size_bytes: number; created_at: string }[];
  locale: Locale;
  kindLabels: Record<string, string>;
  downloadLabel: string;
  emptyLabel: string;
}) {
  if (!documents.length) return <p className="text-sm text-muted">{emptyLabel}</p>;
  return (
    <ul className="divide-y divide-line">
      {documents.map((d) => (
        <li key={d.id} className="flex items-center gap-3 py-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            <FileText className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{d.title}</p>
            <p className="text-xs text-muted">
              {kindLabels[d.kind] ?? d.kind} · {formatDate(d.created_at, locale)} · <span className="num">{formatBytes(d.size_bytes)}</span>
            </p>
          </div>
          <a href={`/api/files/documents/${d.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft">
            <Download className="size-4" aria-hidden /> <span className="hidden sm:inline">{downloadLabel}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
