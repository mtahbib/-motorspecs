/** Time helpers kept out of component bodies (render functions must stay pure). */
export function isPast(iso: string | null | undefined): boolean {
  return !!iso && new Date(iso).getTime() < Date.now();
}

export function isWithinHours(iso: string, hours: number): boolean {
  return new Date(iso).getTime() - Date.now() < hours * 3600 * 1000;
}

/** Tomorrow 10:00 Japan time, formatted for <input type="datetime-local">. */
export function defaultFollowUpJst(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000 + 9 * 3600 * 1000);
  return `${d.toISOString().slice(0, 10)}T10:00`;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
