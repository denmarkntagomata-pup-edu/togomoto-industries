// Markdown → sanitised HTML for announcement bodies (spec §5.8, AGENTS.md §4,
// PLAN P2-5). Pipeline: marked (Markdown → HTML) → ultrahtml sanitize (element +
// attribute allowlist) → a custom transformer that strips unsafe URL schemes from
// links/images. Both deps are pure JS with no Node built-ins, so nodejs_compat
// stays OFF (AGENTS.md §11). NEVER output raw admin HTML — always run this.
import { marked } from 'marked';
import { ELEMENT_NODE, transform, walkSync, type Node } from 'ultrahtml';
import sanitize from 'ultrahtml/transformers/sanitize';

// GitHub-flavoured Markdown; no raw-HTML passthrough surprises — the sanitiser is
// the authority regardless, but keep marked's output predictable.
marked.setOptions({ gfm: true, breaks: false });

// Element + attribute allowlist. Anything not listed is dropped (attributes) or
// removed (elements). No script/style/iframe/on* — none are in the allowlist.
const sanitizeTransform = sanitize({
  allowElements: [
    'p', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'strong', 'em', 'b', 'i', 'del', 'sub', 'sup',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowAttributes: {
    href: ['a'],
    title: ['a', 'img'],
    src: ['img'],
    alt: ['img'],
    width: ['img'],
    height: ['img'],
  },
  allowComments: false,
});

// Per-tag attribute allowlist. ultrahtml's sanitize() filters ELEMENTS but does
// NOT strip unknown attributes (verified: an `onerror=` survives its
// allowAttributes), so attribute filtering is made authoritative HERE: any
// attribute not in this map (incl. every on* handler, style, class, id) is
// dropped. Tags absent from the map keep no attributes at all.
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'width', 'height', 'title']),
};

// True for relative URLs and the safe absolute schemes. Whitespace (tabs,
// newlines, CR) is stripped first so obfuscated schemes (e.g. "java\nscript:",
// which browsers would still execute) can't slip past the check.
const SAFE_SCHEMES = ['http', 'https', 'mailto', 'tel'];
function isSafeUrl(url: string): boolean {
  const cleaned = url.replace(/\s+/g, '').toLowerCase();
  const match = /^([a-z][a-z0-9+.-]*):/.exec(cleaned);
  if (!match) return true; // relative URL or anchor — no scheme
  return SAFE_SCHEMES.includes(match[1]);
}

// Enforce the attribute allowlist + safe URL schemes on every element. Runs
// after sanitize (which has already dropped disallowed elements + comments).
function enforceAttributes(doc: Node): Node {
  walkSync(doc, (node) => {
    if (node.type !== ELEMENT_NODE) return;
    const allowed = ALLOWED_ATTRS[node.name] ?? EMPTY;
    for (const attr of Object.keys(node.attributes)) {
      if (!allowed.has(attr)) {
        delete node.attributes[attr];
      }
    }
    // Drop href/src whose scheme is not allowlisted (javascript:, data:, …).
    if (node.attributes.href && !isSafeUrl(node.attributes.href)) delete node.attributes.href;
    if (node.attributes.src && !isSafeUrl(node.attributes.src)) delete node.attributes.src;
  });
  return doc;
}
const EMPTY: Set<string> = new Set();

// Render trusted-by-admin-but-still-sanitised Markdown to HTML.
export async function renderMarkdown(md: string | null | undefined): Promise<string> {
  if (!md) return '';
  const rawHtml = await marked.parse(md);
  return transform(rawHtml, [sanitizeTransform, enforceAttributes]);
}
