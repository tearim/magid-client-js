import {
  getConsequentalTypingConfig, prepareDisplayText, resolveCleanText, truncateHtml, type HtmlNode, type MenuResponse,
} from '@magiden/client-core';
import { playLoop } from '../dom/audio';
import { h, replaceChildren } from '../dom/h';
import { renderHtml } from '../dom/html';
import { renderWithBreaks } from '../dom/text';
import { runTypewriter } from '../dom/typewriter';
import { PREF_KEYS } from '../prefs';
import { childCtx, watch, watchAll, watchImpliedClasses, type Ctx } from './common';
import { renderCommandButton } from './command';
import { renderDetached } from './detached';

// A menu: its description (typed like a narration; `by-anchor` detached elements at their anchors, `prepend` ones
// before it, `append` ones once it is fully shown), `menu-css`, background music, and the choices as buttons.
export function renderMenu(ctx: Ctx, data: MenuResponse): HTMLElement {
  const rawDesc = data['menu-description'] ?? '';
  const detached = data['detached-elements'] ?? [];
  const anchorEls = detached.filter((d) => d.detached === 'by-anchor' && d['text-anchor']);
  const anchors = anchorEls.map((d) => d['text-anchor'] ?? '');
  const prependEls = detached.filter((d) => d.detached === 'prepend');
  const appendEls = detached.filter((d) => d.detached === 'append');

  playMusic(ctx, data['menu-background-music']);

  const root = h('div', { class: 'magid-menu-textarea' });
  if (rawDesc) root.appendChild(renderDescription(ctx, data, rawDesc, anchors, anchorEls, prependEls, appendEls));

  const options = data['menu-options'] ?? [];
  root.appendChild(h('div', { class: 'magid-menu-buttons' },
    ...options.map((opt, i) => renderCommandButton(ctx, opt, `button-${i + 1}-of-${options.length}`)),
  ));
  return root;
}

function renderDescription(
  ctx: Ctx, data: MenuResponse, rawDesc: string, anchors: string[],
  anchorEls: NonNullable<MenuResponse['detached-elements']>,
  prependEls: NonNullable<MenuResponse['detached-elements']>,
  appendEls: NonNullable<MenuResponse['detached-elements']>,
): HTMLElement {
  const { magid } = ctx;
  const desc = h('div', { class: 'magid-menu-description' });
  const menuCss = data['menu-css'];
  if (menuCss) {
    desc.style.cssText = menuCss;
    // Handle special -mg- properties.
    const wMatch = menuCss.match(/-mg-window-width\s*:\s*(\d+)/);
    const hMatch = menuCss.match(/-mg-window-height\s*:\s*(\d+)/);
    if (wMatch || hMatch) magid.host.setWindowSize(wMatch ? Number(wMatch[1]) : undefined, hMatch ? Number(hMatch[1]) : undefined);
  }

  // Detached elements are built once, so inputs keep their state while the text around them is re-rendered.
  const prepended = prependEls.map((d) => renderDetached(ctx, d));
  const appended = appendEls.map((d) => renderDetached(ctx, d));
  const anchored = new Map<string, Node | null>();
  const nodeAt = (anchor: string): Node | null => {
    if (!anchored.has(anchor)) {
      const d = anchorEls.find((e) => e['text-anchor'] === anchor);
      anchored.set(anchor, d ? renderDetached(ctx, d) : null);
    }
    return anchored.get(anchor) ?? null;
  };

  const skip = magid.prefs.getBoolean(PREF_KEYS.NARRATION_IGNORE_TEXT_TL);
  let menuClass: string | undefined;
  let nodes: HtmlNode[] = [];
  let timeline = '';
  let visible = '';
  let clean = '';
  let typing: Ctx | undefined;
  let typingKey = '';

  const render = () => {
    replaceChildren(desc,
      ...prepended,
      renderHtml(truncateHtml(nodes, visible.length), (text) => renderWithBreaks(text), nodeAt),
      // Append elements wait for the whole description.
      ...(visible === clean ? appended : []),
    );
  };

  const type = () => {
    const config = getConsequentalTypingConfig(menuClass);
    const key = JSON.stringify([timeline, config.typeEachLetter, config.typeEachWord, config.typeElementMs]);
    if (key === typingKey) { render(); return; }
    typingKey = key;
    typing?.scope.dispose();
    typing = childCtx(ctx);
    clean = resolveCleanText(timeline);
    runTypewriter(typing.scope, timeline, config, skip, (shown) => { visible = shown; render(); });
  };

  watchImpliedClasses(ctx, data['menu-class'], (classes) => {
    menuClass = classes;
    if (timeline) type();
  });
  watchAll(ctx, [(s) => s.htmlPolicy, (s) => s.baseUrl, (s) => s.fileRequestToken], () => {
    const { htmlPolicy, baseUrl, fileRequestToken } = magid.store.get();
    ({ nodes, timeline } = prepareDisplayText(rawDesc, htmlPolicy, { baseUrl, fileRequestToken, anchors }));
    type();
  });
  return desc;
}

// Background music, with the session's file-request-token for server files; restarts when the token changes.
function playMusic(ctx: Ctx, rawSrc: string | undefined): void {
  if (!rawSrc) return;
  const storedVolume = parseFloat(ctx.magid.prefs.get(PREF_KEYS.MUSIC_VOLUME, ''));
  const volume = isNaN(storedVolume) ? 0.8 : storedVolume;
  let stop: (() => void) | undefined;
  watch(ctx, (s) => s.fileRequestToken, (token) => {
    let src: string | undefined = rawSrc;
    if (token) {
      try {
        const url = new URL(rawSrc);
        url.searchParams.set('file-request-token', token);
        src = url.toString();
      } catch (e) {
        console.warn(`[magid] Invalid menu-background-music URL: ${rawSrc}`, e);
        src = undefined;
      }
    }
    stop?.();
    stop = src ? playLoop(src, volume) : undefined;
  });
  ctx.scope.add(() => stop?.());
}
