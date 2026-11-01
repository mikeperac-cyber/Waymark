import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Wrench, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { TOOL_STATUSES } from "@/lib/types";
import { pageHead } from "@/lib/page-head";
import { PageHeader, Button, EmptyState, inputCls, Tag, useDebounced } from "@/components/common";
import { ToolDialog } from "@/components/dialogs";

export function ToolsPage() {
  const data = useStore((s) => s.data);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query);
  const [open, setOpen] = useState(false);

  const tools = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return data.tools.filter(
      (t) =>
        !t.archivedAt &&
        (!q || `${t.name} ${t.category} ${t.tags.join(" ")}`.toLowerCase().includes(q)),
    );
  }, [data.tools, debouncedQuery]);

  return (
    <>
      <PageHeader
        title="Tools"
        count={tools.length}
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus size={16} />
            Add tool
          </Button>
        }
      />
      <input
        aria-label="Search tools"
        className={`${inputCls} mb-5 max-w-sm`}
        placeholder="Search tools…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!tools.length ? (
        <EmptyState
          icon={<Wrench />}
          title="Your toolkit starts here"
          body="Track tools you are evaluating, adopting, or using every day."
          actionLabel="Add a tool"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {TOOL_STATUSES.map((status) => {
            const colTools = tools.filter((t) => t.status === status.value);
            return (
              <section key={status.value}>
                <h2 className="eyebrow mb-3">
                  {status.label} · {colTools.length}
                </h2>
                <div className="space-y-3">
                  {colTools.map((t) => (
                    <Link
                      key={t.id}
                      to="/tools/$toolId"
                      params={{ toolId: t.id }}
                      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary"
                    >
                      <h3 className="font-display font-semibold">{t.name}</h3>
                      {t.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {t.description}
                        </p>
                      )}
                      {(t.category || t.cost) && (
                        <p className="my-2 text-xs text-muted-foreground">
                          {t.category}
                          {t.cost && (t.category ? ` · ${t.cost}` : t.cost)}
                        </p>
                      )}
                      {t.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {t.tags.map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                          ))}
                        </div>
                      )}
                      {t.steps.length > 0 && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          {t.steps.filter((s) => s.done).length}/{t.steps.length} steps complete
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <ToolDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export const toolsHead = () =>
  pageHead("Tools", "Evaluate, adopt and manage your personal toolkit.");
