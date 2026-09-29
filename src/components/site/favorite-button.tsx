"use client";

import clsx from "clsx";
import { Heart } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toggleFavorite } from "@/app/actions/customer";

export function FavoriteButton({
  vehicleId,
  locale,
  initial,
  back,
  labels,
}: {
  vehicleId: string;
  locale: string;
  initial: boolean;
  back: string;
  labels: { add: string; saved: string };
}) {
  const [saved, setSaved] = useOptimistic(initial);
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          setSaved(!saved);
          await toggleFavorite(fd);
        })
      }
    >
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="back" value={back} />
      <button
        aria-pressed={saved}
        disabled={pending}
        className={clsx(
          "inline-flex h-10 items-center gap-2 rounded-[10px] border px-4 text-sm font-semibold transition-colors",
          saved ? "border-danger/30 bg-danger-soft text-danger" : "border-line-strong bg-white text-ink hover:border-ink/40",
        )}
      >
        <Heart className={clsx("size-4", saved && "fill-current")} aria-hidden />
        {saved ? labels.saved : labels.add}
      </button>
    </form>
  );
}
