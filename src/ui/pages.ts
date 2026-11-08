import { h, replaceChildren } from '../dom/h';
import { watchAll, type Ctx } from '../render/common';

// The welcome page (no server session yet) and the server lobby (a session, no story scene yet).

export function renderWelcomePage(ctx: Ctx, onConnect: () => void, onOptions: () => void, connectDisabled: boolean): HTMLElement {
  const card = h('div', { class: 'mg-welcome-card' });
  watchAll(ctx, [(s) => s.serverName, (s) => s.serverDescription, (s) => s.serverIcon], () => {
    const { serverName, serverDescription, serverIcon } = ctx.magid.store.get();
    replaceChildren(card,
      serverIcon
        ? h('img', { src: serverIcon, class: 'mg-welcome-serverIcon', alt: '', attrs: { 'aria-hidden': 'true' } })
        : h('div', { class: 'mg-welcome-icon', attrs: { 'aria-hidden': 'true' } }, '◈'),
      h('h1', { class: 'mg-welcome-title' }, serverName ?? 'Welcome to the Magid Client'),
      serverDescription ? h('p', { class: 'mg-welcome-body mg-welcome-serverDesc' }, serverDescription) : null,
      h('p', { class: 'mg-welcome-body' },
        'Press ',
        h('kbd', {
          class: ['mg-welcome-key', connectDisabled && 'mg-welcome-keyDisabled'],
          attrs: { 'aria-disabled': connectDisabled ? 'true' : undefined },
          on: { click: () => { if (!connectDisabled) onConnect(); } },
        }, 'Connect'),
        ' to connect to a Magid server. Press ',
        h('kbd', { class: 'mg-welcome-key', on: { click: onOptions } }, 'Options'),
        ' if you need to set the server address.',
      ),
      h('p', { class: 'mg-welcome-body mg-welcome-warning' },
        h('span', { class: 'mg-welcome-warningIcon', attrs: { 'aria-hidden': 'true' } }, '⚠'),
        'Be careful with unknown servers — they can contain malicious content.',
      ),
    );
  });
  return h('div', { class: 'mg-welcome-root' }, card);
}

export function renderLobbyPage(ctx: Ctx, onConnect: () => void, connectDisabled: boolean): HTMLElement {
  const card = h('div', { class: 'mg-lobby-card' });
  watchAll(ctx, [
    (s) => s.sessionId, (s) => s.serverName, (s) => s.serverVersion, (s) => s.serverDescription, (s) => s.serverIcon,
    (s) => s.xmlList,
  ], () => {
    const { sessionId, serverName, serverVersion, serverDescription, serverIcon, xmlList } = ctx.magid.store.get();
    const storyCount = Array.isArray(xmlList) ? xmlList.length : 0;
    replaceChildren(card,
      serverIcon
        ? h('img', { src: serverIcon, class: 'mg-lobby-icon', alt: '', attrs: { 'aria-hidden': 'true' } })
        : h('div', { class: 'mg-lobby-iconGlyph', attrs: { 'aria-hidden': 'true' } }, '◈'),
      h('div', { class: 'mg-lobby-nameRow' },
        h('h1', { class: 'mg-lobby-name' }, serverName ?? 'Magid Server'),
        serverVersion ? h('span', { class: 'mg-lobby-version' }, `v${serverVersion}`) : null,
      ),
      serverDescription ? h('p', { class: 'mg-lobby-description' }, serverDescription) : null,
      h('hr', { class: 'mg-lobby-divider' }),
      storyCount > 0
        ? h('p', { class: 'mg-lobby-storyInfo' },
          h('span', { class: 'mg-lobby-storyCount' }, String(storyCount)),
          ` ${storyCount === 1 ? 'story' : 'stories'} available`)
        : h('p', { class: 'mg-lobby-noStories' }, 'This server unfortunately does not have any stories.'),
      // Connect only when no session is active; with one, a hint.
      !sessionId
        ? h('button', { class: 'mg-lobby-connectBtn', disabled: connectDisabled, on: { click: onConnect } }, 'Connect')
        : null,
      sessionId && storyCount > 0
        ? h('p', { class: 'mg-lobby-hint' }, 'Open ', h('strong', null, 'Options'), ' to select and arm a story.')
        : null,
    );
  });
  return h('div', { class: 'mg-lobby-root' }, card);
}
