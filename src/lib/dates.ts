import type { Repeat } from "./types";

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar date as yyyy-MM-dd. */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function today(): string {
  return localDate(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

/** -1/0/1 compare of two yyyy-MM-dd strings. */
export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

/** Minutes since local midnight, for display/sorting. */
export function timeOfDay(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatDate(dateStr: string, weekStartsOn: 0 | 1 = 1): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const t = today();
  if (dateStr === t) return "Today";
  if (dateStr === addDays(t, 1)) return "Tomorrow";
  if (dateStr === addDays(t, -1)) return "Yesterday";
  const diff = Math.round((d.getTime() - new Date(`${t}T12:00:00`).getTime()) / 86400000);
  if (diff > 1 && diff < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }
  void weekStartsOn;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = formatDate(localDate(d));
  return `${date} · ${timeOfDay(iso)}`;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return diff > 0 ? `${mins}m ago` : `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return diff > 0 ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return diff > 0 ? `${days}d ago` : `in ${days}d`;
  return new Date(iso).toLocaleDateString();
}

function isWeekdayDate(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Next fire time for a repeating reminder, strictly after `afterMs`.
 * `baseIso` carries the original time-of-day. Returns null for "none".
 */
export function nextFire(baseIso: string, repeat: Repeat, afterMs: number = Date.now()): string | null {
  if (repeat === "none") return null;
  const base = new Date(baseIso);
  if (Number.isNaN(base.getTime())) return null;

  const candidate = new Date(afterMs + 60_000);
  candidate.setHours(base.getHours(), base.getMinutes(), 0, 0);
  if (candidate.getTime() <= afterMs) {
    candidate.setDate(candidate.getDate() + 1);
  }

  if (repeat === "daily") return candidate.toISOString();

  if (repeat === "weekdays") {
    while (!isWeekdayDate(candidate)) candidate.setDate(candidate.getDate() + 1);
    return candidate.toISOString();
  }

  if (repeat === "weekly") {
    while (candidate.getDay() !== base.getDay()) candidate.setDate(candidate.getDate() + 1);
    return candidate.toISOString();
  }

  let month = candidate.getMonth();
  let year = candidate.getFullYear();
  for (let i = 0; i < 48; i++) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const day = Math.min(base.getDate(), lastDay);
    const c = new Date(year, month, day, base.getHours(), base.getMinutes(), 0, 0);
    if (c.getTime() > afterMs) return c.toISOString();
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return null;
}

/** Converts a datetime-local input value to an ISO string, or null if empty/invalid. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO string -> datetime-local input value. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export { isWeekdayDate };
