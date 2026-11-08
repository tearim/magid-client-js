import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { STORAGE_KEYS } from '@magiden/client-core';
import { mountMagid, type MagidHandle } from './mount';
import { fakeServer, SERVER } from './test/helpers';

const session = { 'session-id': 'sess-1', 'file-request-token': 'tok-1', 'server-name': 'Magid' };
const menu = { menu: 'inn', 'menu-description': 'You are at the inn.', 'menu-options': [{ 'command-name': 'go', 'command-description': 'Go' }] };
const batch = { responses: [session, menu] };

async function mount(element: HTMLElement, options: Parameters<typeof mountMagid>[1]): Promise<MagidHandle> {
  const handle = mountMagid(element, { baseUrl: SERVER, ...options });
  await vi.waitFor(() => expect((element.shadowRoot ?? element).textContent).toContain('You are at the inn.'));
  return handle;
}

describe('mountMagid', () => {
  let element: HTMLElement;
  let handle: MagidHandle | undefined;

  beforeEach(() => {
    localStorage.clear();
    element = document.createElement('section');
    document.body.appendChild(element);
  });

  afterEach(() => {
    handle?.unmount();
    handle = undefined;
    element.remove();
    vi.unstubAllGlobals();
  });

  it('renders an embedded story into a shadow root of the element, with no page chrome', async () => {
    fakeServer(batch);
    handle = await mount(element, {});

    const shadow = element.shadowRoot!;
    expect(element.childNodes).toHaveLength(0);
    expect(shadow.querySelector('.magid-app-root.magid-embedded')).not.toBeNull();
    expect(shadow.querySelector('style')?.textContent).toContain(':host');
    expect(shadow.querySelector('header')).toBeNull();
    expect(document.head.querySelector('style[data-magid-app-css]')).toBeNull();
  });

  it('announces itself as a browser client', async () => {
    const server = fakeServer(batch);
    handle = await mount(element, {});
    expect(new URL(server.urls[0]).searchParams.get('client-type')).toBe('browser');
  });

  it('keeps an embedded instance’s storage under its prefix', async () => {
    fakeServer(batch);
    handle = await mount(element, {});

    expect(localStorage.getItem(`magid.${STORAGE_KEYS.SESSION_ID}`)).toBe('sess-1');
    expect(localStorage.getItem(STORAGE_KEYS.SESSION_ID)).toBeNull();
  });

  it('loads the given story for a new session only', async () => {
    const server = fakeServer(batch);
    handle = await mount(element, { story: 'oasis/oasis.xml' });
    await vi.waitFor(() => expect(server.commands()).toEqual(['', 'set-xml', '']));

    handle.unmount();
    server.urls.length = 0;
    handle = await mount(element, { story: 'oasis/oasis.xml' });
    await new Promise((r) => setTimeout(r, 20));
    expect(server.commands()).toEqual(['']);
  });

  it('sends a menu choice as a reply to the story', async () => {
    const server = fakeServer(batch);
    handle = await mount(element, {});

    element.shadowRoot!.querySelector<HTMLButtonElement>('.magid-common-button')!.click();

    await vi.waitFor(() => expect(server.urls).toHaveLength(2));
    expect(server.commands()[1]).toBe('story-reply');
    expect(server.replies()[1]).toBe('go');
  });

  it('scopes to the element instead of a shadow root with isolation none', async () => {
    fakeServer(batch);
    handle = await mount(element, { isolation: 'none' });

    expect(element.shadowRoot).toBeNull();
    expect(element.getAttribute('data-magid-mount')).not.toBeNull();
    expect(element.querySelector('.magid-app-root')?.textContent).toContain('You are at the inn.');
  });

  it('removes what it added when unmounted', async () => {
    fakeServer(batch);
    handle = await mount(element, { isolation: 'none' });

    handle.unmount();
    handle = undefined;

    expect(element.childNodes).toHaveLength(0);
    expect(element.hasAttribute('data-magid-mount')).toBe(false);
  });

  it('runs the full app with its chrome and unprefixed storage', async () => {
    fakeServer(batch);
    handle = await mount(element, { mode: 'app' });

    expect(element.shadowRoot).toBeNull();
    expect(element.querySelector('header')).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.SESSION_ID)).toBe('sess-1');
  });
});
