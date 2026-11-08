import { vi } from 'vitest';
import { createMagidInstance, type MagidInstance } from '../instance';
import { resolveMountOptions, type MagidMountOptions } from '../options';
import type { Ctx } from '../render/common';
import { Scope } from '../scope';

// A Magid instance for renderer tests: an embedded-style host on a detached element, nothing sent to a server.
export function testCtx(options: MagidMountOptions = {}): Ctx & { root: HTMLElement; dispose(): void } {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const magid: MagidInstance = createMagidInstance(resolveMountOptions(options), {
    root,
    keyTarget: root,
    fullscreenTarget: null,
    setWindowSize: () => {},
    overlayTarget: root,
    stylesheets: { container: document.head, scope: null },
  });
  const scope = new Scope();
  return {
    magid, scope, root,
    dispose() { scope.dispose(); magid.dispose(); root.remove(); },
  };
}

export const SERVER = 'http://stories.test';

// Answers every request with `body` (or the next of `bodies`) and records the URLs.
export function fakeServer(...bodies: object[]) {
  const urls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url);
    const body = bodies.length > 1 ? bodies.shift() : bodies[0];
    return new Response(JSON.stringify(body), { status: 200 });
  }));
  return { urls, commands: () => urls.map((u) => new URL(u).searchParams.get('cmd')), replies: () => urls.map((u) => new URL(u).searchParams.get('reply')) };
}

export async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}
