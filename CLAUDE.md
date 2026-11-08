# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repository.

## What this is

A framework-free browser client for the Magid server (TypeScript → plain JS, no framework at runtime), on
`@magiden/client-core`. It **mirrors magid-client-rct** (`C:\developer\magid-client-rct`, React): same screens, story
rendering, options, embedding API and look. When rct changes behaviour, this client follows, and the other way round;
note deliberate differences here.

- **Protocol, parsing and presentation semantics live in the core** (`C:\developer\magid-client-core`, own repo, npm
  `@magiden/client-core`): transport, session/recovery, `ParsedElement`s, typing (`typingSchedule`,
  `getConsequentalTypingConfig`), implied classes, inline CSS, HTML (`prepareDisplayText`/`truncateHtml`), stylesheet
  scoping. Never re-implement them here; if something new is needed by any renderer, it goes into the core first.
- **The server** (`C:\developer\com.zarterstein`) is the source of truth for the wire protocol; don't change it from here.

## Working with the owner

- **Report problems; don't fix them unasked.** Bugs, smells or doc/code mismatches outside the task go to
  `OPEN-ISSUES.md` (where, why it matters, suggested fix) and into your reply. Fix only what the task covers.
- **Assess requests before implementing**; say why if something looks like a bad idea.
- **Tests specify correct behaviour**, with neutral names (no "BUG", "currently fails", …). Check a failing test's own
  premise before trusting it.
- **Don't commit or push unless asked.** Publishing to npm is the owner's step (the package is `private` for now).
- **No new lint or type errors** (`npm run lint`, `npm run typecheck` are clean).

## Commands

```sh
npm install           # see below if it fails with "Cannot read properties of null (reading 'edgesOut')"
npm run dev           # full app at /, embedding example at /examples/embed.html
npm run build         # dist/
npm run build:embed   # dist-embed/magid-embed.js (one ES module, CSS inlined)
npm test              # vitest + jsdom
npm run typecheck && npm run lint
```

npm 10.8.1 crashes resolving vitest's peer dependencies in a fresh install (`edgesOut`). With the committed
`package-lock.json` a plain `npm install` works; to change devDependencies, run the install with a newer npm:
`npx -y npm@11 install …`.

## Architecture (`src/`)

- `mount.ts`: `mountMagid(element, options)` (options in `options.ts`, as in rct). Builds the instance's `MagidHost`
  (keys, fullscreen, `-mg-window-*`, overlay and stylesheet targets: the page for `mode: 'app'`, the element when
  embedded; shadow root by default) and injects the app CSS (`styles/app.css`, imported `?inline`) into the shadow
  root or `<head>`. `main.ts` mounts the full app; `index.ts` is the embed build's entry.
- `instance.ts`: one `MagidInstance` per mount: the core's `MagidClient` (`clientType` `browser`), a `Store` mirroring
  its state plus toasts (`store.ts`, a tiny zustand stand-in with `select`), prefs with the storage prefix
  (`prefs.ts`), stylesheet sync, `notice` → toast, `viewport` → fullscreen.
- `scope.ts`: `Scope`, the lifetime of a piece of UI (timers, listeners, store subscriptions, child scopes) — what
  React effect cleanups are in rct. Every renderer gets a `Ctx` (`{ magid, scope }`, `render/common.ts`); use
  `watch`/`watchAll`/`watchImpliedClasses` for state, `scope.timeout`/`listen` for the rest. Nothing may outlive its
  scope.
- `render/`: the story. `root.ts` (`renderMagidRoot`, `renderElement`, the narration queue and blocking visuals, as
  rct's MagidRoot/ResponsesContainer), `narration.ts`, `menu.ts`, `command.ts`, `image.ts`, `visual.ts`,
  `detached.ts` (`DETACHED_ELEMENT_RENDERERS`, `INPUT_TYPES`: add new types there). Typed texts re-render their DOM on
  every typing step; detached elements and images are built once and reused, so inputs keep focus and state.
- `ui/`: the app around the story: `app.ts` (shell, header, screens, startup, story-only chrome), `pages.ts` (welcome,
  lobby), `options.ts`, `stats.ts`, `toasts.ts`. The screen is rebuilt per batch of elements (the core clears them while
  a request runs), like rct.
- `dom/`: framework-free DOM helpers — `h` (element builder), `html.ts` (core HTML tree → DOM), `text.ts` (line breaks
  and typing-style spans, a port of rct's `renderText.tsx`), `typewriter.ts` (plays `typingSchedule`),
  `stylesheets.ts`, `audio.ts`. Owner's decision (2026-11-08): they stay here for now and may move to
  `@magiden/client-core/dom` once settled and rct uses them too.
- `styles/app.css`: generated from rct's `index.css` and CSS modules (classes prefixed `mg-<component>-`, keyframes
  `mg-…`), plus a few rules of its own at the end. When rct's CSS changes, regenerate or port the change.
- Tests: `render/render.test.ts` (renderers with fake timers), `mount.test.ts` (mounting against a fake server);
  helpers in `test/helpers.ts`.
