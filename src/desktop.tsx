import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  createRouter,
  createRoute,
  createRootRoute,
  createHashHistory,
  RouterProvider,
  Outlet,
  HeadContent,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AppShell } from "@/components/shell";
import { Dashboard } from "@/routes/index";
import { LinksPage } from "@/routes/links";
import "@/styles.css";
import { pageHead } from "@/lib/page-head";

const ToolsPage = lazy(() => import("@/routes/tools").then((m) => ({ default: m.ToolsPage })));
const ToolPage = lazy(() => import("@/routes/tools.$toolId").then((m) => ({ default: m.ToolPage })));
const TasksPage = lazy(() => import("@/routes/tasks").then((m) => ({ default: m.TasksPage })));
const NotesPage = lazy(() => import("@/routes/notes").then((m) => ({ default: m.NotesPage })));
const RemindersPage = lazy(() =>
  import("@/routes/reminders").then((m) => ({ default: m.RemindersPage })),
);
const MatchPage = lazy(() => import("@/routes/match").then((m) => ({ default: m.MatchPage })));
const ArchivePage = lazy(() => import("@/routes/archive").then((m) => ({ default: m.ArchivePage })));
const SettingsPage = lazy(() =>
  import("@/routes/settings").then((m) => ({ default: m.SettingsPage })),
);

const root = createRootRoute({
  component: () => (
    <>
      <HeadContent />
      <AppShell>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </AppShell>
      <Toaster richColors />
    </>
  ),
});

const toolsLayout = createRoute({
  getParentRoute: () => root,
  path: "tools",
  component: () => <Outlet />,
});

export const routeTree = root.addChildren([
  createRoute({
    getParentRoute: () => root,
    path: "/",
    component: Dashboard,
    head: () => pageHead("Dashboard", "Your personal Waymark workspace."),
  }),
  createRoute({
    getParentRoute: () => root,
    path: "links",
    component: LinksPage,
    head: () => pageHead("Links", "Your personal Waymark workspace."),
  }),
  toolsLayout.addChildren([
    createRoute({
      getParentRoute: () => toolsLayout,
      path: "/",
      component: ToolsPage,
      head: () => pageHead("Tools", "Evaluate, adopt and manage your personal toolkit."),
    }),
    createRoute({
      getParentRoute: () => toolsLayout,
      path: "$toolId",
      component: ToolPage,
      head: () => pageHead("Tool planner", "Your personal Waymark workspace."),
    }),
  ]),
  createRoute({
    getParentRoute: () => root,
    path: "tasks",
    component: TasksPage,
    head: () => pageHead("Tasks", "Your personal Waymark workspace."),
  }),
  createRoute({
    getParentRoute: () => root,
    path: "notes",
    component: NotesPage,
    head: () => pageHead("Notes", "Your personal Waymark workspace."),
  }),
  createRoute({
    getParentRoute: () => root,
    path: "reminders",
    component: RemindersPage,
    head: () => pageHead("Reminders", "Your personal Waymark workspace."),
  }),
  createRoute({
    getParentRoute: () => root,
    path: "match",
    component: MatchPage,
    head: () => pageHead("Match & Merge", "Your personal Waymark workspace."),
  }),
  createRoute({
    getParentRoute: () => root,
    path: "archive",
    component: ArchivePage,
    head: () => pageHead("Archive", "Your personal Waymark workspace."),
  }),
  createRoute({
    getParentRoute: () => root,
    path: "settings",
    component: SettingsPage,
    head: () => pageHead("Settings", "Your personal Waymark workspace."),
  }),
]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const target = document.getElementById("root");
if (target) createRoot(target).render(<RouterProvider router={router} />);
