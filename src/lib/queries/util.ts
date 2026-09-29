/** Serialises a list of simple ids/codes as a Postgres array literal (works with every driver). */
export function pgArray(values: string[]): string {
  return `{${values.map((v) => `"${v.replace(/["\\]/g, "")}"`).join(",")}}`;
}
