# Open issues

Problems found by AI agents while working in this repo, left **unfixed on purpose** for the owner to resolve.
Agents add new findings here instead of fixing code they weren't asked to touch (see `CLAUDE.md`).
Issues in the client core belong in its own repo's `OPEN-ISSUES.md`. Delete an entry once it's resolved.
Each entry: what's wrong, where, why it matters, and a suggested fix.

## Rendering

### R1. An async text input loses focus when it sends `update-symbol` (2026-11-08)
- `render/detached.ts` sends `update-symbol` 500 ms after the value rests; the response replaces the elements, and the
  core clears them while the request runs, so `ui/app.ts` rebuilds the screen and the field being typed into is gone.
  magid-client-rct behaves the same (MagidRoot unmounts while `elements` is empty); the JFX client has it as R2.
- Fix idea: remember the focused input's `input-name` and caret when the story screen is torn down, and restore them in
  the next screen; or (core) keep the previous elements during an `update-symbol` request.

## Build / tooling

### B1. Fresh installs with npm 10.8.1 crash on vitest's peer dependencies (2026-11-08)
- `npm install vitest` (also in an empty folder) fails with "Cannot read properties of null (reading 'edgesOut')" in
  arborist's `#loadPeerSet`. npm 11 resolves it; with the resulting lockfile npm 10 installs fine.
- Fix idea: update npm (`npm install -g npm@11`), or keep using `npx -y npm@11 install …` when devDependencies change.
