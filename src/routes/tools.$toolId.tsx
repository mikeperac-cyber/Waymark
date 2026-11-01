import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ExternalLink,
  Plus,
  Archive,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { TOOL_STATUSES } from "@/lib/types";
import { openUrl } from "@/lib/platform";
import { Button, PageHeader, inputCls, ToolStatusBadge, Tag } from "@/components/common";
import { ToolDialog, TaskDialog, NoteDialog, ReminderDialog } from "@/components/dialogs";

export function ToolPage() {
  const { toolId = "" } = useParams({ strict: false }) as { toolId?: string };
  const {
    data,
    addStep,
    toggleStep,
    removeStep,
    reorderSteps,
    updateTool,
    updateTask,
    updateLink,
    archiveItem,
  } = useStore();
  const tool = data.tools.find((t) => t.id === toolId);
  const [step, setStep] = useState("");
  const [dialog, setDialog] = useState("");
  const parent = { type: "tool" as const, id: toolId };

  if (!tool) {
    return (
      <>
        <h1 className="font-display text-2xl">Tool not found</h1>
        <Link to="/tools">Back to tools</Link>
      </>
    );
  }

  const related = (p: { type: string; id: string } | null) =>
    p?.type === "tool" && p.id === toolId;

  const move = (index: number, delta: number) => {
    const steps = [...tool.steps];
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const item = steps.splice(index, 1)[0];
    if (!item) return;
    steps.splice(target, 0, item);
    reorderSteps(toolId, steps);
  };

  return (
    <>
      <Link
        to="/tools"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft size={14} />
        Tools
      </Link>
      <PageHeader
        title={tool.name}
        actions={
          <>
            <Button onClick={() => setDialog("edit")}>
              <Pencil size={14} />
              Edit
            </Button>
            <Button
              title={tool.archivedAt ? "Restore tool" : "Archive tool"}
              onClick={() =>
                tool.archivedAt
                  ? useStore.getState().restoreItem("tool", toolId)
                  : archiveItem("tool", toolId)
              }
            >
              <Archive size={14} />
              {tool.archivedAt ? "Restore" : "Archive"}
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ToolStatusBadge status={tool.status} />
        <select
          aria-label="Tool status"
          value={tool.status}
          className={`${inputCls} w-auto`}
          onChange={(e) => updateTool(toolId, { status: e.target.value as typeof tool.status })}
        >
          {TOOL_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {tool.url && (
          <Button onClick={() => openUrl(tool.url)}>
            <ExternalLink size={14} />
            Website
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          {tool.category} {tool.cost}
        </span>
        <select
          aria-label="Tool rating"
          className={`${inputCls} w-auto`}
          value={tool.rating}
          onChange={(e) => updateTool(toolId, { rating: Number(e.target.value) })}
        >
          <option value={0}>Unrated</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} stars
            </option>
          ))}
        </select>
      </div>

      {tool.description && (
        <p className="mb-4 whitespace-pre-wrap text-muted-foreground">{tool.description}</p>
      )}
      <div className="mb-6 flex gap-1">
        {tool.tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>

      <section className="mb-8 border-t border-border pt-5">
        <h2 className="font-display text-lg font-semibold">Actionable steps</h2>
        <div className="my-3 flex gap-2">
          <input
            aria-label="New step"
            className={inputCls}
            placeholder="Next step…"
            value={step}
            onChange={(e) => setStep(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && step.trim()) {
                addStep(toolId, step.trim());
                setStep("");
              }
            }}
          />
          <Button
            disabled={!step.trim()}
            onClick={() => {
              addStep(toolId, step.trim());
              setStep("");
            }}
          >
            <Plus size={16} />
            Add
          </Button>
        </div>
        {tool.steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 border-b border-border py-2">
            <input
              aria-label={`Complete ${s.text}`}
              type="checkbox"
              checked={s.done}
              onChange={() => toggleStep(toolId, s.id)}
            />
            <span
              className={`min-w-0 flex-1 break-words text-sm ${
                s.done ? "line-through text-muted-foreground" : ""
              }`}
            >
              {s.text}
            </span>
            <Button
              variant="icon"
              title="Move step up"
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              <ArrowUp size={14} />
            </Button>
            <Button
              variant="icon"
              title="Move step down"
              disabled={i === tool.steps.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDown size={14} />
            </Button>
            <Button
              variant="icon"
              title="Remove step"
              onClick={() => removeStep(toolId, s.id)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        {["task", "note", "reminder"].map((kind) => (
          <section key={kind} className="border-t border-border pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">
                {kind === "task" ? "Tasks" : kind === "note" ? "Notes" : "Reminders"}
              </h2>
              <Button variant="icon" title={`Add ${kind}`} onClick={() => setDialog(kind)}>
                <Plus size={16} />
              </Button>
            </div>
            {kind === "task"
              ? data.tasks
                  .filter((t) => !t.archivedAt && related(t.parent))
                  .map((t) => (
                    <label key={t.id} className="mb-2 flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={t.status === "done"}
                        onChange={(e) =>
                          updateTask(t.id, { status: e.target.checked ? "done" : "todo" })
                        }
                      />
                      {t.title}
                    </label>
                  ))
              : kind === "note"
                ? data.notes
                    .filter((n) => !n.archivedAt && related(n.parent))
                    .map((n) => (
                      <div key={n.id} className="mb-3">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{n.body}</p>
                      </div>
                    ))
                : data.reminders
                    .filter((r) => !r.archivedAt && !r.done && related(r.parent))
                    .map((r) => (
                      <p key={r.id} className="mb-2 text-sm">
                        {r.title}{" "}
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.remindAt).toLocaleString()}
                        </span>
                      </p>
                    ))}
          </section>
        ))}

        <section className="border-t border-border pt-4">
          <h2 className="mb-3 font-display text-lg font-semibold">Linked URLs</h2>
          {data.links
            .filter((l) => !l.archivedAt && l.toolIds.includes(toolId))
            .map((l) => (
              <div key={l.id} className="mb-2 flex gap-2">
                <Button
                  variant="ghost"
                  className="min-w-0 flex-1 justify-start p-0 text-primary"
                  onClick={() => openUrl(l.url)}
                >
                  {l.title}
                </Button>
                <Button
                  variant="icon"
                  title="Detach link"
                  onClick={() =>
                    updateLink(l.id, { toolIds: l.toolIds.filter((id) => id !== toolId) })
                  }
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          <select
            aria-label="Attach saved link"
            className={inputCls}
            value=""
            onChange={(e) => {
              const link = data.links.find((l) => l.id === e.target.value);
              if (link) updateLink(link.id, { toolIds: [...link.toolIds, toolId] });
            }}
          >
            <option value="">Attach a saved link…</option>
            {data.links
              .filter((l) => !l.archivedAt && !l.toolIds.includes(toolId))
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
          </select>
        </section>
      </div>

      <ToolDialog open={dialog === "edit"} onOpenChange={(o) => !o && setDialog("")} tool={tool} />
      <TaskDialog
        open={dialog === "task"}
        onOpenChange={(o) => !o && setDialog("")}
        defaultParent={parent}
      />
      <NoteDialog
        open={dialog === "note"}
        onOpenChange={(o) => !o && setDialog("")}
        defaultParent={parent}
      />
      <ReminderDialog
        open={dialog === "reminder"}
        onOpenChange={(o) => !o && setDialog("")}
        defaultParent={parent}
      />
    </>
  );
}
