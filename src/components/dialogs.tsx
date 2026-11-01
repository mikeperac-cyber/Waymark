import { useEffect, useState } from "react";
import type { LinkItem, Tool, Task, Note, Reminder, ParentRef } from "@/lib/types";
import { LINK_STATUSES, TOOL_STATUSES, PRIORITIES, REPEATS, TASK_STATUSES } from "@/lib/types";
import { coerceUrl, guessTitle } from "@/lib/url";
import { toLocalInput, fromLocalInput } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { Modal, Field, TagInput, Select, btnPrimary, btnGhost, inputCls } from "./common";

/* ---------- Parent picker ---------- */

function ParentPicker({
  value,
  onChange,
}: {
  value: ParentRef | null;
  onChange: (p: ParentRef | null) => void;
}) {
  const tools = useStore((s) => s.data.tools).filter((t) => !t.archivedAt);
  const links = useStore((s) => s.data.links).filter((l) => !l.archivedAt);
  const current = value ? `${value.type}:${value.id}` : "";
  return (
    <Field label="Attached to">
      <select
        className={inputCls}
        value={current}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return onChange(null);
          const [type, id] = v.split(":");
          if (id && (type === "tool" || type === "link" || type === "task")) onChange({ type, id });
        }}
      >
        <option value="">Nothing</option>
        {tools.length > 0 && (
          <optgroup label="Tools">
            {tools.map((t) => (
              <option key={t.id} value={`tool:${t.id}`}>
                {t.name}
              </option>
            ))}
          </optgroup>
        )}
        {links.length > 0 && (
          <optgroup label="Links">
            {links.slice(0, 100).map((l) => (
              <option key={l.id} value={`link:${l.id}`}>
                {l.title}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </Field>
  );
}

/* ---------- Link dialog ---------- */

export function LinkDialog({
  open,
  onOpenChange,
  link,
  defaultUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link?: LinkItem | null;
  defaultUrl?: string | undefined;
}) {
  const { addLink, updateLink } = useStore();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<LinkItem["status"]>("inbox");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setUrl(link?.url ?? defaultUrl ?? "");
    setTitle(link?.title ?? "");
    setDescription(link?.description ?? "");
    setTags(link?.tags ?? []);
    setStatus(link?.status ?? "inbox");
    setError("");
  }, [open, link, defaultUrl]);

  const save = () => {
    const coerced = coerceUrl(url);
    if (!coerced) {
      setError("That doesn't look like a web address.");
      return;
    }
    const payload = {
      url: coerced,
      title: title.trim() || guessTitle(coerced),
      description: description.trim(),
      tags,
      status,
    };
    if (link) updateLink(link.id, payload);
    else addLink(payload);
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={link ? "Edit link" : "Save a link"}>
      <div className="space-y-3">
        <Field label="Address">
          <input
            className={inputCls}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </Field>
        <Field label="Title">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Leave blank to guess from the address"
          />
        </Field>
        <Field label="Notes about this link">
          <textarea
            className={inputCls}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select
              value={status}
              onChange={setStatus}
              options={LINK_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
          </Field>
          <Field label="Tags">
            <TagInput tags={tags} onChange={setTags} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={save}>
            {link ? "Save changes" : "Save link"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Tool dialog ---------- */

export function ToolDialog({
  open,
  onOpenChange,
  tool,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool?: Tool | null;
}) {
  const { addTool, updateTool } = useStore();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<Tool["status"]>("idea");
  const [cost, setCost] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(tool?.name ?? "");
    setUrl(tool?.url ?? "");
    setDescription(tool?.description ?? "");
    setCategory(tool?.category ?? "");
    setTags(tool?.tags ?? []);
    setStatus(tool?.status ?? "idea");
    setCost(tool?.cost ?? "");
    setError("");
  }, [open, tool]);

  const save = () => {
    if (!name.trim()) {
      setError("Give the tool a name.");
      return;
    }
    const payload = {
      name: name.trim(),
      url: url.trim() ? (coerceUrl(url) ?? url.trim()) : "",
      description: description.trim(),
      category: category.trim(),
      tags,
      status,
      cost: cost.trim(),
    };
    if (tool) updateTool(tool.id, payload);
    else addTool(payload);
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={tool ? "Edit tool" : "Add a tool"}>
      <div className="space-y-3">
        <Field label="Name">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </Field>
        <Field label="Website">
          <input
            className={inputCls}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="What is it for?">
          <textarea
            className={inputCls}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <input
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Design, Dev, Writing"
            />
          </Field>
          <Field label="Cost">
            <input
              className={inputCls}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="Free, $10/mo…"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select
              value={status}
              onChange={setStatus}
              options={TOOL_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
          </Field>
          <Field label="Tags">
            <TagInput tags={tags} onChange={setTags} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={save}>
            {tool ? "Save changes" : "Add tool"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Task dialog ---------- */

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultParent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultParent?: ParentRef | null;
}) {
  const { addTask, updateTask } = useStore();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [status, setStatus] = useState<Task["status"]>("todo");
  const [dueDate, setDueDate] = useState("");
  const [parent, setParent] = useState<ParentRef | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDetails(task?.details ?? "");
    setPriority(task?.priority ?? "medium");
    setStatus(task?.status ?? "todo");
    setDueDate(task?.dueDate ?? "");
    setParent(task?.parent ?? defaultParent ?? null);
    setError("");
  }, [open, task, defaultParent]);

  const save = () => {
    if (!title.trim()) {
      setError("Give the task a title.");
      return;
    }
    const payload = {
      title: title.trim(),
      details: details.trim(),
      priority,
      status,
      dueDate: dueDate || null,
      parent,
    };
    if (task) updateTask(task.id, payload);
    else addTask(payload);
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={task ? "Edit task" : "New task"}>
      <div className="space-y-3">
        <Field label="Title">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </Field>
        <Field label="Details">
          <textarea
            className={inputCls}
            rows={2}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Priority">
            <Select
              value={priority}
              onChange={setPriority}
              options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
            />
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onChange={setStatus}
              options={TASK_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
          </Field>
          <Field label="Due date">
            <input
              type="date"
              className={inputCls}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>
        </div>
        <ParentPicker value={parent} onChange={setParent} />
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={save}>
            {task ? "Save changes" : "Add task"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Reminder dialog ---------- */

export function ReminderDialog({
  open,
  onOpenChange,
  reminder,
  defaultParent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminder?: Reminder | null;
  defaultParent?: ParentRef | null;
}) {
  const { addReminder, updateReminder } = useStore();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [when, setWhen] = useState("");
  const [repeat, setRepeat] = useState<Reminder["repeat"]>("none");
  const [parent, setParent] = useState<ParentRef | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(reminder?.title ?? "");
    setMessage(reminder?.message ?? "");
    setWhen(
      toLocalInput(reminder?.remindAt) ||
        toLocalInput(new Date(Date.now() + 3600_000).toISOString()),
    );
    setRepeat(reminder?.repeat ?? "none");
    setParent(reminder?.parent ?? defaultParent ?? null);
    setError("");
  }, [open, reminder, defaultParent]);

  const save = () => {
    if (!title.trim()) {
      setError("Give the reminder a title.");
      return;
    }
    const iso = fromLocalInput(when);
    if (!iso) {
      setError("Pick a date and time.");
      return;
    }
    const payload = {
      title: title.trim(),
      message: message.trim(),
      remindAt: iso,
      repeat,
      parent,
    };
    if (reminder) updateReminder(reminder.id, payload);
    else addReminder(payload);
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={reminder ? "Edit reminder" : "New reminder"}>
      <div className="space-y-3">
        <Field label="Title">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </Field>
        <Field label="Message">
          <textarea
            className={inputCls}
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="When">
            <input
              type="datetime-local"
              className={inputCls}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </Field>
          <Field label="Repeat">
            <Select
              value={repeat}
              onChange={setRepeat}
              options={REPEATS.map((r) => ({ value: r.value, label: r.label }))}
            />
          </Field>
        </div>
        <ParentPicker value={parent} onChange={setParent} />
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={save}>
            {reminder ? "Save changes" : "Add reminder"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Note dialog ---------- */

export function NoteDialog({
  open,
  onOpenChange,
  note,
  defaultParent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note?: Note | null;
  defaultParent?: ParentRef | null;
}) {
  const { addNote, updateNote } = useStore();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [parent, setParent] = useState<ParentRef | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setTags(note?.tags ?? []);
    setParent(note?.parent ?? defaultParent ?? null);
    setError("");
  }, [open, note, defaultParent]);

  const save = () => {
    if (!title.trim() && !body.trim()) {
      setError("Write something first.");
      return;
    }
    const payload = { title: title.trim() || "Untitled note", body, tags, parent };
    if (note) updateNote(note.id, payload);
    else addNote(payload);
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={note ? "Edit note" : "New note"} wide>
      <div className="space-y-3">
        <Field label="Title">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </Field>
        <Field label="Note">
          <textarea
            className={inputCls}
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write freely — plain text, one thought per line works well."
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tags">
            <TagInput tags={tags} onChange={setTags} />
          </Field>
          <ParentPicker value={parent} onChange={setParent} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={save}>
            {note ? "Save changes" : "Add note"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
