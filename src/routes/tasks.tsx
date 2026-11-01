import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, ListChecks, Archive, Pencil } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { priorityRank } from "@/lib/types";
import { today, formatDate } from "@/lib/dates";
import { PageHeader, Button, EmptyState, PriorityBadge, inputCls, useDebounced } from "@/components/common";
import { TaskDialog } from "@/components/dialogs";

export function TasksPage() {
  const { data, updateTask, archiveItem } = useStore();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query);
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("all");
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);

  const tasks = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return data.tasks
      .filter(
        (t) =>
          !t.archivedAt &&
          (!q || t.title.toLowerCase().includes(q)) &&
          (status === "all" || (status === "open" ? t.status !== "done" : t.status === status)) &&
          (priority === "all" || t.priority === priority),
      )
      .sort(
        (a, b) =>
          (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
          priorityRank(b.priority) - priorityRank(a.priority),
      );
  }, [data.tasks, debouncedQuery, status, priority]);

  const t = today();
  const groups = ["Overdue", "Today", "Upcoming", "No due date", "Completed"] as const;
  const group = (task: Task) =>
    task.status === "done"
      ? "Completed"
      : !task.dueDate
        ? "No due date"
        : task.dueDate < t
          ? "Overdue"
          : task.dueDate === t
            ? "Today"
            : "Upcoming";

  return (
    <>
      <PageHeader
        title="Tasks"
        count={tasks.length}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus size={16} />
            New task
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <input
          aria-label="Search tasks"
          className={`${inputCls} max-w-xs`}
          placeholder="Search tasks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Task status"
          className={`${inputCls} w-auto`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["open", "all", "todo", "doing", "done"].map((s) => (
            <option key={s} value={s}>
              {s === "open"
                ? "Open tasks"
                : s === "all"
                  ? "All statuses"
                  : s === "todo"
                    ? "To do"
                    : s === "doing"
                      ? "Doing"
                      : "Completed"}
            </option>
          ))}
        </select>
        <select
          aria-label="Task priority"
          className={`${inputCls} w-auto`}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          {["all", "urgent", "high", "medium", "low"].map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All priorities" : s}
            </option>
          ))}
        </select>
      </div>

      {!tasks.length && <EmptyState icon={<ListChecks />} title="No tasks here" body="" />}

      {groups.map((g) => {
        const items = tasks.filter((x) => group(x) === g);
        return items.length ? (
          <section key={g} className="mb-6">
            <h2 className="eyebrow mb-2">
              {g} · {items.length}
            </h2>
            <div className="divide-y divide-border border-y border-border">
              {items.map((x) => (
                <div key={x.id} className="flex items-center gap-3 py-3">
                  <input
                    aria-label={`Complete ${x.title}`}
                    type="checkbox"
                    checked={x.status === "done"}
                    onChange={(e) => updateTask(x.id, { status: e.target.checked ? "done" : "todo" })}
                  />
                  <div className="min-w-0 flex-1">
                    <Button
                      variant="ghost"
                      className={`p-0 text-foreground ${x.status === "done" ? "line-through" : ""}`}
                      onClick={() => {
                        setEditing(x);
                        setOpen(true);
                      }}
                    >
                      {x.title}
                    </Button>
                    {x.details && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{x.details}</p>
                    )}
                    {x.parent?.type === "tool" && (
                      <Link
                        className="text-xs text-primary"
                        to="/tools/$toolId"
                        params={{ toolId: x.parent.id }}
                      >
                        {data.tools.find((tool) => tool.id === x.parent?.id)?.name ?? "Tool"}
                      </Link>
                    )}
                  </div>
                  <div className="text-right">
                    <PriorityBadge priority={x.priority} />
                    {x.dueDate && (
                      <p className="text-xs text-muted-foreground">{formatDate(x.dueDate)}</p>
                    )}
                  </div>
                  <Button
                    variant="icon"
                    title="Edit task"
                    onClick={() => {
                      setEditing(x);
                      setOpen(true);
                    }}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="icon"
                    title="Archive task"
                    onClick={() => archiveItem("task", x.id)}
                  >
                    <Archive size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null;
      })}

      <TaskDialog open={open} onOpenChange={setOpen} task={editing} />
    </>
  );
}
