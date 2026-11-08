import { h } from './h';

// A port of magid-client-rct's lib/renderText.tsx: a text node of a narration or menu description as DOM, with line
// breaks, and the typing-style spans story CSS animates (lastchar…lastchar3 at the reveal edge, `animated` per letter or
// word for the isolating styles).

export const TypingStyle = {
  byLetter: 'byLetter',
  byLetterIsolating: 'byLetterIsolating',
  byWord: 'byWord',
  byWordIsolating: 'byWordIsolating',
} as const;
export type TypingStyle = keyof typeof TypingStyle;

// Bookkeeping for animation-resets-N (when the reveal-edge effects are dropped for one render), kept per page like the
// React client's.
let lastTimeCleared = Date.now();
const lastRawLineUsed: string[] = [];

export function renderWithBreaks(text: string, typingStyle?: TypingStyle, animationResets = 0): DocumentFragment {
  const out = document.createDocumentFragment();
  const lines = text.split(/\r?\n/);
  let needToClear = false;
  if (animationResets > 0 && Date.now() > lastTimeCleared + animationResets) {
    needToClear = true;
    lastTimeCleared = Date.now();
  }
  const br = (i: number) => { if (i > 0) out.appendChild(h('br')); };
  const span = (className: string, content: string) => h('span', { class: className }, content);

  if (typingStyle === TypingStyle.byLetterIsolating) {
    lines.forEach((line, i) => {
      br(i);
      for (const word of line.split(/\s/)) {
        const joiner = h('span', { class: 'word-joiner' });
        for (const letter of word) joiner.appendChild(span('animated', letter));
        joiner.appendChild(document.createTextNode(' '));
        out.appendChild(joiner);
      }
      out.appendChild(h('br'));
    });
    return out;
  }

  if (typingStyle === TypingStyle.byLetter) {
    lines.forEach((line, i) => {
      if (animationResets > 0) {
        if (lastRawLineUsed[i] === line && i === lines.length - 1) needToClear = false;
        lastRawLineUsed[i] = line;
        if (needToClear && i === lines.length - 1) {
          lastTimeCleared = Date.now();
          needToClear = false;
          br(i);
          out.appendChild(document.createTextNode(line));
          return;
        }
      }
      br(i);
      const n = line.length;
      out.appendChild(document.createTextNode(line.substring(0, n - 4)));
      out.appendChild(span('lastchar3', line.substring(n - 4, n - 3)));
      out.appendChild(span('lastchar2', line.substring(n - 3, n - 2)));
      out.appendChild(span('lastchar1', line.substring(n - 2, n - 1)));
      out.appendChild(span('lastchar', line.substring(n - 1, n)));
    });
    return out;
  }

  if (typingStyle === TypingStyle.byWord || typingStyle === TypingStyle.byWordIsolating) {
    lines.forEach((line, i) => {
      if (lastRawLineUsed[i] === line && i === lines.length - 1) needToClear = false;
      lastRawLineUsed[i] = line;
      const words = line.trim().split(/\s+/);
      br(i);
      if (typingStyle === TypingStyle.byWordIsolating) {
        for (const word of words) out.appendChild(span('animated', `${word} `));
        return;
      }
      const lastWords = words.splice(-4);
      if (needToClear && i === lines.length - 1) {
        lastTimeCleared = Date.now();
        needToClear = false;
        out.appendChild(document.createTextNode(line));
        out.appendChild(h('br'));
        return;
      }
      out.appendChild(document.createTextNode(words.join(' ')));
      ['lastchar3', 'lastchar2', 'lastchar1', 'lastchar'].forEach((className, k) => {
        if (lastWords[k] !== undefined) out.appendChild(span(className, ` ${lastWords[k]}`));
      });
    });
    return out;
  }

  lines.forEach((line, i) => {
    br(i);
    out.appendChild(document.createTextNode(line));
  });
  return out;
}
