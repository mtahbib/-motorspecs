import { intlLocale, type Locale } from "./i18n/config";

export function formatUsd(amount: number | null | undefined, locale: Locale = "en", fractionDigits = 0): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat(intlLocale[locale], {
    style: "currency",
    currency: "USD",
    currencyDisplay: "code",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  })
    .format(amount)
    .replace(/ /g, " ");
}

export function formatNumber(value: number | null | undefined, locale: Locale = "en", maxFraction = 0): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(intlLocale[locale], { maximumFractionDigits: maxFraction }).format(value);
}

export function formatDate(iso: string | null | undefined, locale: Locale = "en"): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return new Intl.DateTimeFormat(intlLocale[locale], { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

export function formatDateTime(iso: string | null | undefined, locale: Locale = "en"): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(intlLocale[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function formatRelative(iso: string | null | undefined, locale: Locale = "en", now = Date.now()): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(intlLocale[locale], { numeric: "auto" });
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return formatDate(iso, locale);
}

export function formatYearMonth(year: number | null, month: number | null, locale: Locale = "en"): string {
  if (!year) return "—";
  if (!month) return String(year);
  return new Intl.DateTimeFormat(intlLocale[locale], { year: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function countryName(code: string | null | undefined, locale: Locale = "en"): string {
  if (!code) return "—";
  try {
    return new Intl.DisplayNames([intlLocale[locale].split("-u-")[0]], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Common export destinations first, then the rest alphabetically by code. */
export const COUNTRY_CODES = [
  "AE", "AU", "BD", "BS", "BW", "CA", "CL", "CY", "DO", "FJ", "GB", "GH", "GY", "IE", "JM", "JP", "KE", "LK", "MN", "MT",
  "MU", "MW", "MY", "MZ", "NA", "NG", "NZ", "OM", "PG", "PH", "PK", "QA", "RU", "SA", "SG", "TH", "TT", "TZ", "UG", "US",
  "ZA", "ZM", "ZW",
];

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .replace(/\(.*\)/, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
