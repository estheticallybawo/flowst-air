import { h, type VNode } from 'vue';

interface InlinePart { kind: 'text' | 'strong' | 'emphasis' | 'code'; text: string }
export type AirsMessageBlock =
  | { kind: 'paragraph' | 'heading' | 'quote'; parts: InlinePart[] }
  | { kind: 'list'; ordered: boolean; start: number; items: InlinePart[][] }
  | { kind: 'code'; text: string; language: string };

/** A small text-only markdown dialect. HTML and URLs never become executable markup. */
function inline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;
  let previous = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > previous) parts.push({ kind: 'text', text: text.slice(previous, match.index) });
    const value = match[0];
    const kind = value.startsWith('`') ? 'code' : value.startsWith('**') || value.startsWith('__') ? 'strong' : 'emphasis';
    const trim = kind === 'strong' ? 2 : 1;
    parts.push({ kind, text: value.slice(trim, -trim) });
    previous = match.index + value.length;
  }
  if (previous < text.length) parts.push({ kind: 'text', text: text.slice(previous) });
  return parts;
}

export function parseAirsMessage(text: string): AirsMessageBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: AirsMessageBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', parts: inline(paragraph.join(' ')) });
    paragraph = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) { flush(); continue; }
    const fence = line.match(/^\s*(`{3,}|~{3,})([^\s`]*)\s*$/);
    if (fence) {
      flush();
      const code: string[] = [];
      const marker = fence[1]!;
      for (++i; i < lines.length; i++) {
        const candidate = lines[i]!;
        if (candidate.trim().startsWith(marker) && /^\s*[`~]+\s*$/.test(candidate)) break;
        code.push(candidate);
      }
      blocks.push({ kind: 'code', text: code.join('\n'), language: /^[a-z\d-]{1,24}$/i.test(fence[2]!) ? fence[2]! : '' });
      continue;
    }
    const heading = line.match(/^\s*#{1,6}\s+(.+)$/);
    if (heading) { flush(); blocks.push({ kind: 'heading', parts: inline(heading[1]!) }); continue; }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) { flush(); blocks.push({ kind: 'quote', parts: inline(quote[1]!) }); continue; }
    const item = line.match(/^\s*(?:([-+*])\s+|(\d{1,6})[.)]\s+)(.+)$/);
    if (item) {
      flush();
      const ordered = Boolean(item[2]);
      const last = blocks.at(-1);
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(inline(item[3]!));
      else blocks.push({ kind: 'list', ordered, start: ordered ? Number(item[2]) : 1, items: [inline(item[3]!)] });
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

function renderInline(parts: InlinePart[]): Array<VNode | string> {
  return parts.map(part => part.kind === 'text' ? part.text : h(part.kind === 'emphasis' ? 'em' : part.kind, part.text));
}

/** Vue text children escape untrusted speech, source excerpts, HTML, and markdown URLs. */
export function renderAirsMessage(text: string): VNode[] {
  return parseAirsMessage(text).map(block => {
    if (block.kind === 'code') return h('pre', [h('code', block.text)]);
    if (block.kind === 'list') return h(block.ordered ? 'ol' : 'ul', block.ordered ? { start: block.start } : {}, block.items.map(item => h('li', renderInline(item))));
    if (block.kind === 'heading') return h('p', { class: 'message-heading' }, [h('strong', renderInline(block.parts))]);
    return h(block.kind === 'quote' ? 'blockquote' : 'p', renderInline(block.parts));
  });
}
