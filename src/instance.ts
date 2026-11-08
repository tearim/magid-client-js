import { MagidClient, type MagidClientState } from '@magiden/client-core';
import { createStylesheetSync, type StylesheetTarget } from './dom/stylesheets';
import { createStore, type Store } from './store';
import { DEFAULT_SERVER, type ResolvedMountOptions } from './options';
import { createPrefs, createUrlHistory, PREF_KEYS, type Prefs, type UrlHistory } from './prefs';

// One Magid instance per mount (mount.ts): a @magiden/client-core MagidClient (it owns the protocol: session, recovery,
// config, detached elements, story loading), a store mirroring its state plus what is UI-only (toasts), the instance's
// prefs, and the MagidHost its page-level effects are aimed at. Same structure as magid-client-rct's store.

// Announced to the server as `client-type`: stories publish their web CSS for `browser,react`.
export const CLIENT_TYPE = 'browser';

export interface Toast {
  id: string;
  message: string;
}

export type MagidState = MagidClientState & { toasts: Toast[] };

// Where an instance's page-level effects go. The full app aims them at the page; an embedded instance at its element.
export interface MagidHost {
  // The app's root element (inside the shadow root, if there is one).
  root: HTMLElement;
  // Keyboard shortcuts (Escape skips typing) listen here.
  keyTarget: Window | HTMLElement;
  // What a story's `viewport: maximized` makes fullscreen; null: nothing.
  fullscreenTarget: HTMLElement | null;
  // Applies -mg-window-width/-height (px): to the page in the full app, to the Magid area when embedded.
  setWindowSize: (width: number | undefined, height: number | undefined) => void;
  // Fades render into this element (embedded); null: fixed over the window.
  overlayTarget: HTMLElement | null;
  stylesheets: StylesheetTarget;
}

export interface MagidInstance {
  client: MagidClient;
  store: Store<MagidState>;
  prefs: Prefs;
  urlHistory: UrlHistory;
  options: ResolvedMountOptions;
  host: MagidHost;
  // A reply to the story (button, `update-symbol`, '' for the current menu); the core sends it as `cmd=story-reply`.
  send(reply: string): Promise<void>;
  addToast(message: string): void;
  dismissToast(id: string): void;
  dispose(): void;
}

let toastCount = 0;

export function createMagidInstance(options: ResolvedMountOptions, host: MagidHost): MagidInstance {
  const prefs = createPrefs(options.storagePrefix);
  const client = new MagidClient({
    baseUrl: options.baseUrl ?? DEFAULT_SERVER,
    clientType: CLIENT_TYPE,
    storage: { get: (key) => prefs.get(key) || null, set: (key, value) => prefs.set(key, value) },
    disabledCommands: options.clientConfig.showResetServerButton ? [] : ['reload-xml'],
  });
  const store = createStore<MagidState>({ ...client.getState(), toasts: [] });

  const addToast = (message: string) => {
    store.set({ toasts: [...store.get().toasts, { id: `toast-${++toastCount}`, message }] });
  };

  const stylesheets = createStylesheetSync(host.stylesheets);
  const unsubscribers = [
    client.subscribe((state) => {
      store.set(state);
      stylesheets.sync(state.stylesheets, state.fileRequestToken ?? undefined, state.sessionId ?? undefined);
    }),
    client.on('notice', ({ message }) => addToast(message)),
    client.on('viewport', ({ mode }) => {
      if (mode === 'maximized' && host.fullscreenTarget && !prefs.getBoolean(PREF_KEYS.VIEWPORT_IGNORE_MAXIMIZE)) {
        host.fullscreenTarget.requestFullscreen?.().catch(() => {});
      }
    }),
  ];

  return {
    client,
    store,
    prefs,
    urlHistory: createUrlHistory(prefs),
    options,
    host,
    send: (reply) => client.send(reply),
    addToast,
    dismissToast: (id) => store.set({ toasts: store.get().toasts.filter((t) => t.id !== id) }),
    dispose() {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      stylesheets.clear();
    },
  };
}
