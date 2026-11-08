// localStorage-backed preferences of one Magid instance. Embedded instances prefix their keys (MagidMountOptions
// storagePrefix), so they can't collide with the host page's own keys; the full app uses no prefix.
export function createPrefs(prefix = '') {
  const key = (k: string) => prefix + k;
  return {
    get:        (k: string, fallback = '') => localStorage.getItem(key(k)) ?? fallback,
    getBoolean: (k: string) => localStorage.getItem(key(k)) === 'true',
    getDouble:  (k: string) => parseFloat(localStorage.getItem(key(k)) ?? '0') || 0,
    set:        (k: string, v: string)  => localStorage.setItem(key(k), v),
    setBoolean: (k: string, v: boolean) => localStorage.setItem(key(k), String(v)),
    setDouble:  (k: string, v: number)  => localStorage.setItem(key(k), String(v)),
  };
}

export type Prefs = ReturnType<typeof createPrefs>;

export const PREF_KEYS = {
  SERVER_ADDRESS:             'server.address',
  STORY_XML:                  'story.xml',
  STARTUP_ARM_XML:            'startup.arm.xml',
  NARRATION_IGNORE_TIMELINES: 'narration.ignoretimelines',
  NARRATION_IGNORE_TEXT_TL:   'narration.ignoretexttimelines',
  VIEWPORT_IGNORE_MAXIMIZE:   'viewport.ignoremaximization',
  DEBUG_ALWAYS_ALLOW_CONNECTIVITY: 'debug.alwaysallowconnectivity',
  MUSIC_VOLUME:               'music.volume',
  // Session id / file request token are persisted by @magiden/client-core (STORAGE_KEYS) through these prefs.
} as const;

const URL_HISTORY_KEY = 'server.address.history';
const URL_HISTORY_MAX = 10;

export function createUrlHistory(prefs: Prefs) {
  return {
    get(): string[] {
      try {
        return JSON.parse(prefs.get(URL_HISTORY_KEY, '[]')) as string[];
      } catch {
        return [];
      }
    },
    add(url: string): void {
      const list = this.get().filter((u) => u !== url);
      list.unshift(url);
      prefs.set(URL_HISTORY_KEY, JSON.stringify(list.slice(0, URL_HISTORY_MAX)));
    },
  };
}

export type UrlHistory = ReturnType<typeof createUrlHistory>;
