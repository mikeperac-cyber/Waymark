import { useMemo, useState } from "react";
import { GitMerge, Link2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { findDuplicateLinks, matchLinksToTools, pairKey, type DuplicatePair } from "@/lib/matching";
import { PageHeader, Button, EmptyState } from "@/components/common";
import { MergeDialog } from "@/components/merge-dialog";

export function MatchPage() {
  const { data, dismissMatch, updateLink } = useStore();
  const [pair, setPair] = useState<DuplicatePair | null>(null);

  const duplicates = useMemo(
    () => findDuplicateLinks(data.links, data.dismissedMatches),
    [data.links, data.dismissedMatches],
  );

  const matches = useMemo(() => {
    const dismissedSet = new Set(data.dismissedMatches);
    return matchLinksToTools(data.links, data.tools).filter(
      (m) => !dismissedSet.has(`lt:${pairKey(m.link.id, m.tool.id)}`),
    );
  }, [data.links, data.tools, data.dismissedMatches]);

  return (
    <>
      <PageHeader title="Match & Merge" count={duplicates.length + matches.length} />
      {!duplicates.length && !matches.length && (
        <EmptyState icon={<GitMerge />} title="Everything is in order" body="" />
      )}
      {duplicates.length > 0 && (
        <section className="mb-8">
          <h2 className="eyebrow mb-3">Potential duplicates</h2>
          {duplicates.map((p) => (
            <div
              key={pairKey(p.a.id, p.b.id)}
              className="flex flex-wrap items-center gap-3 border-b border-border py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">
                  {p.a.title} / {p.b.title}
                </p>
                <p className="break-all font-mono text-xs text-muted-foreground">{p.a.url}</p>
                <p className="break-all font-mono text-xs text-muted-foreground">{p.b.url}</p>
                <p className="mt-1 text-xs text-primary">{p.reason}</p>
              </div>
              <Button onClick={() => setPair(p)}>
                <GitMerge size={14} />
                Review merge
              </Button>
              <Button
                variant="icon"
                title="Dismiss duplicate suggestion"
                onClick={() => dismissMatch(pairKey(p.a.id, p.b.id))}
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </section>
      )}
      {matches.length > 0 && (
        <section>
          <h2 className="eyebrow mb-3">Link → tool matches</h2>
          {matches.map((m) => (
            <div
              key={pairKey(m.link.id, m.tool.id)}
              className="flex flex-wrap items-center gap-3 border-b border-border py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {m.link.title} → {m.tool.name}
                </p>
                <p className="text-xs text-muted-foreground">{m.reasons.join(" · ")}</p>
              </div>
              <Button
                onClick={() => updateLink(m.link.id, { toolIds: [...m.link.toolIds, m.tool.id] })}
              >
                <Link2 size={14} />
                Connect
              </Button>
              <Button
                variant="icon"
                title="Dismiss tool suggestion"
                onClick={() => dismissMatch(`lt:${pairKey(m.link.id, m.tool.id)}`)}
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </section>
      )}
      {pair && <MergeDialog open onOpenChange={(o) => !o && setPair(null)} a={pair.a} b={pair.b} />}
    </>
  );
}
