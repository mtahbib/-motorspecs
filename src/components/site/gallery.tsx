"use client";

import clsx from "clsx";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

export function Gallery({ photos, title, photoOfLabel }: { photos: { url: string; caption: string | null }[]; title: string; photoOfLabel: string }) {
  const [index, setIndex] = useState(0);
  if (!photos.length) {
    return (
      <div className="grid aspect-[16/10] place-items-center rounded-[var(--radius-card)] bg-page text-subtle">
        <Camera className="size-10" />
      </div>
    );
  }
  const current = photos[index];
  const go = (delta: number) => setIndex((i) => (i + delta + photos.length) % photos.length);
  const label = photoOfLabel.replace("{n}", String(index + 1)).replace("{total}", String(photos.length));

  return (
    <div>
      <div
        className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-card)] bg-page"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={`${title} — ${label}`} className="size-full object-cover" />
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute start-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow hover:bg-white">
              <ChevronLeft className="size-5 rtl:-scale-x-100" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute end-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow hover:bg-white">
              <ChevronRight className="size-5 rtl:-scale-x-100" />
            </button>
          </>
        )}
        <span className="num absolute top-3 end-3 rounded-md bg-ink/75 px-2 py-0.5 text-xs font-medium text-white" aria-live="polite">
          {label}
        </span>
      </div>
      {photos.length > 1 && (
        <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto">
          {photos.map((p, i) => (
            <button
              key={p.url}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={photoOfLabel.replace("{n}", String(i + 1)).replace("{total}", String(photos.length))}
              aria-current={i === index}
              className={clsx("aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-lg border-2 transition", i === index ? "border-brand" : "border-transparent opacity-70 hover:opacity-100")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
