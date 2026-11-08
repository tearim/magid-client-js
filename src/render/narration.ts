import {
  getConsequentalTypingConfig, parseMagidCss, prepareDisplayText, resolveCleanText, truncateHtml, type HtmlNode,
  type NarrationResponse,
} from '@magiden/client-core';
import { h, replaceChildren, setStyle } from '../dom/h';
import { renderHtml } from '../dom/html';
import { renderWithBreaks, TypingStyle } from '../dom/text';
import { runTypewriter } from '../dom/typewriter';
import { PREF_KEYS } from '../prefs';
import { childCtx, deferMsOf, watchAll, watchImpliedClasses, type Ctx } from './common';
import { renderDetached } from './detached';
import { renderMagidImage } from './image';

function typingStyleOf(className: string | undefined): TypingStyle | undefined {
  const config = getConsequentalTypingConfig(className);
  const isolating = className?.includes('animate-independent');
  if (config.typeEachWord) return isolating ? TypingStyle.byWordIsolating : TypingStyle.byWord;
  if (config.typeEachLetter) return isolating ? TypingStyle.byLetterIsolating : TypingStyle.byLetter;
  return undefined;
}

// A narration: typed out over its DCSTP_ timeline and typing classes, with HTML the server allows, detached elements
// at their anchors and `<show image="…">` above it. Reports completion (the next narration may start) once it is fully
// shown; a narration with a `defer` appears after it and doesn't take part in the queue.
export function renderNarration(ctx: Ctx, data: NarrationResponse, onComplete?: () => void): Node {
  const deferMs = deferMsOf(data.defer);
  if (deferMs > 0) {
    const placeholder = document.createComment('magid narration');
    ctx.scope.timeout(() => placeholder.replaceWith(buildNarration(ctx, data)), deferMs);
    return placeholder;
  }
  return buildNarration(ctx, data, onComplete);
}

function buildNarration(ctx: Ctx, data: NarrationResponse, onComplete?: () => void): HTMLElement {
  const { magid, scope } = ctx;
  const rawText = data.narration ?? data.text ?? '';
  const div = h('div');
  setStyle(div, data.css ? parseMagidCss(data.css) : undefined);

  // `<show image="…">`: the narration's own image; its class and css stay on the narration. Built once, reused.
  const image = data.image ? h('div', { class: 'magid-narration-image' }, renderMagidImage(ctx, { image: data.image })) : null;
  // Detached elements (e.g. an <img> inside the text) go where their anchor is; built once, so they keep their state.
  const detached = data['detached-elements'] ?? [];
  const anchors = detached.map((d) => d['text-anchor'] ?? '');
  const anchored = new Map<string, Node | null>();
  const nodeAt = (anchor: string): Node | null => {
    if (!anchored.has(anchor)) {
      const d = detached.find((e) => e['text-anchor'] === anchor);
      anchored.set(anchor, d ? renderDetached(ctx, d) : null);
    }
    return anchored.get(anchor) ?? null;
  };

  let className: string | undefined;
  let nodes: HtmlNode[] = [];
  let timeline = '';
  let visible = '';
  let skip = magid.prefs.getBoolean(PREF_KEYS.NARRATION_IGNORE_TEXT_TL);
  let completed = false;
  let typing: Ctx | undefined;
  let typingKey = '';

  const render = () => {
    const typingStyle = typingStyleOf(className);
    const { animationResets } = getConsequentalTypingConfig(className);
    replaceChildren(div, image, renderHtml(
      truncateHtml(nodes, visible.length),
      // The reveal effects (last letters/words) belong at the reveal edge; the isolating ones apply everywhere.
      (text, isLast) => isLast || typingStyle === TypingStyle.byLetterIsolating || typingStyle === TypingStyle.byWordIsolating
        ? renderWithBreaks(text, typingStyle, animationResets)
        : renderWithBreaks(text),
      nodeAt,
    ));
  };

  // Restarts the typewriter when what it types changes (timeline, skip, typing class), as the React hook does.
  const type = () => {
    const config = getConsequentalTypingConfig(className);
    const key = JSON.stringify([timeline, skip, config.typeEachLetter, config.typeEachWord, config.typeElementMs]);
    if (key === typingKey) { render(); return; }
    typingKey = key;
    typing?.scope.dispose();
    typing = childCtx(ctx);
    const clean = resolveCleanText(timeline);
    runTypewriter(typing.scope, timeline, config, skip, (shown) => {
      visible = shown;
      render();
      if (shown === clean && !completed) {
        completed = true;
        // After the caller has placed this narration.
        scope.timeout(() => onComplete?.(), 0);
      }
    });
  };

  watchImpliedClasses(ctx, data.class, (classes) => {
    className = classes;
    div.className = ['magid-default-narration', classes].filter(Boolean).join(' ');
    if (timeline || nodes.length) type();
  });
  // Tags and anchors are parsed once; the typewriter only sees the visible text, so they appear whole.
  watchAll(ctx, [(s) => s.htmlPolicy, (s) => s.baseUrl, (s) => s.fileRequestToken], () => {
    const { htmlPolicy, baseUrl, fileRequestToken } = magid.store.get();
    ({ nodes, timeline } = prepareDisplayText(rawText, htmlPolicy, { baseUrl, fileRequestToken, anchors }));
    type();
  });
  // Escape skips the timeline: the window in the full app, the Magid area (while it has focus) when embedded.
  scope.listen(magid.host.keyTarget, 'keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape' && !skip) {
      skip = true;
      type();
    }
  });
  return div;
}
