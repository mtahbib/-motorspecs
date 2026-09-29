"use client";

import clsx from "clsx";
import { Globe } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { localeNames, locales, type Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({ locale, label, tone = "dark" }: { locale: Locale; label: string; tone?: "dark" | "light" }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const rest = pathname.split("/").slice(2).join("/");
  const query = search.toString();

  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <Globe className={clsx("size-4", tone === "dark" ? "text-white/60" : "text-muted")} aria-hidden />
      {locales.map((l) => (
        <Link
          key={l}
          href={`/${l}${rest ? `/${rest}` : ""}${query ? `?${query}` : ""}`}
          hrefLang={l}
          lang={l}
          aria-current={l === locale ? "true" : undefined}
          className={clsx(
            "rounded-md px-2 py-1 text-sm font-medium transition-colors",
            tone === "dark"
              ? l === locale
                ? "bg-white/12 text-white"
                : "text-white/65 hover:text-white"
              : l === locale
                ? "bg-ink text-white"
                : "text-muted hover:text-ink",
          )}
        >
          {localeNames[l]}
        </Link>
      ))}
    </div>
  );
}
