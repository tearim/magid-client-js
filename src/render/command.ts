import { parseMagidCss, type CommandResponse } from '@magiden/client-core';
import { h, setStyle } from '../dom/h';
import { deferMsOf, watch, watchImpliedClasses, type Ctx } from './common';

// A story choice: sends its command-name as a reply to the story; disabled while a request runs.
export function renderCommandButton(ctx: Ctx, data: CommandResponse, positionClass?: string): Node {
  const reply = data['command-name'] ?? (data as unknown as Record<string, string>)['command-text'] ?? '';
  const button = h('button', {
    attrs: { 'aria-label': data['command-description'] },
    on: { click: () => { void ctx.magid.send(reply); } },
  }, data['command-description']);
  setStyle(button, data['command-css'] ? parseMagidCss(data['command-css']) : undefined);
  watchImpliedClasses(ctx, data['command-class'], (classes) => {
    button.className = ['magid-common-button', classes, positionClass].filter(Boolean).join(' ');
  });
  watch(ctx, (s) => s.isLoading, (isLoading) => { button.disabled = isLoading; });

  const deferMs = deferMsOf(data['command-defer']);
  if (deferMs === 0) return button;
  const placeholder = document.createComment('magid command');
  ctx.scope.timeout(() => placeholder.replaceWith(button), deferMs);
  return placeholder;
}
