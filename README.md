# magid-client-js

A framework-free browser client for the [Magid](https://github.com/tearim/magid-client-core) storytelling server, built
on [`@magiden/client-core`](https://www.npmjs.com/package/@magiden/client-core). It runs as the full app or inside one
element of any page. Plain TypeScript compiled to JavaScript: no React, Vue or other framework at runtime, and no
runtime dependencies besides the core.

It mirrors the React client ([magid-client-rct](https://github.com/tearim/magid-client-rct)): same screens, same story
rendering, same options, same embedding API, same look.

## What it does

- **Full app:** welcome page, server lobby, header (Options, status, Reset server, Connect, End session), Options dialog
  (server address with history, story XML selection, startup auto-load, timeline toggles, music volume), Server Stats
  dashboard, toasts.
- **Story rendering:** narrations typed out over their `DCSTP_` timelines and typing classes (`type-by-letter-…`,
  `type-by-word-…`, `animation-resets-…`), allowed HTML (sanitized by the core, never `innerHTML`), implied classes,
  menus with their choices, `menu-css`, background music, fades, standalone and inline images, detached inputs (text,
  number, checkbox; async ones send `update-symbol`), story stylesheets.
- **Embedding:** `mountMagid(element, options)`, by default in a shadow root, so the page's CSS and the story's CSS don't
  affect each other.

## Run

```sh
npm install
npm run dev          # http://localhost:5173 — the full app
                     # http://localhost:5173/examples/embed.html — Magid embedded in a host page
npm run build        # dist/: the full app
npm run build:embed  # dist-embed/magid-embed.js: one ES module, CSS included
npm test             # vitest (jsdom)
npm run typecheck
npm run lint
```

The default server is `http://localhost:8090`. The client announces itself as `client-type=browser`, which selects the
stories' web stylesheets (`<link client-type="browser,react">`).

## Embedding

```html
<section id="story" style="height: 600px"></section>
<script type="module">
  import { mountMagid } from './magid-embed.js';
  const magid = mountMagid(document.getElementById('story'), {
    baseUrl: 'https://stories.example.org',
    story: 'oasis/oasis.xml',   // loaded for a new session; a returning player resumes their session
  });
  // magid.unmount();
</script>
```

Options (the same as the React client's): `chrome: 'full' | 'story'` (default `'story'` when embedded: only the story),
`isolation: 'shadow' | 'none'` (`'none'`: CSS in the page's `<head>`, scoped to the element), `fullscreen: 'element' |
'off'`, `storagePrefix` (default `magid.`), `clientConfig`. The page's origin must be in the server's
`magid.server.allowed-cors-origins`.

## Status

Version 0.1.0, written by an AI agent (Claude) on 2026-11-08, mirroring magid-client-rct at that date. Known problems
are in [`OPEN-ISSUES.md`](OPEN-ISSUES.md).

## License

[Apache-2.0](LICENSE)
