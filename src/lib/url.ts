const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
  "ref_src",
  "ref_url",
  "si",
  "spm",
  "_hsenc",
  "_hsmi",
  "yclid",
]);

/** Adds a protocol when missing and validates. Returns null when the value cannot be a web URL. */
export function coerceUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let candidate = raw;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    if (/^(mailto|file):/i.test(candidate)) return candidate;
    candidate = `https://${candidate}`;
  }
  try {
    const u = new URL(candidate);
    if (!["http:", "https:", "ftp:", "file:"].includes(u.protocol)) return null;
    if (u.protocol.startsWith("http") && !u.hostname.includes(".") && u.hostname !== "localhost") {
      return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}

/** Canonical key used to detect duplicates: no protocol, no www, no tracking params, sorted query, no hash, no trailing slash. */
export function normalizeUrl(input: string): string {
  const coerced = coerceUrl(input) ?? input.trim();
  try {
    const u = new URL(coerced);
    const host = u.hostname.toLowerCase().replace(/^www\d?\./, "").replace(/^m\./, "");
    const params = [...u.searchParams.entries()]
      .filter(([k]) => !k.toLowerCase().startsWith("utm_") && !TRACKING_PARAMS.has(k.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b));
    const query = params.length
      ? `?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")}`
      : "";
    let path = u.pathname.replace(/\/+$/, "");
    path = path.replace(/\/index\.(html?|php)$/i, "");
    const port = u.port && u.port !== "80" && u.port !== "443" ? `:${u.port}` : "";
    return `${host}${port}${path}${query}`;
  } catch {
    return coerced.toLowerCase().replace(/\/+$/, "");
  }
}

/** host + path without the query string — catches "same page, different params". */
export function urlPageKey(input: string): string {
  const n = normalizeUrl(input);
  const q = n.indexOf("?");
  return q === -1 ? n : n.slice(0, q);
}

export function hostOf(input: string): string {
  try {
    const u = new URL(coerceUrl(input) ?? input);
    return u.hostname.toLowerCase().replace(/^www\d?\./, "");
  } catch {
    return "";
  }
}

const SECOND_LEVEL_TLDS = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);

/** Registrable-ish domain ("docs.github.com" -> "github.com"). Good enough for matching. */
export function rootDomain(input: string): string {
  const host = hostOf(input);
  if (!host) return "";
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const tld = parts[parts.length - 1] ?? "";
  const sld = parts[parts.length - 2] ?? "";
  if (tld.length === 2 && SECOND_LEVEL_TLDS.has(sld) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

export function displayUrl(input: string): string {
  try {
    const u = new URL(coerceUrl(input) ?? input);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : decodeURIComponent(u.pathname).replace(/\/$/, "");
    return `${host}${path}`;
  } catch {
    return input;
  }
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A readable title guessed from the URL itself, used when nothing better is available. */
export function guessTitle(input: string): string {
  try {
    const u = new URL(coerceUrl(input) ?? input);
    const host = u.hostname.replace(/^www\./, "");
    const segments = u.pathname
      .split("/")
      .map((s) => decodeURIComponent(s))
      .filter(Boolean);
    if (host === "github.com" && segments.length >= 2) {
      return `${segments[0]}/${segments[1]} · GitHub`;
    }
    if ((host === "youtube.com" || host === "m.youtube.com") && u.searchParams.get("v")) {
      return `YouTube video ${u.searchParams.get("v")}`;
    }
    const last = segments[segments.length - 1];
    if (last) {
      const cleaned = last
        .replace(/\.(html?|php|aspx?)$/i, "")
        .replace(/[-_+]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (cleaned && !/^\d+$/.test(cleaned) && cleaned.length > 2) {
        return `${titleCase(cleaned)} · ${host}`;
      }
    }
    const base = host.split(".").slice(-2, -1)[0] ?? host;
    return titleCase(base);
  } catch {
    return input;
  }
}

export function faviconUrl(_input: string, _size = 64): null {
  // Do not send a personal saved URL to a third-party favicon service.
  return null;
}

const URL_REGEX = /\b((?:https?:\/\/|www\.)[^\s<>"'`]+[^\s<>"'`.,;:!?)\]}])/gi;

/** Pulls every URL out of pasted text (one per line, or embedded in prose). */
export function extractUrls(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(URL_REGEX)) {
    const value = coerceUrl(match[1] ?? "");
    if (value) found.add(value);
  }
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || /\s/.test(t) || found.has(t)) continue;
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(t)) {
      const value = coerceUrl(t);
      if (value) found.add(value);
    }
  }
  return [...found];
}
