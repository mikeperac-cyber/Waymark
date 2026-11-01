import { useMemo, useState } from "react";
import { StickyNote, Plus, Pin, Archive } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Note } from "@/lib/types";
import { PageHeader, Button, EmptyState, inputCls, Tag, useDebounced } from "@/components/common";
import { NoteDialog } from "@/components/dialogs";

export function NotesPage() {
  const { data, updateNote, archiveItem } = useStore();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);

  const notes = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return data.notes
      .filter(
        (n) =>
          !n.archivedAt &&
          (!q || `${n.title} ${n.body} ${n.tags.join(" ")}`.toLowerCase().includes(q)),
      )
      .sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt),
      );
  }, [data.notes, debouncedQuery]);

  return (
    <>
      <PageHeader
        title="Notes"
        count={notes.length}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus size={16} />
            New note
          </Button>
        }
      />
      <input
        aria-label="Search notes"
        className={`${inputCls} mb-5 max-w-sm`}
        placeholder="Search notes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!notes.length && <EmptyState icon={<StickyNote />} title="No notes here" body="" />}
      <div className="grid gap-4 md:grid-cols-2">
        {notes.map((n) => (
          <article key={n.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-2">
              <Button
                variant="ghost"
                className="min-w-0 flex-1 p-0 text-left text-foreground"
                onClick={() => {
                  setEditing(n);
                  setOpen(true);
                }}
              >
                {n.title}
              </Button>
              <Button
                variant="icon"
                title={n.pinned ? "Unpin note" : "Pin note"}
                onClick={() => updateNote(n.id, { pinned: !n.pinned })}
              >
                <Pin size={14} className={n.pinned ? "text-primary" : ""} />
              </Button>
              <Button
                variant="icon"
                title="Archive note"
                onClick={() => archiveItem("note", n.id)}
              >
                <Archive size={14} />
              </Button>
            </div>
            <p className="my-3 line-clamp-6 whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {n.body}
            </p>
            <div className="flex flex-wrap gap-1">
              {n.tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          </article>
        ))}
      </div>
      <NoteDialog open={open} onOpenChange={setOpen} note={editing} />
    </>
  );
}
