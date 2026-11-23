import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamPlaceholder, type MenuResponse, type ParsedElement } from '@magiden/client-core';
import { PREF_KEYS } from '../prefs';
import { testCtx } from '../test/helpers';
import { renderMenu } from './menu';
import { renderMagidRoot } from './root';
import { renderNarration } from './narration';

const narration = (text: string, extra: object = {}): ParsedElement => ({ type: 'narration', data: { text, ...extra } }) as ParsedElement;

describe('renderers', () => {
  let ctx: ReturnType<typeof testCtx>;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    ctx = testCtx();
  });

  afterEach(() => {
    ctx.dispose();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('menu append elements', () => {
    const appended = { detached: 'append', 'element-type': 'input', 'input-name': 'name', 'input-label': 'Your name' };
    const menu = (description: string) => ({
      'menu-name': 'inn',
      'menu-description': description,
      'menu-options': [{ 'command-name': 'go', 'command-description': 'Go' }],
      'detached-elements': [appended],
    }) as MenuResponse;
    const input = () => ctx.root.querySelector('input');

    it('shows an append element once a description with DCSTP_ markers has been typed', () => {
      ctx.root.appendChild(renderMenu(ctx, menu('You enter. DCSTP_300@ The fire is warm.')));
      expect(input()).toBeNull(); // precondition: still typing

      vi.advanceTimersByTime(1000);

      expect(ctx.root.textContent).toContain('The fire is warm.');
      expect(input()).not.toBeNull();
    });

    it('shows an append element at once when text timelines are skipped', () => {
      ctx.magid.prefs.set(PREF_KEYS.NARRATION_IGNORE_TEXT_TL, 'true');
      ctx.root.appendChild(renderMenu(ctx, menu('You enter. DCSTP_300@ The fire is warm.')));
      expect(ctx.root.textContent).not.toContain('DCSTP_');
      expect(input()).not.toBeNull();
    });

    it('renders the choices as buttons that reply to the story', async () => {
      const send = vi.spyOn(ctx.magid, 'send').mockResolvedValue();
      ctx.root.appendChild(renderMenu(ctx, menu('You enter.')));
      const button = ctx.root.querySelector('button')!;
      expect(button.className).toContain('button-1-of-1');
      button.click();
      expect(send).toHaveBeenCalledWith('go');
    });
  });

  describe('narrations', () => {
    it('shows narrations one after another, each once the previous one is complete', () => {
      ctx.root.appendChild(renderMagidRoot(ctx, [narration('First DCSTP_500@ part.'), narration('Second.')]));
      vi.advanceTimersByTime(1);
      expect(ctx.root.textContent).toContain('First');
      expect(ctx.root.textContent).not.toContain('Second');

      vi.advanceTimersByTime(600);

      expect(ctx.root.textContent).toContain('First  part.');
      expect(ctx.root.textContent).toContain('Second.');
    });

    it('types letter by letter with a typing class, reveal-edge spans included', () => {
      ctx.root.appendChild(renderMagidRoot(ctx, [narration('Hello', { class: 'type-by-letter-10' })]));
      vi.advanceTimersByTime(25);
      const text = ctx.root.querySelector('.magid-default-narration')!;
      expect(text.textContent).toBe('Hel');
      expect(text.querySelector('.lastchar')?.textContent).toBe('l');

      vi.advanceTimersByTime(100);
      expect(text.textContent).toBe('Hello');
    });

    it('renders allowed HTML as elements, never as text', () => {
      ctx.magid.store.set({ htmlPolicy: { tags: ['b'], attributes: ['class'] } });
      ctx.root.appendChild(renderMagidRoot(ctx, [narration('A <b class="x">bold</b> move')]));
      expect(ctx.root.querySelector('b.x')?.textContent).toBe('bold');
      expect(ctx.root.textContent).toBe('A bold move');
    });

    it('waits for a blocking visual before the elements after it', () => {
      const visual: ParsedElement = { type: 'visual', data: { 'transition-type': 'fade', 'transition-length': '300', 'transition-blocking': 'true' } } as ParsedElement;
      ctx.root.appendChild(renderMagidRoot(ctx, [{ type: 'responses', elements: [visual, narration('After the fade.')] } as ParsedElement]));
      expect(ctx.root.textContent).not.toContain('After the fade.');

      vi.advanceTimersByTime(350);

      expect(ctx.root.textContent).toContain('After the fade.');
    });

    it('places a detached image at its anchor', () => {
      const image = { 'element-type': 'image', detached: 'by-anchor', 'text-anchor': 'IMG_1', image: 'http://stories.test/a.png', alt: 'A' };
      ctx.root.appendChild(renderMagidRoot(ctx, [narration('Look: IMG_1 there.', { 'detached-elements': [image] })]));
      const img = ctx.root.querySelector('img');
      expect(img?.alt).toBe('A');
      expect(ctx.root.textContent).not.toContain('IMG_1');
    });
  });

  describe('inputs', () => {
    it('sends update-symbol once an async input has rested', async () => {
      const send = vi.spyOn(ctx.magid, 'send').mockResolvedValue();
      const asyncInput = { detached: 'append', 'element-type': 'input', 'input-name': 'mood', 'input-async': 'true' };
      ctx.root.appendChild(renderMenu(ctx, { 'menu-name': 'inn', 'menu-description': 'Hi.', 'detached-elements': [asyncInput] } as MenuResponse));
      const input = ctx.root.querySelector('input')!;

      input.value = 'calm';
      input.dispatchEvent(new Event('input'));
      expect(ctx.magid.store.get().userInputs.mood).toBe('calm');
      vi.advanceTimersByTime(400);
      expect(send).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(send).toHaveBeenCalledWith('update-symbol');
    });
  });
  describe('streamed texts', () => {
    const ID = 'str-1';
    const delta = (no: number, text: string) => ctx.magid.client.applyStreamMessage({ 'stream-id': ID, no, delta: text });
    const done = (value: string, status: string) =>
      ctx.magid.client.applyStreamMessage({ 'stream-id': ID, done: true, status, value });
    const streamSpan = () => ctx.root.querySelector('.magid-stream');
    const showNarration = (text: string) => ctx.root.appendChild(renderNarration(ctx, { narration: text }));

    it('shows nothing in place of a stream nothing has arrived of', () => {
      showNarration(`He says: ${streamPlaceholder(ID)}`);
      expect(ctx.root.textContent).toBe('He says: ');
    });

    it('shows a stream text in a narration', () => {
      showNarration(`He says: ${streamPlaceholder(ID)}`);
      delta(1, 'Good evening');
      expect(ctx.root.textContent).toBe('He says: Good evening');
    });

    it('keeps a stream text current', () => {
      showNarration(`He says: ${streamPlaceholder(ID)}`);
      delta(1, 'Good ');
      delta(2, 'evening');
      expect(ctx.root.textContent).toBe('He says: Good evening');
    });

    it('keeps the stream element while a typed text re-renders', () => {
      ctx.root.appendChild(renderNarration(ctx, { narration: `${streamPlaceholder(ID)}DCSTP_300@ and more`, class: 'type-by-letter-20' }));
      delta(1, 'Hi');
      vi.advanceTimersByTime(50);
      const first = streamSpan();
      expect(first).not.toBeNull(); // precondition: the typewriter has reached the stream
      vi.advanceTimersByTime(2000);
      expect([streamSpan(), ctx.root.textContent]).toEqual([first, 'Hi and more']);
    });

    it('marks a running stream as open', () => {
      showNarration(streamPlaceholder(ID));
      delta(1, 'Good ');
      expect(streamSpan()?.className).toBe('magid-stream magid-stream-open');
    });

    it('marks an ended stream with its status', () => {
      showNarration(streamPlaceholder(ID));
      done('The butler says nothing.', 'failed');
      expect([streamSpan()?.className, ctx.root.textContent]).toEqual(['magid-stream magid-stream-failed', 'The butler says nothing.']);
    });

    it('inserts a stream text as text, never as markup', () => {
      showNarration(streamPlaceholder(ID));
      delta(1, '<b>bold</b>');
      expect([ctx.root.querySelector('b'), ctx.root.textContent]).toEqual([null, '<b>bold</b>']);
    });

    it('shows a stream text in a menu description', () => {
      ctx.root.appendChild(renderMenu(ctx, { 'menu-name': 'hall', 'menu-description': `A voice: ${streamPlaceholder(ID)}`, 'menu-options': [] } as MenuResponse));
      delta(1, 'Welcome.');
      expect(ctx.root.querySelector('.magid-menu-description')?.textContent).toBe('A voice: Welcome.');
    });
  });
});
