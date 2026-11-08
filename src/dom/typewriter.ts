import { typingSchedule, type TypingConfig } from '@magiden/client-core';
import type { Scope } from '../scope';

// Plays the core's typingSchedule: `show` gets the visible part of the clean text — at once (synchronously) when there
// is nothing to type, otherwise '' first (synchronously) and then each step. Stops with `scope`.
// Compare with resolveCleanText(timeline) to know when the text is complete.
export function runTypewriter(
  scope: Scope,
  timeline: string,
  config: Partial<TypingConfig>,
  skip: boolean,
  show: (visible: string) => void,
): void {
  const { text, steps } = typingSchedule(timeline, config, skip);
  if (steps.length === 0) {
    show(text);
    return;
  }
  show('');
  for (const step of steps) scope.timeout(() => show(text.slice(0, step.length)), step.at);
}
