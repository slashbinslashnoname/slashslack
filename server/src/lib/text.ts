/** Pure text helpers — no DB or IO, so they are trivially unit-testable. */

const MENTION_RE = /<@(\d+)>/g;
const BROADCAST_RE = /(^|\s)@(channel|everyone|here)\b/i;
const URL_RE = /\bhttps?:\/\/[^\s<>]+/gi;

export function parseMentions(body: string): number[] {
  const ids = new Set<number>();
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(body))) ids.add(Number(m[1]));
  return [...ids];
}

export function hasBroadcastMention(body: string): boolean {
  return BROADCAST_RE.test(body);
}

export function plainPreview(body: string, max = 120): string {
  const text = body.replace(MENTION_RE, "@user").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function extractUrls(body: string): string[] {
  const found = body.match(URL_RE) || [];
  return [...new Set(found)].slice(0, 3); // cap per message
}

/** Build a safe FTS5 MATCH expression: each term quoted as a prefix match. */
export function buildFtsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, "")}"*`)
    .join(" ");
}
