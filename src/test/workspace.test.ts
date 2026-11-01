import { beforeEach, describe, expect, it } from "vitest";
import { emptyWorkspace, useStore } from "@/lib/store";
import { findDuplicateLinks, mergeLinks, pairKey, repointParents } from "@/lib/matching";
import { nextFire, addDays } from "@/lib/dates";
import { parseBookmarkFile } from "@/lib/bookmarks";
import { normalizeUrl, faviconUrl } from "@/lib/url";

beforeEach(() => {
  // Access through globalThis so we hit the live Web Storage installed in
  // setup.ts (a module-level `localStorage` binding would capture the value at
  // import time, before the shim is installed).
  (globalThis as any).localStorage.clear();
  useStore.setState({ data: emptyWorkspace(), undoStack: [], hydrated: false });
});

describe("Offline personal workspace", () => {
  it("reads saved work back after restarting the workspace", () => {
    useStore.getState().addLink({ url: "https://example.com/planner", title: "My planner" });
    useStore.setState({ data: emptyWorkspace(), hydrated: false });
    useStore.getState().hydrate();
    expect(useStore.getState().data.links[0]?.title).toBe("My planner");
  });

  it("archives, restores and undoes without losing a link", () => {
    const link = useStore.getState().addLink({ url: "https://example.com" });
    useStore.getState().archiveItem("link", link.id);
    expect(useStore.getState().data.links[0]?.archivedAt).toBeTruthy();
    useStore.getState().restoreItem("link", link.id);
    expect(useStore.getState().data.links[0]?.archivedAt).toBeNull();
    useStore.getState().deleteItem("link", link.id);
    useStore.getState().undo();
    expect(useStore.getState().data.links[0]?.id).toBe(link.id);
  });

  it("batches bulk link updates, archiving, and removal in a single undo step", () => {
    const a = useStore.getState().addLink({ url: "https://a.example.com" });
    const b = useStore.getState().addLink({ url: "https://b.example.com" });
    const stackBefore = useStore.getState().undoStack.length;

    useStore.getState().updateLinks([a.id, b.id], { status: "active" });
    expect(useStore.getState().undoStack.length).toBe(stackBefore + 1);
    expect(useStore.getState().data.links.every((l) => l.status === "active")).toBe(true);

    useStore.getState().archiveItems("link", [a.id, b.id]);
    expect(useStore.getState().undoStack.length).toBe(stackBefore + 2);
    expect(useStore.getState().data.links.every((l) => Boolean(l.archivedAt))).toBe(true);

    useStore.getState().removeItems("link", [a.id, b.id]);
    expect(useStore.getState().data.links).toHaveLength(0);
    useStore.getState().undo();
    expect(useStore.getState().data.links).toHaveLength(2);
  });

  it("keeps saved addresses away from third-party favicon services", () => {
    expect(faviconUrl("https://private.example.com/secret")).toBeNull();
  });
});

describe("Matching and merging", () => {
  it("finds canonical duplicates and respects dismissal in either direction", () => {
    const a = useStore.getState().addLink({ url: "https://www.example.com/page?utm_source=test" });
    const b = useStore.getState().addLink({ url: "https://example.com/page" });
    expect(findDuplicateLinks([a, b], []).map((p) => p.kind)).toEqual(["exact"]);
    expect(findDuplicateLinks([a, b], [pairKey(b.id, a.id)])).toEqual([]);
    expect(normalizeUrl(a.url)).toBe(normalizeUrl(b.url));
  });

  it("combines visits and tool links while preserving attached notes", () => {
    const a = useStore
      .getState()
      .addLink({ url: "https://example.com", visits: 2, toolIds: ["tool-a"] });
    const b = useStore
      .getState()
      .addLink({ url: "https://example.com/", visits: 3, toolIds: ["tool-a", "tool-b"] });
    useStore.getState().addNote({ title: "Keep this", parent: { type: "link", id: b.id } });
    const merged = mergeLinks(a, b, {
      keepId: a.id,
      title: a.title,
      url: a.url,
      description: "",
      tags: ["work", "work"],
      status: a.status,
      favorite: false,
    });
    expect(merged.visits).toBe(5);
    expect(merged.toolIds).toEqual(["tool-a", "tool-b"]);
    expect(merged.tags).toEqual(["work"]);
    expect(repointParents(useStore.getState().data, "link", b.id, "link", a.id).notes[0]?.parent?.id).toBe(
      a.id,
    );
  });
});

describe("Reminders and bookmarks", () => {
  it("skips weekends for weekday reminders", () => {
    const base = new Date(2026, 9, 23, 9, 0);
    const next = nextFire(base.toISOString(), "weekdays", base.getTime());
    expect(next).toBe(new Date(2026, 9, 26, 9, 0).toISOString());
  });

  it("clamps monthly reminders to the last available day", () => {
    const base = new Date(2024, 0, 31, 9, 0);
    expect(nextFire(base.toISOString(), "monthly", base.getTime())).toBe(
      new Date(2024, 1, 29, 9, 0).toISOString(),
    );
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("does not reschedule one-off reminders", () => {
    expect(nextFire("2026-10-26T09:00:00Z", "none")).toBeNull();
  });

  it("imports browser bookmarks with decoded titles and dates", () => {
    const items = parseBookmarkFile(
      '<DL><DT><A HREF="https://example.com" ADD_DATE="1704067200">Tools &amp; plans</A></DL>',
    );
    expect(items).toEqual([
      {
        url: "https://example.com/",
        title: "Tools & plans",
        addDate: "2024-01-01T00:00:00.000Z",
        folder: [],
      },
    ]);
  });
});
