import ar from "./dictionaries/ar";
import en, { type Dictionary } from "./dictionaries/en";
import ja from "./dictionaries/ja";
import type { Locale } from "./config";

const dictionaries: Record<Locale, Dictionary> = { en, ja, ar };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}

/** Replaces {placeholders} in a dictionary string. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

export type { Dictionary, Locale };
export * from "./config";
