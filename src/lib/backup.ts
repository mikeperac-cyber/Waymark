import type { WorkspaceData } from "./types";
import { DEFAULT_SETTINGS } from "./types";

export const BACKUP_VERSION = 1;

export function serializeWorkspace(data: WorkspaceData): string {
  return JSON.stringify({ app: "waymark", exportedAt: new Date().toISOString(), data }, null, 2);
}

/** Parse and validate a backup file. Throws with a friendly message on failure. */
export function parseBackup(text: string): WorkspaceData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const data = (raw as { data?: unknown })?.data ?? raw;
  const w = data as Partial<WorkspaceData>;
  if (!w || typeof w !== "object") throw new Error("That file does not look like a Waymark backup.");
  for (const key of ["links", "tools", "tasks", "notes", "reminders"] as const) {
    if (!Array.isArray(w[key])) throw new Error(`The backup is missing its ${key} list.`);
  }
  return {
    version: BACKUP_VERSION,
    links: w.links!,
    tools: w.tools!,
    tasks: w.tasks!,
    notes: w.notes!,
    reminders: w.reminders!,
    settings: { ...DEFAULT_SETTINGS, ...(w.settings ?? {}) },
    dismissedMatches: Array.isArray(w.dismissedMatches) ? w.dismissedMatches : [],
    onboarded: Boolean(w.onboarded),
  };
}

export function downloadTextFile(filename: string, text: string, type = "application/json"): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
