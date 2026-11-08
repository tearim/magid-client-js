import { SESSION_HEADER, scopeStylesheet } from '@magiden/client-core';

// Framework-free (candidate for @magiden/client-core/dom). Same behaviour as magid-client-rct's lib/cssUtils.ts.

const ATTR = 'data-magid-file';

// Where one instance's story stylesheets go.
export interface StylesheetTarget {
  // The page's <head> (full app, or an embedded instance without a shadow root) or the instance's shadow root.
  container: HTMLElement | ShadowRoot;
  // null: page-level sheets as <link>s (the full app). Otherwise the sheet is fetched as text and scoped with
  // @magiden/client-core's scopeStylesheet: ':host' in a shadow root, or a selector for the mount element.
  scope: string | null;
}

export interface StylesheetSync {
  // Brings the injected sheets in line with the client's `stylesheets` state: new URLs are added; if any applied URL is
  // gone (story reset/switch, session end), everything is cleared and re-applied.
  sync(urls: string[], fileRequestToken?: string, sessionId?: string): void;
  clear(): void;
}

function fetchUrlOf(url: string, fileRequestToken?: string): string {
  const fetchUrl = new URL(url);
  fetchUrl.searchParams.set('cmd', 'resolve-magid-protocol');
  if (fileRequestToken) fetchUrl.searchParams.set('file-request-token', fileRequestToken);
  return fetchUrl.toString();
}

export function createStylesheetSync(target: StylesheetTarget): StylesheetSync {
  const blobUrls = new Map<string, string>();
  const injected: Element[] = [];
  let applied: string[] = [];
  // Bumped by clear(), so a sheet that arrives after a story switch isn't added to the new story.
  let generation = 0;

  async function inject(url: string, fileRequestToken?: string, sessionId?: string): Promise<void> {
    if (injected.some((el) => el.getAttribute(ATTR) === url)) return;
    const at = generation;
    const fetchUrl = fetchUrlOf(url, fileRequestToken);

    try {
      const headers: Record<string, string> = {};
      if (sessionId) headers[SESSION_HEADER] = sessionId;
      const res = await fetch(fetchUrl, Object.keys(headers).length ? { headers } : undefined);
      if (!res.ok) {
        console.warn(`[magid] Failed to fetch CSS: ${url} (${res.status})`);
        return;
      }
      if (target.scope !== null) {
        const { css, documentCss } = scopeStylesheet(await res.text(), target.scope);
        if (at !== generation) return;
        add(target.container, 'style', url, (el) => { el.textContent = css; });
        // @font-face / @property only work at document level.
        if (documentCss) add(document.head, 'style', url, (el) => { el.textContent = documentCss; });
        return;
      }

      // When the session header is sent, <link href> can't carry it — always use a blob URL.
      let href = fetchUrl;
      if (!sessionId && (res.headers.get('Content-Type') ?? '').includes('text/css')) {
        await res.body?.cancel();
      } else {
        href = URL.createObjectURL(new Blob([await res.text()], { type: 'text/css' }));
        blobUrls.set(url, href);
      }
      if (at !== generation) return;
      add(target.container, 'link', url, (el) => { (el as HTMLLinkElement).rel = 'stylesheet'; (el as HTMLLinkElement).href = href; });
    } catch (e) {
      console.warn(`[magid] Failed to fetch CSS: ${url}`, e);
    }
  }

  function add(parent: HTMLElement | ShadowRoot, tag: 'style' | 'link', url: string, fill: (el: HTMLElement) => void): void {
    const el = document.createElement(tag);
    el.setAttribute(ATTR, url);
    fill(el);
    parent.appendChild(el);
    injected.push(el);
  }

  function clear(): void {
    generation++;
    injected.splice(0).forEach((el) => el.remove());
    blobUrls.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
    blobUrls.clear();
    applied = [];
  }

  function sync(urls: string[], fileRequestToken?: string, sessionId?: string): void {
    if (urls === applied) return;
    const keepsApplied = applied.every((u) => urls.includes(u));
    if (!keepsApplied) clear();
    const alreadyApplied = keepsApplied ? applied : [];
    for (const url of urls) {
      if (!alreadyApplied.includes(url)) void inject(url, fileRequestToken, sessionId);
    }
    applied = urls;
  }

  return { sync, clear };
}
