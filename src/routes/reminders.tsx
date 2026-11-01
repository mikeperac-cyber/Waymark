import { useMemo, useState } from "react";
import { Bell, Plus, Pencil, Archive, Clock } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Reminder } from "@/lib/types";
import { formatDateTime } from "@/lib/dates";
import { PageHeader, Button, EmptyState, inputCls } from "@/components/common";
import { ReminderDialog } from "@/components/dialogs";

export function RemindersPage() {
  const { data, updateReminder, archiveItem } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [filter, setFilter] = useState("pending");

  const items = useMemo(
    () =>
      data.reminders
        .filter((r) => !r.archivedAt && (filter === "all" || (filter === "done" ? r.done : !r.done)))
        .sort((a, b) => a.remindAt.localeCompare(b.remindAt)),
    [data.reminders, filter],
  );

  return (
    <>
      <PageHeader
        title="Reminders"
        count={items.length}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus size={16} />
            New reminder
          </Button>
        }
      />
      <select
        aria-label="Reminder filter"
        className={`${inputCls} mb-5 w-auto`}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        <option value="pending">Pending</option>
        <option value="done">Completed</option>
        <option value="all">All reminders</option>
      </select>

      {!items.length && <EmptyState icon={<Bell />} title="No reminders here" body="" />}

      <div className="divide-y divide-border">
        {items.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 py-4">
            <Bell size={18} className={r.done ? "text-muted-foreground" : "text-primary"} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{r.title}</p>
              {r.message && <p className="text-sm text-muted-foreground">{r.message}</p>}
              <p className="text-xs text-muted-foreground">
                {formatDateTime(r.remindAt)}
                {r.repeat !== "none" && ` · ${r.repeat}`}
              </p>
            </div>
            <Button onClick={() => updateReminder(r.id, { done: !r.done })}>
              {r.done ? "Reopen" : "Done"}
            </Button>
            {!r.done && (
              <Button
                title="Snooze for 15 minutes"
                onClick={() =>
                  updateReminder(r.id, { remindAt: new Date(Date.now() + 900_000).toISOString() })
                }
              >
                <Clock size={14} />
                15 min
              </Button>
            )}
            <Button
              variant="icon"
              title="Edit reminder"
              onClick={() => {
                setEditing(r);
                setOpen(true);
              }}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="icon"
              title="Archive reminder"
              onClick={() => archiveItem("reminder", r.id)}
            >
              <Archive size={14} />
            </Button>
          </div>
        ))}
      </div>

      <ReminderDialog open={open} onOpenChange={setOpen} reminder={editing} />
    </>
  );
}
