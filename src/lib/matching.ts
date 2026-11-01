import type { LinkItem, Tool, WorkspaceData, ID, ParentRef, ItemType } from "./types";
import { normalizeUrl, rootDomain, hostOf } from "./url";
import { bigrams, diceFromSets, jaccardFromSets, tokens } from "./similarity";

export interface DuplicatePair {
  kind: "exact" | "page" | "similar";
  a: LinkItem;
  b: LinkItem;
  score: number;
  reason: string;
}

/** Dismissal key is order-independent so it survives either merge direction. */
export function pairKey(a: ID, b: ID): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

interface IndexedLink {
  item: LinkItem;
  norm: string;
  page: string;
  domain: string;
  titleBigrams: Set<string>;
  titleTokens: Set<string>;
}

/** Find duplicate or near-duplicate links with precomputed indices and O(1) dismissal lookup. */
export function findDuplicateLinks(links: LinkItem[], dismissed: string[]): DuplicatePair[] {
  const active = links.filter((l) => !l.archivedAt);
  if (active.length < 2) return [];

  const dismissedSet = new Set(dismissed);
  const pairs: DuplicatePair[] = [];

  const byNorm = new Map<string, LinkItem[]>();
  const byPage = new Map<string, LinkItem[]>();
  const byDomain = new Map<string, IndexedLink[]>();

  for (const l of active) {
    const norm = normalizeUrl(l.url);
    const qIdx = norm.indexOf("?");
    const page = qIdx === -1 ? norm : norm.slice(0, qIdx);
    const domain = rootDomain(l.url);

    let normGroup = byNorm.get(norm);
    if (!normGroup) {
      normGroup = [];
      byNorm.set(norm, normGroup);
    }
    normGroup.push(l);

    let pageGroup = byPage.get(page);
    if (!pageGroup) {
      pageGroup = [];
      byPage.set(page, pageGroup);
    }
    pageGroup.push(l);

    if (domain) {
      let domainGroup = byDomain.get(domain);
      if (!domainGroup) {
        domainGroup = [];
        byDomain.set(domain, domainGroup);
      }
      domainGroup.push({
        item: l,
        norm,
        page,
        domain,
        titleBigrams: bigrams(l.title),
        titleTokens: new Set(tokens(l.title)),
      });
    }
  }

  const seen = new Set<string>();
  for (const group of byNorm.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        const key = pairKey(a.id, b.id);
        seen.add(key);
        if (dismissedSet.has(key)) continue;
        pairs.push({ kind: "exact", a, b, score: 1, reason: "Same address" });
      }
    }
  }

  for (const group of byPage.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        const key = pairKey(a.id, b.id);
        if (seen.has(key)) continue;
        seen.add(key);
        if (dismissedSet.has(key)) continue;
        pairs.push({ kind: "page", a, b, score: 0.9, reason: "Same page, different parameters" });
      }
    }
  }

  // Title-similar pairs on the same domain using precomputed bigrams & token sets
  for (const group of byDomain.values()) {
    if (group.length < 2 || group.length > 200) continue;
    for (let i = 0; i < group.length; i++) {
      const a = group[i]!;
      for (let j = i + 1; j < group.length; j++) {
        const b = group[j]!;
        const key = pairKey(a.item.id, b.item.id);
        if (seen.has(key) || dismissedSet.has(key)) continue;
        const score = Math.max(
          diceFromSets(a.titleBigrams, b.titleBigrams),
          jaccardFromSets(a.titleTokens, b.titleTokens),
        );
        if (score >= 0.72) {
          seen.add(key);
          pairs.push({ kind: "similar", a: a.item, b: b.item, score, reason: "Very similar titles" });
        }
      }
    }
  }

  return pairs.sort((x, y) => y.score - x.score);
}

export interface LinkToolMatch {
  link: LinkItem;
  tool: Tool;
  score: number;
  reasons: string[];
}

/** Suggest tools a saved link probably belongs to using precomputed features. */
export function matchLinksToTools(links: LinkItem[], tools: Tool[]): LinkToolMatch[] {
  const activeLinks = links.filter((l) => !l.archivedAt);
  const activeTools = tools.filter((t) => !t.archivedAt);
  if (!activeLinks.length || !activeTools.length) return [];

  const preparedTools = activeTools.map((tool) => ({
    tool,
    host: hostOf(tool.url),
    domain: rootDomain(tool.url),
    nameBigrams: bigrams(tool.name),
    nameTokens: tokens(tool.name),
    nameTokenSet: new Set(tokens(tool.name)),
    tagSet: new Set(tool.tags),
  }));

  const matches: LinkToolMatch[] = [];

  for (const link of activeLinks) {
    const linkHost = hostOf(link.url);
    const linkDomain = linkHost ? rootDomain(link.url) : "";
    const titleBigrams = bigrams(link.title);
    const titleTokenSet = new Set(tokens(link.title));
    const descTokenSet = new Set(tokens(`${link.title} ${link.description}`));
    const linkTagSet = new Set(link.tags);
    const linkedToolSet = new Set(link.toolIds);

    for (const pt of preparedTools) {
      if (linkedToolSet.has(pt.tool.id)) continue;
      const reasons: string[] = [];
      let score = 0;

      if (linkHost && pt.host && linkDomain && linkDomain === pt.domain) {
        score += 0.6;
        reasons.push("Same website");
      }
      const tScore = Math.max(
        diceFromSets(titleBigrams, pt.nameBigrams),
        jaccardFromSets(titleTokenSet, pt.nameTokenSet),
      );
      if (tScore >= 0.6) {
        score += tScore * 0.5;
        reasons.push("Similar names");
      }
      const tagOverlap = jaccardFromSets(linkTagSet, pt.tagSet);
      if (tagOverlap > 0) {
        score += tagOverlap * 0.3;
        reasons.push("Shared tags");
      }
      if (pt.nameTokens.length && pt.nameTokens.every((t) => descTokenSet.has(t))) {
        score += 0.25;
        reasons.push("Name appears in the link text");
      }

      if (score >= 0.55) matches.push({ link, tool: pt.tool, score, reasons });
    }
  }
  return matches.sort((a, b) => b.score - a.score);
}

export type MergeField = "title" | "description" | "tags" | "status" | "favorite" | "url";

export interface MergeChoices {
  keepId: ID;
  title: string;
  description: string;
  tags: string[];
  status: LinkItem["status"];
  favorite: boolean;
  url: string;
}

/** Merge link `other` into the kept link per user choices. Returns the merged link. */
export function mergeLinks(keep: LinkItem, other: LinkItem, choices: MergeChoices): LinkItem {
  return {
    ...keep,
    url: choices.url,
    title: choices.title,
    description: choices.description,
    tags: [...new Set([...choices.tags])],
    status: choices.status,
    favorite: choices.favorite,
    toolIds: [...new Set([...keep.toolIds, ...other.toolIds])],
    visits: keep.visits + other.visits,
    lastVisitedAt:
      keep.lastVisitedAt && other.lastVisitedAt
        ? keep.lastVisitedAt > other.lastVisitedAt
          ? keep.lastVisitedAt
          : other.lastVisitedAt
        : (keep.lastVisitedAt ?? other.lastVisitedAt),
    createdAt: keep.createdAt < other.createdAt ? keep.createdAt : other.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

/** Re-point every parent reference in the workspace from `fromId` to `toId`. */
export function repointParents(
  data: WorkspaceData,
  fromType: ItemType,
  fromId: ID,
  toType: ItemType,
  toId: ID,
): WorkspaceData {
  const fix = (p: ParentRef | null): ParentRef | null =>
    p && p.type === fromType && p.id === fromId ? { type: toType as ParentRef["type"], id: toId } : p;
  return {
    ...data,
    tasks: data.tasks.map((t) => ({ ...t, parent: fix(t.parent) })),
    notes: data.notes.map((n) => ({ ...n, parent: fix(n.parent) })),
    reminders: data.reminders.map((r) => ({ ...r, parent: fix(r.parent) })),
  };
}
