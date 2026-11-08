// A small element builder: h('button', { class: 'x', on: { click } }, 'Text').
// Props: `class` (string or a list; falsy entries skipped), `style` (a camelCased style object such as
// parseMagidCss returns), `on` (event listeners), `attrs` (attributes; false/undefined skip, true = empty), and anything
// else is set as a DOM property (type, value, checked, disabled, title, tabIndex, …).

export type Child = Node | string | number | null | undefined | false;

export interface Props {
  class?: string | (string | false | null | undefined)[];
  style?: Record<string, string>;
  on?: { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };
  attrs?: Record<string, string | boolean | undefined>;
  [property: string]: unknown;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K];
export function h(tag: string, props?: Props | null, ...children: Child[]): HTMLElement;
export function h(tag: string, props?: Props | null, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  if (props) applyProps(el, props);
  append(el, ...children);
  return el;
}

export function applyProps(el: HTMLElement, props: Props): void {
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (key === 'class') {
      const list = Array.isArray(value) ? value : [value];
      el.className = list.filter(Boolean).join(' ');
    } else if (key === 'style') {
      setStyle(el, value as Record<string, string>);
    } else if (key === 'on') {
      for (const [type, listener] of Object.entries(value as Record<string, EventListener>)) {
        if (listener) el.addEventListener(type, listener);
      }
    } else if (key === 'attrs') {
      for (const [name, attr] of Object.entries(value as Record<string, string | boolean | undefined>)) {
        if (attr === undefined || attr === false) continue;
        el.setAttribute(name, attr === true ? '' : attr);
      }
    } else {
      (el as unknown as Record<string, unknown>)[key] = value;
    }
  }
}

// camelCased keys (parseMagidCss), custom properties (--x) and kebab-case keys all work.
export function setStyle(el: HTMLElement, style: Record<string, string> | undefined): void {
  if (!style) return;
  for (const [name, value] of Object.entries(style)) {
    if (name.startsWith('--') || name.includes('-')) el.style.setProperty(name, value);
    else (el.style as unknown as Record<string, string>)[name] = value;
  }
}

export function append(parent: Node, ...children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
}

// Replaces a node's children.
export function replaceChildren(parent: Element | DocumentFragment, ...children: Child[]): void {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
  append(parent, ...children);
}
