import { clientConfig, type ClientConfig } from './config';

// How a Magid instance is mounted (the same options as magid-client-rct's mountMagid).
// - 'app': Magid owns the page (main.ts): page-level stylesheets, fullscreen and window sizing, Options/Stats.
// - 'embedded': Magid lives inside one element of someone else's page and stays inside it.
export type MagidMode = 'app' | 'embedded';

export interface MagidMountOptions {
  mode?: MagidMode;
  // Server to talk to. Embedded: the operator's server (default http://localhost:8090). App: the saved pref wins.
  baseUrl?: string;
  // Story to load when the instance starts a new session (the XML path the server lists in list-xmls). An instance
  // that resumes a stored session keeps its story and progress.
  story?: string;
  // 'story': only the story (no welcome/lobby pages, header, Options or Stats). Default: 'full' for the app, 'story'
  // when embedded.
  chrome?: 'full' | 'story';
  // Embedded only. 'shadow': Magid renders into a shadow root, so neither the page's CSS nor the story's crosses it.
  // 'none': the CSS goes into the page's <head>, every selector scoped to the element.
  isolation?: 'shadow' | 'none';
  // Prefix for localStorage keys (prefs, session). Default: '' for the app, 'magid.' when embedded.
  storagePrefix?: string;
  // What a story's `viewport: maximized` makes fullscreen. Embedded: 'off' (default) or 'element'.
  fullscreen?: 'element' | 'off';
  // Overrides of the compiled-in operator config.
  clientConfig?: Partial<ClientConfig>;
}

export interface ResolvedMountOptions {
  mode: MagidMode;
  baseUrl: string | undefined;
  story: string | undefined;
  chrome: 'full' | 'story';
  isolation: 'shadow' | 'none';
  storagePrefix: string;
  fullscreen: 'element' | 'off';
  clientConfig: ClientConfig;
}

export const DEFAULT_SERVER = 'http://localhost:8090';

export function resolveMountOptions(options: MagidMountOptions = {}): ResolvedMountOptions {
  const app = (options.mode ?? 'embedded') === 'app';
  return {
    mode: app ? 'app' : 'embedded',
    baseUrl: options.baseUrl,
    story: options.story,
    chrome: options.chrome ?? (app ? 'full' : 'story'),
    isolation: options.isolation ?? 'shadow',
    storagePrefix: options.storagePrefix ?? (app ? '' : 'magid.'),
    fullscreen: app ? 'element' : options.fullscreen ?? 'off',
    clientConfig: { ...clientConfig, ...options.clientConfig },
  };
}
