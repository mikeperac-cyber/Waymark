export type ID = string;

export type ItemType = "link" | "tool" | "task" | "note" | "reminder";

export type ParentType = "tool" | "link" | "task";
export interface ParentRef {
  type: ParentType;
  id: ID;
}

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export type LinkStatus = "inbox" | "active" | "reference" | "done";

export interface LinkItem extends Timestamps {
  id: ID;
  url: string;
  title: string;
  description: string;
  tags: string[];
  status: LinkStatus;
  favorite: boolean;
  toolIds: ID[];
  visits: number;
  lastVisitedAt: string | null;
}

export type ToolStatus = "idea" | "evaluating" | "adopting" | "active" | "paused" | "retired";

export interface Step {
  id: ID;
  text: string;
  done: boolean;
  doneAt: string | null;
}

export interface Tool extends Timestamps {
  id: ID;
  name: string;
  url: string;
  description: string;
  category: string;
  tags: string[];
  status: ToolStatus;
  steps: Step[];
  rating: number;
  cost: string;
}

export type TaskStatus = "todo" | "doing" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface Task extends Timestamps {
  id: ID;
  title: string;
  details: string;
  status: TaskStatus;
  priority: Priority;
  /** Local calendar date, yyyy-MM-dd */
  dueDate: string | null;
  parent: ParentRef | null;
  completedAt: string | null;
}

export interface Note extends Timestamps {
  id: ID;
  title: string;
  body: string;
  pinned: boolean;
  tags: string[];
  parent: ParentRef | null;
}

export type Repeat = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export interface Reminder extends Timestamps {
  id: ID;
  title: string;
  message: string;
  /** ISO timestamp of the next time this reminder should fire */
  remindAt: string;
  repeat: Repeat;
  parent: ParentRef | null;
  done: boolean;
  lastFiredAt: string | null;
  firedCount: number;
}

export type MergeMode = "delete" | "archive";

export interface Settings {
  notifications: boolean;
  sound: boolean;
  /** 0 disables auto-archiving */
  autoArchiveDoneTasksDays: number;
  mergeMode: MergeMode;
  closeToTray: boolean;
  launchAtLogin: boolean;
  weekStartsOn: 0 | 1;
}

export interface WorkspaceData {
  version: 1;
  links: LinkItem[];
  tools: Tool[];
  tasks: Task[];
  notes: Note[];
  reminders: Reminder[];
  settings: Settings;
  dismissedMatches: string[];
  onboarded: boolean;
}

export const COLLECTION: Record<ItemType, "links" | "tools" | "tasks" | "notes" | "reminders"> = {
  link: "links",
  tool: "tools",
  task: "tasks",
  note: "notes",
  reminder: "reminders",
};

export const DEFAULT_SETTINGS: Settings = {
  notifications: true,
  sound: true,
  autoArchiveDoneTasksDays: 14,
  mergeMode: "delete",
  closeToTray: true,
  launchAtLogin: false,
  weekStartsOn: 1,
};

export const LINK_STATUSES: { value: LinkStatus; label: string; hint: string }[] = [
  { value: "inbox", label: "Inbox", hint: "Saved, not sorted yet" },
  { value: "active", label: "In use", hint: "Working with it now" },
  { value: "reference", label: "Reference", hint: "Keep for later lookups" },
  { value: "done", label: "Done", hint: "Read, watched or finished" },
];

export const TOOL_STATUSES: { value: ToolStatus; label: string; hint: string }[] = [
  { value: "idea", label: "Idea", hint: "Worth a look someday" },
  { value: "evaluating", label: "Evaluating", hint: "Trying it out" },
  { value: "adopting", label: "Adopting", hint: "Setting it up" },
  { value: "active", label: "Active", hint: "Part of the toolkit" },
  { value: "paused", label: "Paused", hint: "On hold for now" },
  { value: "retired", label: "Retired", hint: "No longer used" },
];

export const PRIORITIES: { value: Priority; label: string; rank: number }[] = [
  { value: "urgent", label: "Urgent", rank: 4 },
  { value: "high", label: "High", rank: 3 },
  { value: "medium", label: "Medium", rank: 2 },
  { value: "low", label: "Low", rank: 1 },
];

export const REPEATS: { value: Repeat; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Every weekday" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
];

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "In progress" },
  { value: "done", label: "Done" },
];

export const ITEM_LABEL: Record<ItemType, { one: string; many: string }> = {
  link: { one: "link", many: "links" },
  tool: { one: "tool", many: "tools" },
  task: { one: "task", many: "tasks" },
  note: { one: "note", many: "notes" },
  reminder: { one: "reminder", many: "reminders" },
};

const PRIORITY_RANK_MAP: Record<Priority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function priorityRank(p: Priority): number {
  return PRIORITY_RANK_MAP[p] ?? 0;
}
