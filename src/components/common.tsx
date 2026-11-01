import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LinkStatus, ToolStatus, Priority, TaskStatus } from "@/lib/types";
import { LINK_STATUSES, TOOL_STATUSES, PRIORITIES, TASK_STATUSES } from "@/lib/types";

/* ---------- Modal ---------- */

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-pop-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-[8vh] z-50 max-h-[84vh] w-[calc(100vw-2rem)] -translate-x-1/2 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lift focus:outline-none data-[state=open]:animate-pop-in",
            wide ? "max-w-3xl" : "max-w-lg",
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-display text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = "Delete",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title}>
      <p className="text-sm text-muted-foreground">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button className={btnGhost} onClick={() => onOpenChange(false)}>
          Cancel
        </button>
        <button
          className={btnDanger}
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Buttons & fields ---------- */

export const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:brightness-105 active:brightness-95 disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
export const btnDanger =
  "inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:brightness-105";
export const btnIcon =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "icon";
}) {
  const styles = {
    primary: btnPrimary,
    secondary: btnSecondary,
    ghost: btnGhost,
    danger: btnDanger,
    icon: btnIcon,
  };
  return <button type="button" className={cn(styles[variant], className)} {...props} />;
}

export const inputCls =
  "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring";
export const labelCls = "mb-1 block text-xs font-medium text-muted-foreground";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

/* ---------- Tag input ---------- */

export function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            className="hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={tags.length ? "" : "Add tags…"}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
      />
    </div>
  );
}

/* ---------- Badges ---------- */

const linkStatusTone: Record<LinkStatus, string> = {
  inbox: "bg-info-soft text-info",
  active: "bg-success-soft text-success",
  reference: "bg-warning-soft text-warning",
  done: "bg-muted text-muted-foreground",
};

export function LinkStatusBadge({ status }: { status: LinkStatus }) {
  const meta = LINK_STATUSES.find((s) => s.value === status);
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", linkStatusTone[status])}>
      {meta?.label ?? status}
    </span>
  );
}

const toolStatusTone: Record<ToolStatus, string> = {
  idea: "bg-muted text-status-idea",
  evaluating: "bg-warning-soft text-status-evaluating",
  adopting: "bg-info-soft text-status-adopting",
  active: "bg-success-soft text-status-active",
  paused: "bg-muted text-status-paused",
  retired: "bg-muted text-status-retired",
};

export function ToolStatusBadge({ status }: { status: ToolStatus }) {
  const meta = TOOL_STATUSES.find((s) => s.value === status);
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", toolStatusTone[status])}>
      {meta?.label ?? status}
    </span>
  );
}

const priorityTone: Record<Priority, string> = {
  low: "text-priority-low",
  medium: "text-priority-medium",
  high: "text-priority-high",
  urgent: "text-priority-urgent",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITIES.find((p) => p.value === priority);
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", priorityTone[priority])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta?.label ?? priority}
    </span>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const meta = TASK_STATUSES.find((s) => s.value === status);
  const tone =
    status === "done"
      ? "bg-success-soft text-success"
      : status === "doing"
        ? "bg-info-soft text-info"
        : "bg-muted text-muted-foreground";
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", tone)}>{meta?.label}</span>;
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">{children}</span>
  );
}

/* ---------- Page scaffolding ---------- */

export function PageHeader({
  title,
  count,
  actions,
  children,
}: {
  title: string;
  count?: number;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {title}
          {typeof count === "number" && (
            <span className="ml-2 align-middle font-mono text-sm font-normal text-muted-foreground">
              {count}
            </span>
          )}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
}) {
  return (
    <div className="dot-grid flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-signal-soft text-signal">
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {actionLabel && onAction && (
        <button className={cn(btnPrimary, "mt-4")} onClick={onAction}>
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/* ---------- Search input with debounce ---------- */

export function useDebounced<T>(value: T, ms = 150): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* ---------- Select ---------- */

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cn(inputCls, className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ---------- Textarea that auto-grows ---------- */

export function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
  minRows = 3,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={cn(inputCls, "resize-none overflow-hidden", className)}
    />
  );
}
