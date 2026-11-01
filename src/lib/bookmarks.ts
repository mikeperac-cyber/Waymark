import { coerceUrl } from "./url";

export interface ImportedBookmark {
  url: string;
  title: string;
  addDate: string | null;
  folder: string[];
}

/**
 * Parses a Netscape-format bookmark export (Chrome, Edge, Firefox).
 * Works on the HTML string; no DOM needed so it runs in tests too.
 */
export function parseBookmarkFile(html: string): ImportedBookmark[] {
  const out: ImportedBookmark[] = [];
  const folderStack: string[] = [];

  const tagRe = /<(h3|a|\/dl)\b([^>]*)>([\s\S]*?)(?=<|$)/gi;
  let m: RegExpExecArray | null;
  const dlDepths: number[] = [];
  let depth = 0;

  while ((m = tagRe.exec(html)) !== null) {
    const tag = (m[1] ?? "").toLowerCase();
    const attrs = m[2] ?? "";
    const inner = (m[3] ?? "").replace(/<[^>]+>/g, "").trim();

    if (tag === "h3") {
      folderStack.push(decodeEntities(inner));
      continue;
    }
    if (tag === "/dl") {
      depth = Math.max(0, depth - 1);
      if (dlDepths.length > depth) dlDepths.length = depth;
      if (folderStack.length > depth) folderStack.length = depth;
      continue;
    }
    if (tag === "a") {
      const href = attr(attrs, "href");
      if (!href) continue;
      const url = coerceUrl(decodeEntities(href));
      if (!url) continue;
      const addDateRaw = attr(attrs, "add_date");
      let addDate: string | null = null;
      if (addDateRaw) {
        const secs = Number(addDateRaw);
        if (Number.isFinite(secs) && secs > 0) addDate = new Date(secs * 1000).toISOString();
      }
      out.push({ url, title: decodeEntities(inner) || url, addDate, folder: [...folderStack] });
    }
  }
  return out;
}

function attr(attrs: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i");
  const m = re.exec(attrs);
  return m ? (m[1] ?? null) : null;
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
