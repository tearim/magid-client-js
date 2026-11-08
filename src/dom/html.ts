import { parseMagidCss, VOID_TAGS, type HtmlNode } from '@magiden/client-core';
import { setStyle } from './h';

// Builds DOM from the core's sanitized HTML tree (see the core's html.ts) — never via innerHTML.
// `renderText` renders each text node; `isLast` marks the last one, where a typewriter's reveal edge is.
// `renderAnchor` returns what belongs at an anchor (a detached element); return the same node every time, so an input
// keeps its state while the text around it is re-rendered.
export function renderHtml(
  nodes: HtmlNode[],
  renderText: (text: string, isLast: boolean) => Node,
  renderAnchor?: (anchor: string) => Node | null,
): DocumentFragment {
  let textNodesLeft = countTextNodes(nodes);
  const render = (list: HtmlNode[], parent: Node): void => {
    for (const node of list) {
      if (node.type === 'text') {
        textNodesLeft--;
        parent.appendChild(renderText(node.text, textNodesLeft === 0));
      } else if (node.type === 'anchor') {
        const anchored = renderAnchor?.(node.anchor);
        if (anchored) parent.appendChild(anchored);
      } else {
        const el = document.createElement(node.tag);
        for (const [name, value] of Object.entries(node.attributes)) {
          if (name === 'style') setStyle(el, parseMagidCss(value));
          else el.setAttribute(name, value);
        }
        if (!VOID_TAGS.includes(node.tag)) render(node.children, el);
        parent.appendChild(el);
      }
    }
  };
  const fragment = document.createDocumentFragment();
  render(nodes, fragment);
  return fragment;
}

function countTextNodes(nodes: HtmlNode[]): number {
  let n = 0;
  for (const node of nodes) n += node.type === 'text' ? 1 : node.type === 'anchor' ? 0 : countTextNodes(node.children);
  return n;
}
