import type { ParsedElement } from '@magiden/client-core';
import { h } from '../dom/h';
import { childCtx, deferMsOf, type Ctx } from './common';
import { renderCommandButton } from './command';
import { renderImageElement } from './image';
import { renderMenu } from './menu';
import { renderNarration } from './narration';
import { renderVisual } from './visual';

interface Callbacks {
  onVisualComplete?: () => void;
  onNarrationComplete?: () => void;
}

export function renderElement(ctx: Ctx, el: ParsedElement, callbacks: Callbacks = {}): Node | null {
  switch (el.type) {
    case 'menu':      return renderMenu(ctx, el.data);
    case 'narration': return renderNarration(ctx, el.data, callbacks.onNarrationComplete);
    case 'image':     return renderImageElement(ctx, el.data, callbacks.onNarrationComplete);
    case 'command':   return renderCommandButton(ctx, el.data);
    case 'visual':    return renderVisual(ctx, el.data, callbacks.onVisualComplete);
    case 'responses': return renderResponses(ctx, el.elements);
    case 'detached':  return null; // spliced into a narration or menu by the core; nothing to render standalone
    default:          return null;
  }
}

// What the server sent, as the React client's MagidRoot renders it.
export function renderMagidRoot(ctx: Ctx, elements: ParsedElement[]): HTMLElement {
  const pane = h('div', { class: 'magid-response-pane mg-root-responsePane' });
  renderSequence(ctx, pane, elements, false);
  return pane;
}

// A `responses` batch (ResponsesContainer): also waits for blocking visuals.
function renderResponses(ctx: Ctx, elements: ParsedElement[]): Node {
  const fragment = document.createDocumentFragment();
  renderSequence(ctx, fragment, elements, true);
  return fragment;
}

// Standalone images take their turn among the narrations.
function isQueued(el: ParsedElement): el is Extract<ParsedElement, { type: 'narration' | 'image' }> {
  return el.type === 'narration' || el.type === 'image';
}

function isBlockingVisual(el: ParsedElement): boolean {
  return el.type === 'visual' && el.data['transition-blocking'] === 'true';
}

// Renders `elements` in order into `parent`:
// - narrations and standalone images without a `defer` one after another, each when the previous one has completed;
// - with `gate`, nothing after a blocking visual until it has completed;
// - everything else at once.
function renderSequence(ctx: Ctx, parent: Node, elements: ParsedElement[], gate: boolean): void {
  const slots = elements.map(() => parent.appendChild(document.createComment('')));
  const rendered = elements.map(() => false);
  const queuePosition = new Map<number, number>();
  elements.forEach((el, i) => {
    if (isQueued(el) && deferMsOf(el.data.defer) === 0) queuePosition.set(i, queuePosition.size);
  });

  const nextUnlock = (from: number) => {
    const blocker = elements.findIndex((el, i) => i >= from && isBlockingVisual(el));
    return blocker === -1 ? elements.length : blocker + 1;
  };
  let unlocked = gate ? nextUnlock(0) : elements.length;
  let visibleQueued = 1;

  const update = () => {
    if (!ctx.scope.alive) return;
    elements.forEach((el, i) => {
      if (rendered[i] || i >= unlocked) return;
      const position = queuePosition.get(i);
      if (position !== undefined && position >= visibleQueued) return;
      rendered[i] = true;
      const node = renderElement(childCtx(ctx), el, {
        onVisualComplete: gate && isBlockingVisual(el) ? () => { unlocked = nextUnlock(unlocked); update(); } : undefined,
        onNarrationComplete: position !== undefined ? () => { visibleQueued++; update(); } : undefined,
      });
      if (node) slots[i].parentNode?.insertBefore(node, slots[i]);
    });
  };
  update();
}
