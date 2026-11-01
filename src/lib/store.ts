import { create } from "zustand";
import { bridge } from "./platform";
import type {
  WorkspaceData,
  LinkItem,
  Tool,
  Task,
  Note,
  Reminder,
  Settings,
  ItemType,
  Step,
  ParentRef,
} from "./types";
import { COLLECTION, DEFAULT_SETTINGS } from "./types";
import { uid, nowIso } from "./id";
import { addDays, today, compareDates } from "./dates";

const STORAGE_KEY = "waymark-data-v1";
const UNDO_LIMIT = 40;
const DEBOUNCE_WRITE_MS = 80;

let pendingFlushData: WorkspaceData | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function emptyWorkspace(): WorkspaceData {
  return {
    version: 1,
    links: [],
    tools: [],
    tasks: [],
    notes: [],
    reminders: [],
    settings: { ...DEFAULT_SETTINGS },
    dismissedMatches: [],
    onboarded: false,
  };
}

function loadWorkspace(): WorkspaceData {
  try {
    const raw = bridge() ? bridge()?.readWorkspace() : (globalThis as any).localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyWorkspace();
    const parsed = JSON.parse(raw) as Partial<WorkspaceData>;
    return {
      ...emptyWorkspace(),
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return emptyWorkspace();
  }
}

export function flushPendingPersistence(): void {
  if (!pendingFlushData) return;
  const data = pendingFlushData;
  pendingFlushData = null;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  try {
    const desktop = bridge();
    const json = JSON.stringify(data);
    if (desktop) {
      desktop.writeWorkspace(json);
    } else {
      (globalThis as any).localStorage.setItem(STORAGE_KEY, json);
    }
  } catch {}
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushPendingPersistence);
  window.addEventListener("pagehide", flushPendingPersistence);
}

function persist(data: WorkspaceData): void {
  try {
    const desktop = bridge();
    if (desktop) {
      if (typeof desktop.writeWorkspaceAsync === "function") {
        pendingFlushData = data;
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = setTimeout(() => {
          const snapshot = pendingFlushData;
          pendingFlushData = null;
          flushTimer = null;
          if (snapshot && desktop.writeWorkspaceAsync) {
            void desktop.writeWorkspaceAsync(JSON.stringify(snapshot));
          }
        }, DEBOUNCE_WRITE_MS);
      } else {
        if (!desktop.writeWorkspace(JSON.stringify(data))) throw new Error("Workspace save failed");
      }
    } else {
      (globalThis as any).localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // storage full or unavailable — keep running in memory
  }
}

interface StoreState {
  data: WorkspaceData;
  undoStack: WorkspaceData[];
  hydrated: boolean;

  hydrate: () => void;
  replaceAll: (data: WorkspaceData) => void;
  undo: () => void;
  canUndo: () => boolean;
  updateSettings: (patch: Partial<Settings>) => void;
  setOnboarded: () => void;
  dismissMatch: (key: string) => void;

  addLink: (input: Partial<LinkItem> & { url: string }) => LinkItem;
  updateLink: (id: string, patch: Partial<LinkItem>) => void;
  updateLinks: (ids: string[], patch: Partial<LinkItem>) => void;
  addLinks: (inputs: (Partial<LinkItem> & { url: string })[]) => number;

  addTool: (input: Partial<Tool> & { name: string }) => Tool;
  updateTool: (id: string, patch: Partial<Tool>) => void;
  addStep: (toolId: string, text: string) => void;
  toggleStep: (toolId: string, stepId: string) => void;
  removeStep: (toolId: string, stepId: string) => void;
  reorderSteps: (toolId: string, steps: Step[]) => void;

  addTask: (input: Partial<Task> & { title: string }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;

  addNote: (input: Partial<Note> & { title: string }) => Note;
  updateNote: (id: string, patch: Partial<Note>) => void;

  addReminder: (input: Partial<Reminder> & { title: string; remindAt: string }) => Reminder;
  updateReminder: (id: string, patch: Partial<Reminder>) => void;

  archiveItem: (type: ItemType, id: string) => void;
  archiveItems: (type: ItemType, ids: string[]) => void;
  restoreItem: (type: ItemType, id: string) => void;
  deleteItem: (type: ItemType, id: string) => void;
  removeItems: (type: ItemType, ids: string[]) => void;

  autoArchiveDoneTasks: () => number;
}

function stamp<T extends object>(
  item: T & { createdAt?: string | undefined; archivedAt?: string | null | undefined },
): T & { createdAt: string; updatedAt: string; archivedAt: string | null } {
  const now = nowIso();
  return {
    ...item,
    createdAt: item.createdAt ?? now,
    updatedAt: now,
    archivedAt: item.archivedAt ?? null,
  };
}

export const useStore = create<StoreState>((set, get) => {
  /** Apply a mutation, pushing the previous state onto the undo stack. */
  function commit(mutate: (data: WorkspaceData) => WorkspaceData, undoable = true): void {
    const { data, undoStack } = get();
    const next = mutate(data);
    persist(next);
    set({
      data: next,
      undoStack: undoable ? [...undoStack.slice(-UNDO_LIMIT + 1), data] : undoStack,
    });
  }

  return {
    data: emptyWorkspace(),
    undoStack: [],
    hydrated: false,

    hydrate: () => {
      if (get().hydrated) return;
      set({ data: loadWorkspace(), hydrated: true });
    },

    replaceAll: (data) => commit(() => data),

    undo: () => {
      const { undoStack } = get();
      const prev = undoStack[undoStack.length - 1];
      if (!prev) return;
      persist(prev);
      set({ data: prev, undoStack: undoStack.slice(0, -1) });
    },
    canUndo: () => get().undoStack.length > 0,

    updateSettings: (patch) =>
      commit((d) => ({ ...d, settings: { ...d.settings, ...patch } }), false),

    setOnboarded: () => commit((d) => ({ ...d, onboarded: true }), false),

    dismissMatch: (key) =>
      commit((d) => ({ ...d, dismissedMatches: [...d.dismissedMatches, key] }), false),

    addLink: (input) => {
      const link: LinkItem = stamp({
        id: uid(),
        url: input.url,
        title: input.title ?? input.url,
        description: input.description ?? "",
        tags: input.tags ?? [],
        status: input.status ?? "inbox",
        favorite: input.favorite ?? false,
        toolIds: input.toolIds ?? [],
        visits: input.visits ?? 0,
        lastVisitedAt: input.lastVisitedAt ?? null,
        createdAt: input.createdAt,
      });
      commit((d) => ({ ...d, links: [link, ...d.links] }));
      return link;
    },

    updateLink: (id, patch) =>
      commit((d) => ({
        ...d,
        links: d.links.map((l) => (l.id === id ? { ...l, ...patch, updatedAt: nowIso() } : l)),
      })),

    updateLinks: (ids, patch) => {
      if (!ids.length) return;
      const idSet = new Set(ids);
      const now = nowIso();
      commit((d) => ({
        ...d,
        links: d.links.map((l) => (idSet.has(l.id) ? { ...l, ...patch, updatedAt: now } : l)),
      }));
    },

    addLinks: (inputs) => {
      const existing = new Set(get().data.links.map((l) => l.url));
      const fresh = inputs.filter((i) => !existing.has(i.url));
      if (!fresh.length) return 0;
      const links: LinkItem[] = fresh.map((input) =>
        stamp({
          id: uid(),
          url: input.url,
          title: input.title ?? input.url,
          description: input.description ?? "",
          tags: input.tags ?? [],
          status: input.status ?? "inbox",
          favorite: input.favorite ?? false,
          toolIds: input.toolIds ?? [],
          visits: input.visits ?? 0,
          lastVisitedAt: input.lastVisitedAt ?? null,
          createdAt: input.createdAt,
        }),
      );
      commit((d) => ({ ...d, links: [...links, ...d.links] }));
      return links.length;
    },

    addTool: (input) => {
      const tool: Tool = stamp({
        id: uid(),
        name: input.name,
        url: input.url ?? "",
        description: input.description ?? "",
        category: input.category ?? "",
        tags: input.tags ?? [],
        status: input.status ?? "idea",
        steps: input.steps ?? [],
        rating: input.rating ?? 0,
        cost: input.cost ?? "",
      });
      commit((d) => ({ ...d, tools: [tool, ...d.tools] }));
      return tool;
    },

    updateTool: (id, patch) =>
      commit((d) => ({
        ...d,
        tools: d.tools.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t)),
      })),

    addStep: (toolId, text) =>
      commit((d) => ({
        ...d,
        tools: d.tools.map((t) =>
          t.id === toolId
            ? {
                ...t,
                steps: [...t.steps, { id: uid(), text, done: false, doneAt: null }],
                updatedAt: nowIso(),
              }
            : t,
        ),
      })),

    toggleStep: (toolId, stepId) =>
      commit((d) => ({
        ...d,
        tools: d.tools.map((t) =>
          t.id === toolId
            ? {
                ...t,
                steps: t.steps.map((s) =>
                  s.id === stepId
                    ? { ...s, done: !s.done, doneAt: !s.done ? nowIso() : null }
                    : s,
                ),
                updatedAt: nowIso(),
              }
            : t,
        ),
      })),

    removeStep: (toolId, stepId) =>
      commit((d) => ({
        ...d,
        tools: d.tools.map((t) =>
          t.id === toolId
            ? { ...t, steps: t.steps.filter((s) => s.id !== stepId), updatedAt: nowIso() }
            : t,
        ),
      })),

    reorderSteps: (toolId, steps) =>
      commit((d) => ({
        ...d,
        tools: d.tools.map((t) => (t.id === toolId ? { ...t, steps, updatedAt: nowIso() } : t)),
      })),

    addTask: (input) => {
      const task: Task = stamp({
        id: uid(),
        title: input.title,
        details: input.details ?? "",
        status: input.status ?? "todo",
        priority: input.priority ?? "medium",
        dueDate: input.dueDate ?? null,
        parent: input.parent ?? null,
        completedAt: input.completedAt ?? null,
      });
      commit((d) => ({ ...d, tasks: [task, ...d.tasks] }));
      return task;
    },

    updateTask: (id, patch) =>
      commit((d) => ({
        ...d,
        tasks: d.tasks.map((t) => {
          if (t.id !== id) return t;
          const next = { ...t, ...patch, updatedAt: nowIso() };
          if (patch.status === "done" && t.status !== "done") next.completedAt = nowIso();
          if (patch.status && patch.status !== "done") next.completedAt = null;
          return next;
        }),
      })),

    addNote: (input) => {
      const note: Note = stamp({
        id: uid(),
        title: input.title,
        body: input.body ?? "",
        pinned: input.pinned ?? false,
        tags: input.tags ?? [],
        parent: input.parent ?? null,
      });
      commit((d) => ({ ...d, notes: [note, ...d.notes] }));
      return note;
    },

    updateNote: (id, patch) =>
      commit((d) => ({
        ...d,
        notes: d.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: nowIso() } : n)),
      })),

    addReminder: (input) => {
      const reminder: Reminder = stamp({
        id: uid(),
        title: input.title,
        message: input.message ?? "",
        remindAt: input.remindAt,
        repeat: input.repeat ?? "none",
        parent: input.parent ?? null,
        done: input.done ?? false,
        lastFiredAt: input.lastFiredAt ?? null,
        firedCount: input.firedCount ?? 0,
      });
      commit((d) => ({ ...d, reminders: [reminder, ...d.reminders] }));
      return reminder;
    },

    updateReminder: (id, patch) =>
      commit((d) => ({
        ...d,
        reminders: d.reminders.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: nowIso() } : r)),
      })),

    archiveItem: (type, id) =>
      commit((d) => ({
        ...d,
        [COLLECTION[type]]: (d[COLLECTION[type]] as { id: string }[]).map((x) =>
          x.id === id ? { ...x, archivedAt: nowIso() } : x,
        ),
      })),

    archiveItems: (type, ids) => {
      if (!ids.length) return;
      const idSet = new Set(ids);
      const now = nowIso();
      commit((d) => ({
        ...d,
        [COLLECTION[type]]: (d[COLLECTION[type]] as { id: string }[]).map((x) =>
          idSet.has(x.id) ? { ...x, archivedAt: now } : x,
        ),
      }));
    },

    restoreItem: (type, id) =>
      commit((d) => ({
        ...d,
        [COLLECTION[type]]: (d[COLLECTION[type]] as { id: string }[]).map((x) =>
          x.id === id ? { ...x, archivedAt: null } : x,
        ),
      })),

    deleteItem: (type, id) => get().removeItems(type, [id]),

    removeItems: (type, ids) => {
      if (!ids.length) return;
      const idSet = new Set(ids);
      commit((d) => {
        const next: WorkspaceData = {
          ...d,
          [COLLECTION[type]]: (d[COLLECTION[type]] as { id: string }[]).filter((x) => !idSet.has(x.id)),
        };
        if (type === "tool") {
          next.links = next.links.map((l) => ({
            ...l,
            toolIds: l.toolIds.filter((t) => !idSet.has(t)),
          }));
        }
        const detach = (p: ParentRef | null): ParentRef | null =>
          p && p.type === type && idSet.has(p.id) ? null : p;
        next.tasks = next.tasks.map((t) => ({ ...t, parent: detach(t.parent) }));
        next.notes = next.notes.map((n) => ({ ...n, parent: detach(n.parent) }));
        next.reminders = next.reminders.map((r) => ({ ...r, parent: detach(r.parent) }));
        return next;
      });
    },

    autoArchiveDoneTasks: () => {
      const { data } = get();
      const days = data.settings.autoArchiveDoneTasksDays;
      if (!days) return 0;
      const cutoff = addDays(today(), -days);
      const due = data.tasks.filter(
        (t) =>
          !t.archivedAt &&
          t.status === "done" &&
          t.completedAt &&
          compareDates(t.completedAt.slice(0, 10), cutoff) <= 0,
      );
      if (!due.length) return 0;
      const ids = new Set(due.map((t) => t.id));
      commit(
        (d) => ({
          ...d,
          tasks: d.tasks.map((t) => (ids.has(t.id) ? { ...t, archivedAt: nowIso() } : t)),
        }),
        false,
      );
      return due.length;
    },
  };
});

/** Convenience selectors */
export function useActiveLinks(): LinkItem[] {
  return useStore((s) => s.data.links).filter((l) => !l.archivedAt);
}
