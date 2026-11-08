import type { VisualResponse } from '@magiden/client-core';
import { h } from '../dom/h';
import { deferMsOf, type Ctx } from './common';

// A fade/unfade overlay: over the window in the full app, over the Magid area when embedded. A blocking one reports
// completion after its duration (the following elements wait for it).
export function renderVisual(ctx: Ctx, data: VisualResponse, onComplete?: () => void): Node | null {
  const isFade = data['transition-type'] === 'fade';
  const durationMs = deferMsOf(data['transition-length'] ?? '400');
  const blocking = data['transition-blocking'] === 'true';
  const { overlayTarget } = ctx.magid.host;

  const overlay = h('div', {
    style: {
      position: overlayTarget ? 'absolute' : 'fixed',
      inset: '0',
      backgroundColor: data['transition-target'] ?? '#000000',
      pointerEvents: 'none',
      zIndex: '9999',
      opacity: isFade ? '1' : '0',
      transition: 'none',
    },
  });

  // Start the transition once the overlay is in the page with its initial opacity.
  const start = () => {
    void overlay.offsetHeight;
    overlay.style.transition = `opacity ${durationMs}ms ease`;
    overlay.style.opacity = isFade ? '0' : '1';
  };
  ctx.scope.timeout(start, 0);
  if (blocking && onComplete) ctx.scope.timeout(onComplete, durationMs);

  if (!overlayTarget) {
    ctx.scope.add(() => overlay.remove());
    return overlay;
  }
  overlayTarget.appendChild(overlay);
  ctx.scope.add(() => overlay.remove());
  return null;
}
