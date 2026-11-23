import { streamClassName } from '@magiden/client-core';
import { h } from '../dom/h';
import { renderWithBreaks } from '../dom/text';
import { watch, type Ctx } from './common';

// Streamed texts (the core's `stream` nodes): returns what renderHtml puts at a stream node. One element per stream,
// built once and reused (typed texts re-render their DOM on every step), showing the stream's text so far as plain
// text, never markup, and kept current while `ctx.scope` lives. Not typed out: the stream is its own typing.
// Classes from the core's streamClassName, as in rct's StreamText: `magid-stream`, its phase (`-warming-up`,
// `-receiving`, `-finished`) and, once finished, its status (`-ok`, `-failed`, …).
export function streamRenderer(ctx: Ctx): (id: string) => Node {
  const built = new Map<string, HTMLElement>();
  return (id) => {
    let span = built.get(id);
    if (!span) {
      const el = h('span', { 'data-stream-id': id });
      watch(ctx, (s) => s.streams[id], (state) => {
        el.className = streamClassName(state);
        el.replaceChildren(renderWithBreaks(state?.text ?? ''));
      });
      built.set(id, el);
      span = el;
    }
    return span;
  };
}
