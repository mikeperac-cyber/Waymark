import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Link2,
  Wrench,
  ListChecks,
  Bell,
  StickyNote,
  GitMerge,
  Archive,
  Settings as SettingsIcon,
  Search,
  Plus,
  Undo2,
  Minus,
  Square,
  Copy,
  X,
  Star,
  Download,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { findDuplicateLinks } from "@/lib/matching";
import { isElectron, bridge, openUrl } from "@/lib/platform";
import { displayUrl } from "@/lib/url";
import { serializeWorkspace, downloadTextFile } from "@/lib/backup";
import { today, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { LinkDialog, ToolDialog, TaskDialog, NoteDialog, ReminderDialog } from "./dialogs";
import { useReminderScheduler } from "@/hooks/use-reminder-scheduler";
import logo from "@/assets/logo.png";

type DialogKind = "link" | "tool" | "task" | "note" | "reminder";

/* ---------- Electron title bar ---------- */

function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const b = bridge();

  useEffect(() => {
    if (!b) return;
    void b.isMaximized().then(setMaximized);
    return b.onMaximizedChange(setMaximized);
  }, [b]);

  if (!b) return null;
  return (
    <div className="app-drag flex h-9 shrink-0 select-none items-center justify-between bg-sidebar pl-3 text-sidebar-foreground">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide">
        <img src={logo} alt="" className="h-4 w-4 rounded-sm" />
        Waymark
      </div>
      <div className="app-no-drag flex h-full items-stretch">
        <button onClick={b.minimize} className="px-3.5 hover:bg-sidebar-accent" title="Minimize">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button onClick={b.maximizeToggle} className="px-3.5 hover:bg-sidebar-accent" title="Maximize">
          {maximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </button>
        <button
          onClick={b.close}
          className="px-3.5 hover:bg-destructive hover:text-destructive-foreground"
          title="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ---------- Sidebar ---------- */

function NavItem({
  to,
  exact,
  icon,
  label,
  count,
}: {
  to: string;
  exact?: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: exact ?? false }}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof count === "number" && count > 0 && (
        <span className="font-mono text-[11px] text-sidebar-muted">{count}</span>
      )}
    </Link>
  );
}

function Sidebar({
  onSearch,
  onQuickAdd,
}: {
  onSearch: () => void;
  onQuickAdd: (k: DialogKind) => void;
}) {
  const data = useStore((s) => s.data);
  const [addOpen, setAddOpen] = useState(false);

  const dupCount = useMemo(
    () => findDuplicateLinks(data.links, data.dismissedMatches).length,
    [data.links, data.dismissedMatches],
  );

  const counts = useMemo(() => {
    let links = 0;
    let tools = 0;
    let tasks = 0;
    let reminders = 0;
    let notes = 0;
    let archived = 0;

    for (const l of data.links) {
      if (l.archivedAt) archived++;
      else links++;
    }
    for (const t of data.tools) {
      if (t.archivedAt) archived++;
      else tools++;
    }
    for (const t of data.tasks) {
      if (t.archivedAt) archived++;
      else if (t.status !== "done") tasks++;
    }
    for (const r of data.reminders) {
      if (r.archivedAt) archived++;
      else if (!r.done) reminders++;
    }
    for (const n of data.notes) {
      if (n.archivedAt) archived++;
      else notes++;
    }

    return { links, tools, tasks, reminders, notes, archived };
  }, [data.links, data.tools, data.tasks, data.reminders, data.notes]);

  const quickAdd: { kind: DialogKind; label: string; icon: ReactNode }[] = [
    { kind: "link", label: "New link", icon: <Link2 className="h-4 w-4" /> },
    { kind: "tool", label: "New tool", icon: <Wrench className="h-4 w-4" /> },
    { kind: "task", label: "New task", icon: <ListChecks className="h-4 w-4" /> },
    { kind: "reminder", label: "New reminder", icon: <Bell className="h-4 w-4" /> },
    { kind: "note", label: "New note", icon: <StickyNote className="h-4 w-4" /> },
  ];

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-4 pb-2 pt-4">
        <img src={logo} alt="Waymark" className="h-7 w-7 rounded-md" />
        <div>
          <p className="font-display text-sm font-bold leading-tight">Waymark</p>
          <p className="text-[10px] text-sidebar-muted">{formatDate(today())}</p>
        </div>
      </div>

      <div className="relative px-3 py-2">
        <button
          onClick={() => setAddOpen((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-sidebar-primary px-3 py-1.5 text-sm font-medium text-sidebar-primary-foreground transition-colors hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Quick add
        </button>
        {addOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setAddOpen(false)} />
            <div className="absolute left-3 right-3 top-full z-40 mt-1 overflow-hidden rounded-md border border-sidebar-border bg-popover py-1 text-popover-foreground shadow-lift">
              {quickAdd.map((q) => (
                <button
                  key={q.kind}
                  onClick={() => {
                    setAddOpen(false);
                    onQuickAdd(q.kind);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {q.icon}
                  {q.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button
        onClick={onSearch}
        className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-sidebar-border px-2.5 py-1.5 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <span className="sidebar-kbd">Ctrl K</span>
      </button>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3">
        <NavItem to="/" exact icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
        <NavItem to="/links" icon={<Link2 className="h-4 w-4" />} label="Links" count={counts.links} />
        <NavItem to="/tools" icon={<Wrench className="h-4 w-4" />} label="Tools" count={counts.tools} />
        <NavItem to="/tasks" icon={<ListChecks className="h-4 w-4" />} label="Tasks" count={counts.tasks} />
        <NavItem
          to="/reminders"
          icon={<Bell className="h-4 w-4" />}
          label="Reminders"
          count={counts.reminders}
        />
        <NavItem
          to="/notes"
          icon={<StickyNote className="h-4 w-4" />}
          label="Notes"
          count={counts.notes}
        />
        <div className="my-2 border-t border-sidebar-border" />
        <NavItem
          to="/match"
          icon={<GitMerge className="h-4 w-4" />}
          label="Match & Merge"
          count={dupCount}
        />
        <NavItem
          to="/archive"
          icon={<Archive className="h-4 w-4" />}
          label="Archive"
          count={counts.archived}
        />
      </nav>

      <div className="space-y-0.5 border-t border-sidebar-border p-3">
        <button
          onClick={() => {
            if (useStore.getState().canUndo()) {
              useStore.getState().undo();
              toast("Undone");
            }
          }}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Undo2 className="h-4 w-4" />
          <span className="flex-1 text-left">Undo</span>
          <span className="sidebar-kbd">Ctrl Z</span>
        </button>
        <NavItem to="/settings" icon={<SettingsIcon className="h-4 w-4" />} label="Settings" />
      </div>
    </aside>
  );
}

/* ---------- Command palette ---------- */

function Palette({
  open,
  onOpenChange,
  openDialog,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openDialog: (k: DialogKind) => void;
}) {
  const navigate = useNavigate();
  const data = useStore((s) => s.data);

  if (!open) return null;

  const go = (to: string) => {
    onOpenChange(false);
    void navigate({ to });
  };
  const act = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const itemCls =
    "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm aria-selected:bg-muted";

  const links = data.links.filter((l) => !l.archivedAt).slice(0, 50);
  const tools = data.tools.filter((t) => !t.archivedAt);
  const tasks = data.tasks.filter((t) => !t.archivedAt && t.status !== "done").slice(0, 30);
  const notes = data.notes.filter((n) => !n.archivedAt).slice(0, 30);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="mx-auto mt-[10vh] w-[calc(100vw-2rem)] max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="surface overflow-hidden" label="Command palette" loop>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              autoFocus
              placeholder="Search everything, or start something new…"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <Command.List className="max-h-[55vh] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              Nothing matches that.
            </Command.Empty>

            <Command.Group heading={<span className="eyebrow px-2.5">Do</span>}>
              <Command.Item
                value="new link save url"
                onSelect={() => act(() => openDialog("link"))}
                className={itemCls}
              >
                <Link2 className="h-4 w-4 text-muted-foreground" /> New link
              </Command.Item>
              <Command.Item
                value="new tool"
                onSelect={() => act(() => openDialog("tool"))}
                className={itemCls}
              >
                <Wrench className="h-4 w-4 text-muted-foreground" /> New tool
              </Command.Item>
              <Command.Item
                value="new task"
                onSelect={() => act(() => openDialog("task"))}
                className={itemCls}
              >
                <ListChecks className="h-4 w-4 text-muted-foreground" /> New task
              </Command.Item>
              <Command.Item
                value="new reminder alarm"
                onSelect={() => act(() => openDialog("reminder"))}
                className={itemCls}
              >
                <Bell className="h-4 w-4 text-muted-foreground" /> New reminder
              </Command.Item>
              <Command.Item
                value="new note write"
                onSelect={() => act(() => openDialog("note"))}
                className={itemCls}
              >
                <StickyNote className="h-4 w-4 text-muted-foreground" /> New note
              </Command.Item>
              <Command.Item
                value="export backup download json"
                onSelect={() =>
                  act(() => {
                    downloadTextFile(
                      `waymark-backup-${today()}.json`,
                      serializeWorkspace(useStore.getState().data),
                    );
                    toast.success("Backup downloaded");
                  })
                }
                className={itemCls}
              >
                <Download className="h-4 w-4 text-muted-foreground" /> Export backup
              </Command.Item>
            </Command.Group>

            <Command.Group heading={<span className="eyebrow px-2.5">Go to</span>}>
              {[
                ["/", "Dashboard"],
                ["/links", "Links"],
                ["/tools", "Tools"],
                ["/tasks", "Tasks"],
                ["/reminders", "Reminders"],
                ["/notes", "Notes"],
                ["/match", "Match & Merge"],
                ["/archive", "Archive"],
                ["/settings", "Settings"],
              ].map(([to, label]) => (
                <Command.Item
                  key={to}
                  value={`go to ${label}`}
                  onSelect={() => {
                    if (to) go(to);
                  }}
                  className={itemCls}
                >
                  <LayoutDashboard className="h-4 w-4 text-muted-foreground" /> {label}
                </Command.Item>
              ))}
            </Command.Group>

            {links.length > 0 && (
              <Command.Group heading={<span className="eyebrow px-2.5">Links</span>}>
                {links.map((l) => (
                  <Command.Item
                    key={l.id}
                    value={`link ${l.title} ${l.url} ${l.tags.join(" ")}`}
                    onSelect={() =>
                      act(() => {
                        useStore
                          .getState()
                          .updateLink(l.id, { visits: l.visits + 1, lastVisitedAt: new Date().toISOString() });
                        openUrl(l.url);
                      })
                    }
                    className={itemCls}
                  >
                    {l.favorite ? (
                      <Star className="h-4 w-4 shrink-0 fill-warning text-warning" />
                    ) : (
                      <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{l.title}</span>
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      {displayUrl(l.url)}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {tools.length > 0 && (
              <Command.Group heading={<span className="eyebrow px-2.5">Tools</span>}>
                {tools.map((t) => (
                  <Command.Item
                    key={t.id}
                    value={`tool ${t.name} ${t.category} ${t.tags.join(" ")}`}
                    onSelect={() => {
                      onOpenChange(false);
                      void navigate({ to: "/tools/$toolId", params: { toolId: t.id } });
                    }}
                    className={itemCls}
                  >
                    <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {t.category && (
                      <span className="text-[11px] text-muted-foreground">{t.category}</span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {tasks.length > 0 && (
              <Command.Group heading={<span className="eyebrow px-2.5">Open tasks</span>}>
                {tasks.map((t) => (
                  <Command.Item
                    key={t.id}
                    value={`task ${t.title}`}
                    onSelect={() =>
                      act(() => {
                        useStore.getState().updateTask(t.id, { status: "done" });
                        toast.success("Task done");
                      })
                    }
                    className={itemCls}
                  >
                    <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <span className="text-[11px] text-muted-foreground">mark done</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {notes.length > 0 && (
              <Command.Group heading={<span className="eyebrow px-2.5">Notes</span>}>
                {notes.map((n) => (
                  <Command.Item
                    key={n.id}
                    value={`note ${n.title} ${n.tags.join(" ")}`}
                    onSelect={() => go("/notes")}
                    className={itemCls}
                  >
                    <StickyNote className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{n.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

/* ---------- Shell ---------- */

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | undefined>();

  useReminderScheduler();

  useEffect(() => {
    useStore.getState().hydrate();
    const b = bridge();
    const settings = useStore.getState().data.settings;
    b?.setCloseToTray(settings.closeToTray);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const target = e.target as HTMLElement | null;
        if (target?.closest("input, textarea, select, [contenteditable]")) return;
        if (useStore.getState().canUndo()) {
          e.preventDefault();
          useStore.getState().undo();
          toast("Undone");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const b = bridge();
    if (!b) return;
    return b.onOpenUrl((url) => {
      setPendingUrl(url);
      setDialog("link");
    });
  }, []);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <img src={logo} alt="Waymark" className="h-12 w-12 animate-pulse rounded-xl" />
      </div>
    );
  }

  const closeDialog = (o: boolean) => {
    if (!o) {
      setDialog(null);
      setPendingUrl(undefined);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {isElectron() && <TitleBar />}
      <div className="flex min-h-0 flex-1">
        <Sidebar onSearch={() => setPaletteOpen(true)} onQuickAdd={setDialog} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className={cn("mx-auto max-w-6xl px-6 py-6")}>{children}</div>
        </main>
      </div>

      <Palette open={paletteOpen} onOpenChange={setPaletteOpen} openDialog={setDialog} />

      <LinkDialog open={dialog === "link"} onOpenChange={closeDialog} defaultUrl={pendingUrl} />
      <ToolDialog open={dialog === "tool"} onOpenChange={closeDialog} />
      <TaskDialog open={dialog === "task"} onOpenChange={closeDialog} />
      <NoteDialog open={dialog === "note"} onOpenChange={closeDialog} />
      <ReminderDialog open={dialog === "reminder"} onOpenChange={closeDialog} />
    </div>
  );
}
