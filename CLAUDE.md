# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ldraw is a browser-based (Chrome only) logic circuit schematic editor, the graphical front-end for the `lsim` simulator. Drawings are saved as `.ldraw` (JSON, master format) and can be exported to `.lsim`. No server, no dependencies, no package manager, no automated test runner.

This project is maintained by Claude Code going forward (it was originally written in the claude.ai web interface, with files shuttled by hand).

The user is the only user of this repo, so changes need not be backward compatible (file formats, UI, scripts). You have full permission to commit and push to this repo at your own judgment.

The companion `lsim` simulator is at https://github.com/fordsfords/lsim; a local checkout is at `../lsim` (sibling directory). `.lsim` export output must stay compatible with it.

## Documentation convention

- `README.md` — for **humans using** the tool: features, usage, file formats from the user's view, log message meanings. No implementation or maintenance detail. Update it when user-visible behavior changes.
- `CLAUDE.md` (this file) — for **Claude maintaining** the tool: build, workflow, conventions, pointers. Keep it short; don't duplicate `internals.md`.
- `internals.md` — detailed maintainer reference (data model, `.ldraw`/`.lsim` formats, design decisions, known quirks, future phases). Read it before non-trivial changes and keep it current. Don't put maintainer content in `README.md`.

## Build

Source is split; the deliverable is a single generated file:

- `ldraw-app.html` — all UI, canvas, data model, and interaction logic. **Edit this.**
- `symbols.js` — device symbol geometry/pins/labels. **Edit this.**
- `ldraw.html` — **generated**; do not hand-edit.

Run `./bld.sh` to regenerate `ldraw.html` (it `sed`-inlines `symbols.js` at the `/* @INCLUDE symbols.js */` marker in `ldraw-app.html`). It also refreshes the `<!-- mdtoc -->` tables of contents in `*.md` if `mdtoc.pl` is available (otherwise just prints an FYI). Commit both the sources and the regenerated `ldraw.html`.

To run: open `ldraw.html` directly in Chrome from the filesystem (File System Access API; `file://` handles from the open picker are read-only, so Save reuses the handle from the last save picker).

## Testing

There is no automated test suite. `TESTS.md` is a manual randomized checklist (pick a few from each section per session). `regression_test.txt` is a list of code-review prompts meant to be run against the code as a pseudo-regression suite.

## Conventions (from internals.md)

- Simplicity over efficiency; fatal asserts over graceful error handling; write two loops rather than one clever one.
- No backward compatibility: when the data model changes, bump the `.ldraw` version number; no migration.
- All user-visible messages go through `logMsg(level, msg)` with the `LogLevel` enum (`INFO` "Yep.", `ALERT` "Yo!" + beep, `ERROR` "Oops!" + beep, `WARN` "Um." silent). Use `WARN` for batches followed by one `ALERT` summary. Debug output goes to `console.log`.
- Parameter-editor popups use explicit OK/Cancel; clicking outside doesn't dismiss; Escape = Cancel.
- State-changing operations must call `pushUndo()` before mutating `state.devices`. Anything that replaces `state.devices` (e.g. `popUndo`, `deserializeState`) must reset dependent UI/selection/mode state.
- A dirty flag drives the `*` in the tab title and leave-page prompt.
- When updating `internals.md` after finishing a phase, do not remove or compress detail for future phases.
- Wire→device lookups: `downstream.dev` is disambiguated by checking the pin exists in `device.geo.pins`; `srcDev` lookups for same-type devices (e.g. two netsinks) also need `wireSrcMatchesDev` position matching. See "Wire Reference Disambiguation" in `internals.md`.

## Architecture notes

- Geometry/render separation: symbols in `symbols.js` are driven by dispatch tables; each device gets a computed `geo` (pins etc.) that is immutable after creation and recomputed on undo (so `pushUndo` shares `geo` by reference).
- Wires are binary trees of axis-locked segments joined by waypoints (turn) and branch points (fan-out), starting at a device output pin.
- `netsource`/`netsink` are pseudo-devices implementing named nets (invisible wires); they do not exist in `lsim`.
- Singleton devices (`gnd`, `vcc`, `clk`) may appear once per drawing.

## Legacy workflow files

`get.sh`, `x.put.sh` and `roll.sh.x` were for moving the repo to/from claude.ai web sessions as base64 tarballs (`get.sh` fetched changes into a `claude-main` branch). They are obsolete now that Claude Code edits the repo directly. Gitignored scratch: `x`, `x.*`, `*.x`, `prev/`.
