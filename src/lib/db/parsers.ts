/**
 * Shared result parsing so both drivers return identical JS values:
 *   timestamptz -> ISO-8601 string, date -> "YYYY-MM-DD", numeric/int8 -> number.
 * Strings keep values serialisable across the server/client boundary.
 */
export const PG_TYPES = {
  INT8: 20,
  NUMERIC: 1700,
  DATE: 1082,
  TIMESTAMP: 1114,
  TIMESTAMPTZ: 1184,
} as const;

export function timestampToIso(value: string): string {
  // Postgres text format: "2026-09-29 15:39:48.222+00" (TimeZone = UTC)
  const normalised = value.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00");
  const d = new Date(normalised);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

export const toNumber = (value: string) => Number(value);
export const identity = (value: string) => value;
