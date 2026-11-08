// A minimal observable state container (what zustand is for the React client).
export interface Store<S> {
  get(): S;
  set(patch: Partial<S>): void;
  subscribe(listener: (state: S) => void): () => void;
  // Calls `onChange` whenever the selected value changes (Object.is), and once right away unless `immediate` is false.
  select<T>(selector: (state: S) => T, onChange: (value: T, previous: T | undefined) => void, immediate?: boolean): () => void;
}

export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<(state: S) => void>();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      for (const listener of [...listeners]) listener(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    select(selector, onChange, immediate = true) {
      let current = selector(state);
      if (immediate) onChange(current, undefined);
      return this.subscribe((s) => {
        const next = selector(s);
        if (Object.is(next, current)) return;
        const previous = current;
        current = next;
        onChange(next, previous);
      });
    },
  };
}
