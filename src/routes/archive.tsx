import { useMemo, useState } from "react";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ItemType } from "@/lib/types";
import { COLLECTION, ITEM_LABEL } from "@/lib/types";
import { PageHeader, Button, EmptyState, ConfirmDialog, inputCls, useDebounced } from "@/components/common";

export function ArchivePage() {
  const { data, restoreItem, deleteItem } = useStore();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query);
  const [deleting, setDeleting] = useState<{ type: ItemType; id: string; title: string } | null>(
    null,
  );

  const items = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return (Object.keys(COLLECTION) as ItemType[])
      .flatMap((type) =>
        data[COLLECTION[type]]
          .filter((x) => x.archivedAt)
          .map((x) => ({
            type,
            id: x.id,
            title: "name" in x ? x.name : x.title,
            archivedAt: x.archivedAt ?? "",
          })),
      )
      .filter(
        (x) =>
          (filter === "all" || filter === x.type) && (!q || x.title.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  }, [data, filter, debouncedQuery]);

  return (
    <>
      <PageHeader title="Archive" count={items.length} />
      <div className="mb-5 flex gap-2">
        <input
          aria-label="Search archive"
          className={`${inputCls} max-w-sm`}
          placeholder="Search archive…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Archive type"
          className={`${inputCls} w-auto`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All types</option>
          {(Object.keys(ITEM_LABEL) as ItemType[]).map((t) => (
            <option key={t} value={t}>
              {ITEM_LABEL[t].many}
            </option>
          ))}
        </select>
      </div>
      {!items.length && <EmptyState icon={<Archive />} title="Archive is empty" body="" />}
      {items.map((x) => (
        <div key={`${x.type}:${x.id}`} className="flex items-center gap-3 border-b border-border py-3">
          <div className="min-w-0 flex-1">
            <p className="break-words font-medium">{x.title}</p>
            <p className="text-xs text-muted-foreground">
              {ITEM_LABEL[x.type].one} · {new Date(x.archivedAt).toLocaleDateString()}
            </p>
          </div>
          <Button title="Restore item" onClick={() => restoreItem(x.type, x.id)}>
            <RotateCcw size={14} />
            Restore
          </Button>
          <Button variant="icon" title="Delete forever" onClick={() => setDeleting(x)}>
            <Trash2 size={14} />
          </Button>
        </div>
      ))}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete permanently?"
        body={deleting?.title ?? ""}
        confirmLabel="Delete forever"
        onConfirm={() => {
          if (deleting) deleteItem(deleting.type, deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
}
