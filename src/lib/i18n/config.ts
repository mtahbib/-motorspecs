export const locales = ["en", "ja", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  ja: "日本語",
  ar: "العربية",
};

export const rtlLocales: Locale[] = ["ar"];

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return rtlLocales.includes(locale) ? "rtl" : "ltr";
}

/** Intl locale tags. Arabic keeps Latin digits for prices, VINs and specs. */
export const intlLocale: Record<Locale, string> = {
  en: "en-US",
  ja: "ja-JP",
  ar: "ar-u-nu-latn",
};

export const LOCALE_COOKIE = "ms_locale";
