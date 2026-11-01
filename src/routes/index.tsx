import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Clock,
  Link2,
  ListChecks,
  Sparkles,
  Upload,
  Wrench,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { today, addDays, compareDates, formatDate, formatDateTime, relativeTime } from "@/lib/dates";
import { displayUrl, faviconUrl } from "@/lib/url";
import { openUrl } from "@/lib/platform";
import { TOOL_STATUSES } from "@/lib/types";
import { PageHeader, PriorityBadge, btnPrimary, btnSecondary } from "@/components/common";
import { LinkDialog, ToolDialog } from "@/components/dialogs";

function StatCard({
  label,
  value,
  to,
  icon,
}: {
  label: string;
  value: number;
  to: string;
  icon: React.ReactNode;
}) {
  return (
    <Link to={to} className="surface surface-interactive flex items-center gap-3 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-soft text-signal">
        {icon}
      </div>
      <div>
        <p className="font-display text-xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </Link>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Dashboard() {
  const data = useStore((s) => s.data);
  const [linkOpen, setLinkOpen] = useState(false);
  const [toolOpen, setToolOpen] = useState(false);

  const t = today();
  const weekAhead = addDays(t, 7);

  const {
    links,
    tools,
    tasks,
    reminders,
    openTasks,
    overdue,
    dueToday,
    remindersToday,
    upcoming,
    recentLinks,
  } = useMemo(() => {
    const activeLinks = data.links.filter((l) => !l.archivedAt);
    const activeTools = data.tools.filter((x) => !x.archivedAt);
    const activeTasks = data.tasks.filter((x) => !x.archivedAt);
    const activeReminders = data.reminders.filter((x) => !x.archivedAt && !x.done);

    const open = activeTasks.filter((x) => x.status !== "done");
    const overdueList = open.filter((x) => x.dueDate && compareDates(x.dueDate, t) < 0);
    const todayTasks = open.filter((x) => x.dueDate === t);
    const todayReminders = activeReminders.filter((r) => r.remindAt.slice(0, 10) <= t);
    const upcomingReminders = activeReminders
      .filter((r) => r.remindAt.slice(0, 10) > t && r.remindAt.slice(0, 10) <= weekAhead)
      .sort((a, b) => a.remindAt.localeCompare(b.remindAt))
      .slice(0, 6);
    const recent = [...activeLinks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

    return {
      links: activeLinks,
      tools: activeTools,
      tasks: activeTasks,
      reminders: activeReminders,
      openTasks: open,
      overdue: overdueList,
      dueToday: todayTasks,
      remindersToday: todayReminders,
      upcoming: upcomingReminders,
      recentLinks: recent,
    };
  }, [data.links, data.tools, data.tasks, data.reminders, t, weekAhead]);

  const empty =
    links.length + tools.length + tasks.length + data.notes.length + data.reminders.length === 0;

  if (empty) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <div className="dot-grid mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-signal-soft">
          <Sparkles className="h-9 w-9 text-signal" />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome to Waymark</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          One quiet place for the links you save, the tools you're trying, and the tasks, notes and
          reminders that go with them. Everything stays on this machine.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button className={btnPrimary} onClick={() => setLinkOpen(true)}>
            <Link2 className="h-4 w-4" /> Save your first link
          </button>
          <button className={btnSecondary} onClick={() => setToolOpen(true)}>
            <Wrench className="h-4 w-4" /> Add a tool
          </button>
          <Link to="/links" className={btnSecondary}>
            <Upload className="h-4 w-4" /> Import bookmarks
          </Link>
        </div>
        <LinkDialog open={linkOpen} onOpenChange={setLinkOpen} />
        <ToolDialog open={toolOpen} onOpenChange={setToolOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title={formatDate(t)}>
        <p className="text-sm text-muted-foreground">Here's what needs your attention.</p>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Saved links" value={links.length} to="/links" icon={<Link2 className="h-4 w-4" />} />
        <StatCard label="Tools tracked" value={tools.length} to="/tools" icon={<Wrench className="h-4 w-4" />} />
        <StatCard label="Open tasks" value={openTasks.length} to="/tasks" icon={<ListChecks className="h-4 w-4" />} />
        <StatCard label="Reminders set" value={reminders.length} to="/reminders" icon={<Bell className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Today"
          action={
            <Link to="/tasks" className="text-xs text-signal hover:underline">
              All tasks
            </Link>
          }
        >
          {dueToday.length === 0 && remindersToday.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nothing due today. Enjoy the calm.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {dueToday.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-2.5 rounded-md border border-border bg-background px-3 py-2"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--signal)]"
                    onChange={() => useStore.getState().updateTask(task.id, { status: "done" })}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                  <PriorityBadge priority={task.priority} />
                </li>
              ))}
              {remindersToday.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2.5 rounded-md border border-warning/30 bg-warning-soft px-3 py-2"
                >
                  <Clock className="h-4 w-4 shrink-0 text-warning" />
                  <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(r.remindAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title={overdue.length ? `Overdue (${overdue.length})` : "Overdue"}
          action={
            overdue.length > 0 && (
              <Link to="/tasks" className="text-xs text-signal hover:underline">
                Review
              </Link>
            )
          }
        >
          {overdue.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nothing overdue.</p>
          ) : (
            <ul className="space-y-1.5">
              {overdue.slice(0, 6).map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-2.5 rounded-md border border-destructive/25 bg-danger-soft px-3 py-2"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                  <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                  <span className="text-xs text-destructive">{formatDate(task.dueDate ?? today())}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Coming up"
          action={
            <Link to="/reminders" className="text-xs text-signal hover:underline">
              All reminders
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No reminders in the next week.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {upcoming.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2.5 rounded-md border border-border bg-background px-3 py-2"
                >
                  <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(r.remindAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Tool pipeline"
          action={
            <Link to="/tools" className="text-xs text-signal hover:underline">
              Open board
            </Link>
          }
        >
          {tools.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No tools yet.</p>
          ) : (
            <div className="space-y-2.5">
              <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                {TOOL_STATUSES.map((s) => {
                  const n = tools.filter((x) => x.status === s.value).length;
                  if (!n) return null;
                  return (
                    <div
                      key={s.value}
                      style={{
                        width: `${(n / tools.length) * 100}%`,
                        background: `var(--status-${s.value})`,
                      }}
                      title={`${s.label}: ${n}`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {TOOL_STATUSES.map((s) => {
                  const n = tools.filter((x) => x.status === s.value).length;
                  if (!n) return null;
                  return (
                    <span
                      key={s.value}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: `var(--status-${s.value})` }}
                      />
                      {s.label} · {n}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </Section>
      </div>

      <Section
        title="Recently saved links"
        action={
          <Link to="/links" className="flex items-center gap-1 text-xs text-signal hover:underline">
            All links <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        {recentLinks.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No links saved yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recentLinks.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => {
                    useStore
                      .getState()
                      .updateLink(l.id, { visits: l.visits + 1, lastVisitedAt: new Date().toISOString() });
                    openUrl(l.url);
                  }}
                  className="flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-muted/50"
                >
                  {faviconUrl(l.url) && (
                    <img
                      src={faviconUrl(l.url, 32) ?? undefined}
                      alt=""
                      className="h-4 w-4 shrink-0 rounded-sm"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.title}</span>
                  <span className="hidden truncate font-mono text-xs text-muted-foreground sm:block">
                    {displayUrl(l.url)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(l.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
