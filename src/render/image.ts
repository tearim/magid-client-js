import { parseMagidCss, withFileRequestToken, type ImageResponse } from '@magiden/client-core';
import { h, setStyle } from '../dom/h';
import { cssLength, deferMsOf, watchAll, watchImpliedClasses, type Ctx } from './common';

type ImageData = Pick<ImageResponse, 'alt' | 'width' | 'height' | 'class' | 'css'> & { image?: string };

// An author's <img>, detached (at its anchor in a text) or on its own. Its class and css belong to the image itself.
// Files from the server need the session's token, which can change, so it is added here and follows the state.
export function renderMagidImage(ctx: Ctx, data: ImageData): HTMLImageElement | null {
  if (!data.image) return null;
  const img = h('img', { alt: data.alt ?? '' });
  setStyle(img, {
    ...(data.css ? parseMagidCss(data.css) : undefined),
    ...(data.width ? { width: cssLength(data.width) } : undefined),
    ...(data.height ? { height: cssLength(data.height) } : undefined),
  });
  watchImpliedClasses(ctx, data.class, (classes) => { img.className = ['magid-image', classes].filter(Boolean).join(' '); });
  watchAll(ctx, [(s) => s.baseUrl, (s) => s.fileRequestToken], () => {
    const { baseUrl, fileRequestToken } = ctx.magid.store.get();
    img.src = withFileRequestToken(data.image!, baseUrl, fileRequestToken);
  });
  return img;
}

// A standalone image takes its turn among the narrations: it waits for its `defer`, then reports itself complete.
export function renderImageElement(ctx: Ctx, data: ImageResponse, onComplete?: () => void): Node {
  const placeholder = document.createComment('magid image');
  const show = () => {
    const img = renderMagidImage(ctx, data);
    placeholder.replaceWith(h('div', { class: 'magid-default-image' }, img));
    onComplete?.();
  };
  const deferMs = deferMsOf(data.defer);
  if (deferMs === 0) {
    // Report completion after the caller has placed the node.
    const box = h('div', { class: 'magid-default-image' }, renderMagidImage(ctx, data));
    ctx.scope.timeout(() => onComplete?.(), 0);
    return box;
  }
  ctx.scope.timeout(show, deferMs);
  return placeholder;
}
