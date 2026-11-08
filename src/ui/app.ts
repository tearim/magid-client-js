import { applyImpliedClasses, type ParsedElement } from '@magiden/client-core';
import { h, replaceChildren } from '../dom/h';
import { DEFAULT_SERVER } from '../options';
import { PREF_KEYS } from '../prefs';
import type { MagidState } from '../instance';
import { childCtx, watch, watchAll, type Ctx } from '../render/common';
import { renderMagidRoot } from '../render/root';
import { renderOptionsDialog } from './options';
import { renderLobbyPage, renderWelcomePage } from './pages';
import { renderStatsDashboard } from './stats';
import { renderToasts } from './toasts';

// The app shell (magid-client-rct's App.tsx). Which screen shows depends on the state, not on routing:
// welcome (no session) → lobby (session, no scene) → the story (elements to render). With chrome 'story' (embedded)
// only the story, the blocked banner and toasts.
export function renderApp(ctx: Ctx): HTMLElement {
  const { magid } = ctx;
  const { client, prefs, store, options } = magid;

  const status = h('span', { class: 'mg-app-statusMsg' });
  let clearStatus = () => {};
  const showMessage = (text: string, durationMs = 5000) => {
    status.textContent = text;
    status.hidden = !text;
    clearStatus();
    clearStatus = ctx.scope.timeout(() => { status.textContent = ''; status.hidden = true; }, durationMs);
  };
  status.hidden = true;
  watch(ctx, (s) => s.error, (error) => { if (error) showMessage(error); });

  const connectDisabled = () => !!store.get().connectivityBlockedError && !prefs.getBoolean(PREF_KEYS.DEBUG_ALWAYS_ALLOW_CONNECTIVITY);
  const handleConnect = () => {
    if (!store.get().baseUrl) openOptions(true);
    else void client.send('');
  };

  // The menu's classes (implied ones too) also go on <main>, as story CSS expects.
  const main = h('main', { class: 'mg-app-main' });
  watchAll(ctx, [(s) => s.menuClass, (s) => s.envVars], () => {
    const { menuClass, envVars } = store.get();
    main.className = ['mg-app-main', applyImpliedClasses(menuClass, envVars)].filter(Boolean).join(' ');
  });

  const banner = h('div', { class: 'mg-app-blockedBanner', attrs: { role: 'alert' } });
  watch(ctx, (s) => s.connectivityBlockedError, (blocked) => {
    banner.hidden = !blocked || prefs.getBoolean(PREF_KEYS.DEBUG_ALWAYS_ALLOW_CONNECTIVITY);
    replaceChildren(banner, ...(blocked ? [h('strong', null, `[${blocked.code}]`), ` ${blocked.message}`] : []));
  });

  // The story-only chrome's line while there is nothing to render: the status message (errors) or "Loading…".
  const storyStatus = (screenCtx: Ctx) => {
    const line = h('div', { class: 'mg-app-storyStatus' });
    const show = () => { line.textContent = status.textContent || (store.get().isLoading ? 'Loading…' : ''); };
    show();
    const observer = new MutationObserver(show);
    observer.observe(status, { childList: true, characterData: true, subtree: true });
    screenCtx.scope.add(() => observer.disconnect());
    return line;
  };

  // The screen is rebuilt when what it shows changes: a new batch of elements (every response), or another page.
  let screen: Ctx | undefined;
  const screenKey = (s: MagidState): ParsedElement[] | string =>
    s.elements.length > 0 ? s.elements
      : s.isLoading ? 'none'
        : options.chrome === 'story' ? 'status'
          : `${s.serverConnected ? 'lobby' : 'welcome'}:${connectDisabled()}`;
  watch(ctx, screenKey, (key) => {
    screen?.scope.dispose();
    screen = childCtx(ctx);
    let content: Node | null;
    try {
      content = typeof key !== 'string' ? renderMagidRoot(screen, key)
        : key === 'none' ? null
          : key === 'status' ? storyStatus(screen)
            : key.startsWith('lobby') ? renderLobbyPage(screen, handleConnect, connectDisabled())
              : renderWelcomePage(screen, handleConnect, () => openOptions(), connectDisabled());
    } catch (e) {
      // A renderer bug must not break the client's state updates; show what is known instead of nothing.
      console.error('[magid] Rendering failed', e);
      content = h('div', { class: 'mg-app-storyStatus' }, 'This part of the story could not be shown.');
    }
    replaceChildren(main, content);
  });

  const shell = h('div', { class: 'mg-app-shell' });
  const dialogs = h('div');
  const openOptions = (focusOnUrl = false) => {
    const dialog = childCtx(ctx);
    const close = () => { dialog.scope.dispose(); replaceChildren(dialogs); };
    replaceChildren(dialogs, renderOptionsDialog(dialog, {
      onBaseUrlChange: (url) => client.setBaseUrl(url),
      onClose: close,
      onMessage: showMessage,
      onOpenStats: () => { close(); openStats(); },
      focusOnUrl,
    }));
  };
  const openStats = () => {
    const dashboard = childCtx(ctx);
    const close = () => { dashboard.scope.dispose(); replaceChildren(dialogs); };
    replaceChildren(dialogs, renderStatsDashboard(dashboard, close));
  };

  if (options.chrome === 'story') {
    startStory(ctx);
    replaceChildren(shell, banner, main, renderToasts(ctx));
    return shell;
  }

  replaceChildren(shell, renderHeader(ctx, status, handleConnect, connectDisabled, () => openOptions()), banner, main, dialogs, renderToasts(ctx));
  startApp(ctx, showMessage);
  // Save the URL to history once a session is established.
  watch(ctx, (s) => s.sessionId, (sessionId) => { if (sessionId) magid.urlHistory.add(store.get().baseUrl); });
  return shell;
}

function renderHeader(
  ctx: Ctx, status: HTMLElement, onConnect: () => void, connectDisabled: () => boolean, onOptions: () => void,
): HTMLElement {
  const { client, store, options } = ctx.magid;
  const spinner = h('span', { class: 'mg-app-spinner', attrs: { 'aria-label': 'Loading' } });
  const dot = h('span', { class: 'mg-app-connDot' });
  const reset = h('button', {
    class: 'mg-app-resetBtn', title: 'Reload the XML and restart the story from the beginning',
    on: { click: async () => { await client.resetStory(); await client.send(''); } },
  }, 'Reset server');
  const connect = h('button', { class: 'mg-app-connectBtn', on: { click: onConnect } }, 'Connect');
  connect.hidden = !options.clientConfig.showConnectButton;
  const endSession = h('span');

  let confirming = false;
  const showEndSession = () => {
    const { sessionId, isLoading } = store.get();
    if (!sessionId) { replaceChildren(endSession); return; }
    replaceChildren(endSession, confirming
      ? h('span', { class: 'mg-app-endSessionConfirm' },
        'End session?',
        h('button', {
          class: 'mg-app-endSessionYes', disabled: isLoading,
          on: { click: () => { confirming = false; showEndSession(); void client.endSession(); } },
        }, 'Yes'),
        h('button', { class: 'mg-app-endSessionNo', on: { click: () => { confirming = false; showEndSession(); } } }, 'No'))
      : h('button', {
        class: 'mg-app-endSessionBtn', disabled: isLoading,
        on: { click: () => { confirming = true; showEndSession(); } },
      }, 'End session'));
  };

  watchAll(ctx, [(s) => s.isLoading, (s) => s.connected, (s) => s.allowedCommands, (s) => s.sessionId, (s) => s.connectivityBlockedError], () => {
    const { isLoading, connected, connectivityBlockedError } = store.get();
    spinner.hidden = !isLoading;
    dot.className = ['mg-app-connDot', connected && 'mg-app-connDotOn'].filter(Boolean).join(' ');
    dot.title = connected ? 'Connected' : 'Disconnected';
    reset.hidden = !client.can('reload-xml');
    reset.disabled = isLoading;
    connect.disabled = isLoading || connectDisabled();
    connect.title = connectDisabled() ? connectivityBlockedError?.message ?? '' : '';
    showEndSession();
  });

  return h('header', { class: 'mg-app-header' },
    h('button', { class: 'mg-app-optionsBtn', attrs: { 'aria-label': 'Open options' }, on: { click: onOptions } }, '☰ Options'),
    h('div', { class: 'mg-app-headerRight' }, status, spinner, dot, reset, connect, endSession),
  );
}

// Startup of the full chrome: the saved server, and the saved story when "Auto-load XML on startup" is on.
function startApp(ctx: Ctx, showMessage: (text: string) => void): void {
  const { client, prefs, options } = ctx.magid;
  client.setBaseUrl(prefs.get(PREF_KEYS.SERVER_ADDRESS, options.baseUrl ?? DEFAULT_SERVER));
  void (async () => {
    const armXml = prefs.getBoolean(PREF_KEYS.STARTUP_ARM_XML);
    const storyXml = prefs.get(PREF_KEYS.STORY_XML);
    if (armXml && storyXml) {
      await client.send('');
      if (!(await client.selectStory(storyXml))) showMessage('Failed to load saved XML');
    }
    void client.send('');
  })();
}

// Startup of the story-only chrome: the operator chose server and story (mount options); a stored session resumes
// where the player left off, and only a new session (none stored, or the stored one expired) loads the story.
function startStory(ctx: Ctx): void {
  const { client, store, options } = ctx.magid;
  client.setBaseUrl(options.baseUrl ?? DEFAULT_SERVER);
  void (async () => {
    const storedSession = store.get().sessionId;
    await client.send('');
    const newSession = !storedSession || store.get().sessionId !== storedSession;
    if (options.story && newSession && await client.selectStory(options.story)) await client.send('');
  })();
}
