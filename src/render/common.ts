import { applyImpliedClasses } from '@magiden/client-core';
import type { MagidInstance, MagidState } from '../instance';
import type { Scope } from '../scope';

// What every renderer gets: the instance it belongs to and the scope its timers and subscriptions live in.
export interface Ctx {
  magid: MagidInstance;
  scope: Scope;
}

export function childCtx(ctx: Ctx): Ctx {
  return { magid: ctx.magid, scope: ctx.scope.child() };
}

// Calls `onChange` now and whenever the selected state changes, for as long as `scope` lives.
export function watch<T>(ctx: Ctx, selector: (s: MagidState) => T, onChange: (value: T) => void): void {
  ctx.scope.add(ctx.magid.store.select(selector, onChange));
}

// Calls `onChange` now and whenever any of the selected values changes (once per change).
export function watchAll(ctx: Ctx, selectors: ((s: MagidState) => unknown)[], onChange: () => void): void {
  for (const selector of selectors) ctx.scope.add(ctx.magid.store.select(selector, onChange, false));
  onChange();
}

// className plus the classes implied by the server's `implied-classes-of:` vars; follows var changes.
export function watchImpliedClasses(ctx: Ctx, className: string | undefined, onChange: (classes: string | undefined) => void): void {
  watch(ctx, (s) => s.envVars, (envVars) => onChange(applyImpliedClasses(className, envVars)));
}

export function deferMsOf(defer: string | undefined): number {
  const ms = defer ? parseInt(defer, 10) : 0;
  return Number.isFinite(ms) ? ms : 0;
}

// `width="200"` means pixels, as in HTML; anything else (`50%`, `12em`) is a CSS length already.
export function cssLength(value: string): string {
  return /^\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()}px` : value;
}
