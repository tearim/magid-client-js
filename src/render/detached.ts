import { parseMagidCss, type DetachedElementResponse } from '@magiden/client-core';
import { h, setStyle } from '../dom/h';
import { renderMagidImage } from './image';
import { watch, watchImpliedClasses, type Ctx } from './common';

// Single source of truth: maps element-type → renderer. Add new detached element types here only.
const DETACHED_ELEMENT_RENDERERS: Record<string, (ctx: Ctx, data: DetachedElementResponse) => Node | null> = {
  input: (ctx, data) => renderInput(ctx, data),
  image: (ctx, data) => renderMagidImage(ctx, data),
};

export function renderDetached(ctx: Ctx, data: DetachedElementResponse): Node | null {
  const render = DETACHED_ELEMENT_RENDERERS[data['element-type']];
  if (!render) {
    console.warn(`[magid] Unknown detached element-type: ${data['element-type']}`);
    return null;
  }
  return render(ctx, data);
}

interface InputType {
  create(id: string, name: string): HTMLInputElement;
  read(input: HTMLInputElement): string;
  write(input: HTMLInputElement, value: string): void;
}

const text = (type: string): InputType => ({
  create: (id, name) => h('input', { id, name: `user-input-${name}`, type }),
  read: (input) => input.value,
  write: (input, value) => { if (input.value !== value) input.value = value; },
});

// Single source of truth: maps input-type → renderer. Add new input types here only.
const INPUT_TYPES: Record<string, InputType> = {
  text: text('text'),
  number: text('number'),
  checkbox: {
    create: (id, name) => h('input', { id, name: `user-input-${name}`, type: 'checkbox' }),
    read: (input) => (input.checked ? 'true' : 'false'),
    write: (input, value) => { input.checked = value === 'true'; },
  },
};

// Async inputs tell the server about a change once the value has rested this long (`update-symbol`).
const ASYNC_DEBOUNCE_MS = 500;
let inputCount = 0;

// An <input> the story placed (detached): its value lives in the client's userInputs (sent with every reply as
// user-input-<name>); an async one also sends `update-symbol` after the value has rested.
export function renderInput(ctx: Ctx, data: DetachedElementResponse): Node | null {
  const inputType = data['input-type'] ?? 'text';
  const type = INPUT_TYPES[inputType];
  if (!type) {
    console.warn(`[magid] Unknown input-type: ${inputType}`);
    return null;
  }
  const { magid } = ctx;
  const id = `magid-input-${++inputCount}`;
  const name = data['input-name'] ?? '';
  const isAsync = (data['input-async'] ?? '').toLowerCase() === 'true';

  const input = type.create(id, name);
  setStyle(input, data.css ? parseMagidCss(data.css) : undefined);
  watchImpliedClasses(ctx, data.class, (classes) => { input.className = ['magid-input-element', classes].filter(Boolean).join(' '); });
  input.addEventListener(inputType === 'checkbox' ? 'change' : 'input', () => magid.client.setUserInput(name, type.read(input)));

  let debounced = magid.store.get().userInputs[name] ?? '';
  let cancelDebounce: (() => void) | undefined;
  let first = true;
  watch(ctx, (s) => s.userInputs[name] ?? '', (value) => {
    type.write(input, value);
    if (first) { first = false; return; }
    cancelDebounce?.();
    cancelDebounce = ctx.scope.timeout(() => {
      if (value === debounced) return;
      debounced = value;
      if (isAsync && value) void magid.send('update-symbol');
    }, ASYNC_DEBOUNCE_MS);
  });

  return h('span', { class: 'magid-input-wrapper' },
    data['input-label'] ? h('label', { htmlFor: id }, data['input-label']) : null,
    input,
  );
}
