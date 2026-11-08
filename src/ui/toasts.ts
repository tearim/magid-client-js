import copyIcon from '../assets/copy.svg?raw';
import pinIcon from '../assets/pin.svg?raw';
import clockIcon from '../assets/clock.svg?raw';
import { h, replaceChildren } from '../dom/h';
import type { Toast } from '../instance';
import { Scope } from '../scope';
import { watch, type Ctx } from '../render/common';

const DEFAULT_DISMISS_MS = 4500;
const SNOOZE_MS = 30000;
// Must match the closing animation's duration (.mg-toast-toastClosing).
const CLOSE_ANIM_MS = 400;

function icon(svg: string): HTMLElement {
  const span = h('span', { attrs: { 'aria-hidden': 'true' } });
  span.innerHTML = svg; // the app's own bundled icons
  return span;
}

// Notices (out-of-sync, errors), each dismissed after a while, snoozed, pinned or copied.
export function renderToasts(ctx: Ctx): HTMLElement {
  const container = h('div', { class: 'mg-toast-container' });
  const items = new Map<string, { el: HTMLElement; scope: Scope }>();

  watch(ctx, (s) => s.toasts, (toasts) => {
    for (const [id, item] of items) {
      if (!toasts.some((t) => t.id === id)) { item.scope.dispose(); item.el.remove(); items.delete(id); }
    }
    for (const toast of toasts) {
      if (!items.has(toast.id)) {
        const scope = ctx.scope.child();
        const el = renderToast({ magid: ctx.magid, scope }, toast);
        items.set(toast.id, { el, scope });
        container.appendChild(el);
      }
    }
    container.hidden = toasts.length === 0;
  });
  return container;
}

function renderToast(ctx: Ctx, { id, message }: Toast): HTMLElement {
  const dismiss = () => ctx.magid.dismissToast(id);
  let pinned = false;
  let timers = ctx.scope.child();

  const toast = h('div', { class: 'mg-toast-toast', on: { click: () => { if (!pinned) dismiss(); } } }, message);
  const schedule = (delayMs: number) => {
    timers.dispose();
    timers = ctx.scope.child();
    toast.classList.remove('mg-toast-toastClosing');
    timers.timeout(() => toast.classList.add('mg-toast-toastClosing'), Math.max(delayMs - CLOSE_ANIM_MS, 0));
    timers.timeout(dismiss, delayMs);
  };
  const cancel = () => {
    timers.dispose();
    toast.classList.remove('mg-toast-toastClosing');
  };

  const snooze = h('button', {
    type: 'button', class: 'mg-toast-iconBtn', title: 'Keep open for 30s',
    attrs: { 'aria-label': 'Keep open for 30 seconds' },
    on: { click: (e) => { e.stopPropagation(); schedule(SNOOZE_MS); } },
  }, icon(clockIcon));
  const pin = h('button', {
    type: 'button', class: 'mg-toast-iconBtn',
    on: {
      click: (e) => {
        e.stopPropagation();
        if (pinned) schedule(DEFAULT_DISMISS_MS);
        else cancel();
        pinned = !pinned;
        showPin();
      },
    },
  }, icon(pinIcon));
  const showPin = () => {
    pin.classList.toggle('mg-toast-iconBtnActive', pinned);
    pin.setAttribute('aria-pressed', String(pinned));
    pin.title = pinned ? 'Unpin' : 'Pin (keep open indefinitely)';
    pin.setAttribute('aria-label', pinned ? 'Unpin toast' : 'Pin toast open indefinitely');
    snooze.disabled = pinned;
    snooze.title = pinned ? 'Already pinned open' : 'Keep open for 30s';
  };
  const copy = h('button', {
    type: 'button', class: 'mg-toast-iconBtn', title: 'Copy error message',
    attrs: { 'aria-label': 'Copy error message' },
    on: {
      click: (e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(message);
        replaceChildren(copy, h('span', { class: 'mg-toast-copiedGlyph', attrs: { 'aria-hidden': 'true' } }, '✓'));
        copy.title = 'Copied!';
        ctx.scope.timeout(() => { replaceChildren(copy, icon(copyIcon)); copy.title = 'Copy error message'; }, 1200);
      },
    },
  }, icon(copyIcon));

  showPin();
  toast.appendChild(h('div', { class: 'mg-toast-toastActions' }, snooze, pin, copy));
  schedule(DEFAULT_DISMISS_MS);
  return toast;
}
