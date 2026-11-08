// The lifetime of a piece of UI: everything it starts (timers, listeners, store subscriptions, child pieces) is
// registered here and undone by dispose(). Plays the role of React's effect cleanups.
export class Scope {
  private cleanups: (() => void)[] = [];
  private disposed = false;

  get alive(): boolean {
    return !this.disposed;
  }

  add(cleanup: () => void): void {
    if (this.disposed) cleanup();
    else this.cleanups.push(cleanup);
  }

  timeout(fn: () => void, ms: number): () => void {
    const id = setTimeout(() => { if (!this.disposed) fn(); }, ms);
    const cancel = () => clearTimeout(id);
    this.add(cancel);
    return cancel;
  }

  interval(fn: () => void, ms: number): () => void {
    const id = setInterval(() => { if (!this.disposed) fn(); }, ms);
    const cancel = () => clearInterval(id);
    this.add(cancel);
    return cancel;
  }

  listen(target: EventTarget, type: string, listener: (event: Event) => void): void {
    target.addEventListener(type, listener);
    this.add(() => target.removeEventListener(type, listener));
  }

  // A scope that ends with this one, or earlier by its own dispose().
  child(): Scope {
    const child = new Scope();
    this.add(() => child.dispose());
    return child;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const cleanups = this.cleanups.splice(0).reverse();
    for (const cleanup of cleanups) cleanup();
  }
}
