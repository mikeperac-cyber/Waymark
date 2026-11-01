import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ClipboardPaste,
  Link2,
  Pencil,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { LinkItem, LinkStatus } from "@/lib/types";
import { LINK_STATUSES } from "@/lib/types";
import { displayUrl, extractUrls, faviconUrl } from "@/lib/url";
import { parseBookmarkFile } from "@/lib/bookmarks";
import { openUrl } from "@/lib/platform";
import { relativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  PageHeader,
  EmptyState,
  Modal,
  LinkStatusBadge,
  Tag,
  btnPrimary,
  btnSecondary,
  btnGhost,
  btnIcon,
  inputCls,
  useDebounced,
  ConfirmDialog,
} from "@/components/common";
import { LinkDialog } from "@/components/dialogs";

type SortKey = "newest" | "title" | "visits";

function BulkPasteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [text, setText] = useState("");
  const found = useMemo(() => extractUrls(text), [text]);

  const importAll = () => {
    const added = useStore.getState().addLinks(found.map((url) => ({ url })));
    toast.success(
      added ? `Saved ${added} new link${added === 1 ? "" : "s"}` : "All of those were already saved",
    );
    setText("");
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Paste a batch of links" wide>
      <p className="mb-2 text-sm text-muted-foreground">
        Paste anything — a list, an email, a document. Waymark pulls out every web address it finds.
      </p>
      <textarea
        className={inputCls}
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"https://example.com\nhttps://another-site.org/article\n…"}
        autoFocus
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {found.length
            ? `${found.length} address${found.length === 1 ? "" : "es"} found`
            : "No addresses found yet"}
        </span>
        <div className="flex gap-2">
          <button className={btnGhost} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button className={btnPrimary} disabled={!found.length} onClick={importAll}>
            Save {found.length || ""} link{found.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function LinkRow({
  link,
  selected,
  onSelect,
  onEdit,
}: {
  link: LinkItem;
  selected: boolean;
  onSelect: (on: boolean) => void;
  onEdit: () => void;
}) {
  const { updateLink, archiveItem } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const visit = () => {
    updateLink(link.id, { visits: link.visits + 1, lastVisitedAt: new Date().toISOString() });
    openUrl(link.url);
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors",
        selected && "border-primary bg-signal-soft/40",
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-[var(--signal)]"
      />
      <button
        onClick={() => updateLink(link.id, { favorite: !link.favorite })}
        className={cn(
          "shrink-0 text-muted-foreground/50 hover:text-warning",
          link.favorite && "text-warning",
        )}
        title={link.favorite ? "Remove favorite" : "Mark favorite"}
      >
        <Star className={cn("h-4 w-4", link.favorite && "fill-warning")} />
      </button>
      {faviconUrl(link.url) && (
        <img
          src={faviconUrl(link.url, 32) ?? undefined}
          alt=""
          className="h-4 w-4 shrink-0 rounded-sm"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
      )}
      <button onClick={visit} className="min-w-0 flex-1 text-left" title="Open in browser">
        <p className="truncate text-sm font-medium hover:text-signal">{link.title}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{displayUrl(link.url)}</p>
      </button>
      {link.description && (
        <p className="hidden max-w-48 truncate text-xs text-muted-foreground xl:block">
          {link.description}
        </p>
      )}
      <div className="hidden shrink-0 gap-1 md:flex">
        {link.tags.slice(0, 3).map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>
      <LinkStatusBadge status={link.status} />
      <span className="hidden w-16 shrink-0 text-right text-[11px] text-muted-foreground lg:block">
        {link.visits > 0 ? `${link.visits}× · ` : ""}
        {relativeTime(link.createdAt)}
      </span>
      <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
        <button className={btnIcon} onClick={onEdit} title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button className={btnIcon} onClick={() => archiveItem("link", link.id)} title="Archive">
          <Archive className="h-3.5 w-3.5" />
        </button>
        <button
          className={cn(btnIcon, "hover:text-destructive")}
          onClick={() => setConfirmDelete(true)}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this link?"
        body={`“${link.title}” will be deleted forever. Archiving keeps it out of the way instead.`}
        onConfirm={() => useStore.getState().deleteItem("link", link.id)}
      />
    </div>
  );
}

export function LinksPage() {
  const links = useStore((s) => s.data.links);
  const [q, setQ] = useState("");
  const query = useDebounced(q);
  const [status, setStatus] = useState<"all" | LinkStatus>("all");
  const [tag, setTag] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [editing, setEditing] = useState<LinkItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = useMemo(() => links.filter((l) => !l.archivedAt), [links]);
  const allTags = useMemo(() => [...new Set(active.flatMap((l) => l.tags))].sort(), [active]);

  const filtered = useMemo(() => {
    let out = active;
    if (status !== "all") out = out.filter((l) => l.status === status);
    if (tag) out = out.filter((l) => l.tags.includes(tag));
    if (favOnly) out = out.filter((l) => l.favorite);
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      out = out.filter(
        (l) =>
          l.title.toLowerCase().includes(needle) ||
          l.url.toLowerCase().includes(needle) ||
          l.description.toLowerCase().includes(needle) ||
          l.tags.some((t) => t.includes(needle)),
      );
    }
    const sorted = [...out];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "visits") sorted.sort((a, b) => b.visits - a.visits);
    else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [active, status, tag, favOnly, query, sort]);

  const toggleAll = (on: boolean) => setSelected(on ? new Set(filtered.map((l) => l.id)) : new Set());

  const importBookmarks = async (file: File) => {
    try {
      const parsed = parseBookmarkFile(await file.text());
      if (!parsed.length) {
        toast.error("No bookmarks found in that file");
        return;
      }
      const added = useStore.getState().addLinks(
        parsed.map((b) => ({
          url: b.url,
          title: b.title,
          tags: b.folder.map((f) => f.toLowerCase()),
          ...(b.addDate ? { createdAt: b.addDate } : {}),
        })),
      );
      toast.success(`Imported ${added} of ${parsed.length} bookmarks (duplicates skipped)`);
    } catch {
      toast.error("Could not read that file");
    }
  };

  return (
    <div>
      <PageHeader
        title="Links"
        count={active.length}
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".html,.htm"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importBookmarks(f);
                e.target.value = "";
              }}
            />
            <button className={btnSecondary} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Import bookmarks
            </button>
            <button className={btnSecondary} onClick={() => setPasteOpen(true)}>
              <ClipboardPaste className="h-4 w-4" /> Bulk paste
            </button>
            <button className={btnPrimary} onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add link
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className={cn(inputCls, "max-w-xs")}
          placeholder="Search links…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className={cn(inputCls, "w-auto")}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="all">All statuses</option>
          {LINK_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select
            className={cn(inputCls, "w-auto")}
            value={tag ?? ""}
            onChange={(e) => setTag(e.target.value || null)}
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        )}
        <button
          className={cn(btnSecondary, favOnly && "border-warning bg-warning-soft text-warning")}
          onClick={() => setFavOnly((v) => !v)}
        >
          <Star className={cn("h-4 w-4", favOnly && "fill-warning")} /> Favorites
        </button>
        <select
          className={cn(inputCls, "w-auto")}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="newest">Newest first</option>
          <option value="title">By title</option>
          <option value="visits">Most visited</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="surface mb-3 flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <select
            className={cn(inputCls, "w-auto py-1 text-xs")}
            value=""
            onChange={(e) => {
              const v = e.target.value as LinkStatus;
              if (!v) return;
              useStore.getState().updateLinks([...selected], { status: v });
              setSelected(new Set());
              toast.success("Status updated");
            }}
          >
            <option value="">Set status…</option>
            {LINK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            className={btnGhost}
            onClick={() => {
              useStore.getState().archiveItems("link", [...selected]);
              setSelected(new Set());
              toast.success("Archived");
            }}
          >
            <Archive className="h-4 w-4" /> Archive
          </button>
          <button
            className={cn(btnGhost, "text-destructive hover:text-destructive")}
            onClick={() => {
              useStore.getState().removeItems("link", [...selected]);
              setSelected(new Set());
              toast.success("Deleted");
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
          <button className={btnGhost} onClick={() => setSelected(new Set())}>
            <X className="h-4 w-4" /> Clear
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Link2 className="h-6 w-6" />}
          title={active.length ? "Nothing matches those filters" : "No links yet"}
          body={
            active.length
              ? "Try a different search or clear the filters."
              : "Save links one at a time, paste a whole batch, or import your browser bookmarks."
          }
          actionLabel={active.length ? undefined : "Add your first link"}
          onAction={active.length ? undefined : () => setAddOpen(true)}
        />
      ) : (
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 px-3 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--signal)]"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={(e) => toggleAll(e.target.checked)}
            />
            Select all
          </label>
          {filtered.map((l) => (
            <LinkRow
              key={l.id}
              link={l}
              selected={selected.has(l.id)}
              onSelect={(on) => {
                const next = new Set(selected);
                if (on) next.add(l.id);
                else next.delete(l.id);
                setSelected(next);
              }}
              onEdit={() => setEditing(l)}
            />
          ))}
        </div>
      )}

      <LinkDialog open={addOpen} onOpenChange={setAddOpen} />
      <LinkDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} link={editing} />
      <BulkPasteDialog open={pasteOpen} onOpenChange={setPasteOpen} />
    </div>
  );
}
