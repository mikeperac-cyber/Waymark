import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import type { LinkItem } from "@/lib/types";
import { LINK_STATUSES } from "@/lib/types";
import { mergeLinks, repointParents, type MergeChoices } from "@/lib/matching";
import { useStore } from "@/lib/store";
import { Modal, btnPrimary, btnGhost, inputCls, labelCls, TagInput, Select } from "./common";
import { displayUrl } from "@/lib/url";
import { cn } from "@/lib/utils";

/**
 * Merge two links: pick which card wins each field, then the loser is
 * deleted or archived per the user's merge-mode setting.
 */
export function MergeDialog({
  open,
  onOpenChange,
  a,
  b,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  a: LinkItem;
  b: LinkItem;
}) {
  const mergeMode = useStore((s) => s.data.settings.mergeMode);
  const [keepId, setKeepId] = useState(a.id);
  const [choices, setChoices] = useState<MergeChoices | null>(null);

  useEffect(() => {
    if (!open) return;
    setKeepId(a.id);
    setChoices({
      keepId: a.id,
      url: a.url,
      title: a.title,
      description: a.description,
      tags: [...new Set([...a.tags, ...b.tags])],
      status: a.status,
      favorite: a.favorite || b.favorite,
    });
  }, [open, a, b]);

  if (!choices) return null;
  const keep = keepId === a.id ? a : b;
  const other = keepId === a.id ? b : a;

  const swap = () => {
    const nextKeep = other;
    setKeepId(nextKeep.id);
    setChoices({
      ...choices,
      keepId: nextKeep.id,
      url: nextKeep.url,
      title: nextKeep.title,
      description: nextKeep.description,
      status: nextKeep.status,
    });
  };

  const doMerge = () => {
    const merged = mergeLinks(keep, other, { ...choices, keepId });
    const data = repointParents(useStore.getState().data, "link", other.id, "link", keep.id);
    useStore.getState().replaceAll({
      ...data,
      links: data.links.flatMap((l) =>
        l.id === keep.id
          ? [merged]
          : l.id === other.id
            ? mergeMode === "archive"
              ? [{ ...l, archivedAt: new Date().toISOString() }]
              : []
            : [l],
      ),
    });
    onOpenChange(false);
  };

  const pickFrom = (source: LinkItem) =>
    setChoices({
      ...choices,
      url: source.url,
      title: source.title,
      description: source.description,
      status: source.status,
    });

  const Card = ({ item, isKeep }: { item: LinkItem; isKeep: boolean }) => (
    <button
      type="button"
      onClick={() => pickFrom(item)}
      className={cn(
        "flex-1 rounded-lg border p-3 text-left transition-colors",
        isKeep ? "border-primary bg-signal-soft/50" : "border-border bg-background hover:border-input",
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="eyebrow">{isKeep ? "Keeping" : "Merging in"}</span>
        {!isKeep && <span className="text-[10px] text-muted-foreground">click to copy its fields</span>}
      </div>
      <p className="truncate text-sm font-semibold">{item.title}</p>
      <p className="truncate font-mono text-xs text-muted-foreground">{displayUrl(item.url)}</p>
      {item.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">
        {item.visits} visits · {item.tags.length} tags
      </p>
    </button>
  );

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Merge two links" wide>
      <div className="space-y-4">
        <div className="flex items-stretch gap-2">
          <Card item={keep} isKeep />
          <button
            type="button"
            onClick={swap}
            className="self-center rounded-md border border-border p-2 text-muted-foreground hover:bg-muted"
            title="Swap which one is kept"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <Card item={other} isKeep={false} />
        </div>

        <div className="rounded-lg border border-border bg-background p-3">
          <p className="eyebrow mb-2">Result</p>
          <div className="space-y-2">
            <div>
              <span className={labelCls}>Title</span>
              <input
                className={inputCls}
                value={choices.title}
                onChange={(e) => setChoices({ ...choices, title: e.target.value })}
              />
            </div>
            <div>
              <span className={labelCls}>Address</span>
              <input
                className={inputCls}
                value={choices.url}
                onChange={(e) => setChoices({ ...choices, url: e.target.value })}
              />
            </div>
            <div>
              <span className={labelCls}>Description</span>
              <textarea
                className={inputCls}
                rows={2}
                value={choices.description}
                onChange={(e) => setChoices({ ...choices, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={labelCls}>Status</span>
                <Select
                  value={choices.status}
                  onChange={(v) => setChoices({ ...choices, status: v })}
                  options={LINK_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                />
              </div>
              <div>
                <span className={labelCls}>Tags (combined)</span>
                <TagInput tags={choices.tags} onChange={(tags) => setChoices({ ...choices, tags })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={choices.favorite}
                onChange={(e) => setChoices({ ...choices, favorite: e.target.checked })}
                className="h-4 w-4 accent-[var(--signal)]"
              />
              Keep as favorite
            </label>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Visits, tool links and the earliest creation date carry over. The other copy is{" "}
          {mergeMode === "archive" ? "moved to the archive" : "deleted"} — you can change that in Settings.
        </p>

        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={doMerge}>
            Merge links
          </button>
        </div>
      </div>
    </Modal>
  );
}
