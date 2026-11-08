import appCss from './styles/app.css?inline';
import { createMagidInstance, type MagidHost } from './instance';
import { resolveMountOptions, type MagidMountOptions } from './options';
import { Scope } from './scope';
import { renderApp } from './ui/app';

export interface MagidHandle {
  unmount(): void;
}

// The shadow root's own rules: the page's inherited styles (font, colour, …) stop at the border.
const HOST_CSS = ':host { all: initial; display: block; position: relative; }';
const APP_CSS_ATTR = 'data-magid-app-css';

let mountCount = 0;

// Mounts a Magid instance into `element`. The full app (main.ts) uses mode 'app' on #root; anything else embeds Magid
// into one element of a page that isn't Magid's own. Same options and behaviour as magid-client-rct's mountMagid.
export function mountMagid(element: HTMLElement, options: MagidMountOptions = {}): MagidHandle {
  const resolved = resolveMountOptions(options);
  const embedded = resolved.mode === 'embedded';
  const scope = new Scope();

  const root = document.createElement('div');
  root.className = embedded ? 'magid-app-root magid-embedded' : 'magid-app-root';

  let host: MagidHost;
  if (!embedded) {
    addStyle(document.head, appCss, true);
    element.appendChild(root);
    host = {
      root,
      keyTarget: window,
      fullscreenTarget: document.documentElement,
      setWindowSize: (width, height) => sizeElement(document.documentElement, width, height),
      overlayTarget: null,
      stylesheets: { container: document.head, scope: null },
    };
  } else {
    // Focusable, so its keyboard shortcuts only react while Magid has focus.
    root.tabIndex = 0;
    let container: HTMLElement | ShadowRoot;
    let cssScope: string;
    if (resolved.isolation === 'shadow') {
      const shadow = element.shadowRoot ?? element.attachShadow({ mode: 'open' });
      scope.add(addStyle(shadow, `${HOST_CSS}\n${appCss}`, false));
      shadow.appendChild(root);
      container = shadow;
      cssScope = ':host';
    } else {
      const id = String(++mountCount);
      element.setAttribute('data-magid-mount', id);
      scope.add(() => element.removeAttribute('data-magid-mount'));
      addStyle(document.head, appCss, true);
      element.appendChild(root);
      container = document.head;
      cssScope = `[data-magid-mount="${id}"]`;
    }
    host = {
      root,
      keyTarget: root,
      fullscreenTarget: resolved.fullscreen === 'element' ? element : null,
      setWindowSize: (width, height) => sizeElement(root, width, height),
      overlayTarget: root,
      stylesheets: { container, scope: cssScope },
    };
  }

  const magid = createMagidInstance(resolved, host);
  scope.add(() => magid.dispose());
  root.appendChild(renderApp({ magid, scope: scope.child() }));
  scope.add(() => root.remove());

  return { unmount: () => scope.dispose() };
}

function sizeElement(element: HTMLElement, width: number | undefined, height: number | undefined): void {
  if (width !== undefined) element.style.width = `${width}px`;
  if (height !== undefined) element.style.height = `${height}px`;
}

// The app's CSS. In the page's <head> it is added once and stays (other instances may use it); in a shadow root it
// goes with the instance. Returns a cleanup.
function addStyle(target: HTMLElement | ShadowRoot, css: string, shared: boolean): () => void {
  if (shared && target.querySelector(`style[${APP_CSS_ATTR}]`)) return () => {};
  const style = document.createElement('style');
  style.setAttribute(APP_CSS_ATTR, '');
  style.textContent = css;
  target.appendChild(style);
  return shared ? () => {} : () => style.remove();
}
