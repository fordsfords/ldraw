# ldraw Internals

Maintainer reference for the ldraw logic circuit schematic drawing tool.
For end-user documentation, see [README.md](README.md).

This document should only contain information that would be of genuine
use to a future maintainer, be they human or AI.

<!-- mdtoc-start -->
&bull; [ldraw Internals](#ldraw-internals)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Purpose and Background](#purpose-and-background)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Definitions](#definitions)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Implementation Environment](#implementation-environment)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Source Files and Build](#source-files-and-build)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [File I/O](#file-io)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Constraints](#constraints)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Log Message Prefixes](#log-message-prefixes)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [`.ldraw` File Format](#ldraw-file-format)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [`.lsim` Output Format](#lsim-output-format)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Device commands](#device-commands)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Connect commands](#connect-commands)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Validity warnings](#validity-warnings)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Pin Naming Convention](#pin-naming-convention)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Data Model](#data-model)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Devices](#devices)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Wires](#wires)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Named Net](#named-net)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Symbol Library](#symbol-library)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Architecture: geometry/render separation](#architecture-geometryrender-separation)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Dispatch tables](#dispatch-tables)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Shared helpers](#shared-helpers)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Coordinate constants](#coordinate-constants)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Supported device types](#supported-device-types)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Extensibility](#extensibility)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Design Decisions](#design-decisions)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Coding Guidelines](#coding-guidelines)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Known Quirks](#known-quirks)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Known Inefficiencies](#known-inefficiencies)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Future Work](#future-work)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Phase 6 — Export](#phase-6--export)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Phase 7 — Incremental wire re-routing (related, also deferred)](#phase-7--incremental-wire-re-routing-related-also-deferred)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Phase Infinity — Lasso select and group move](#phase-infinity--lasso-select-and-group-move)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Concept](#concept)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Open design questions (unresolved)](#open-design-questions-unresolved)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Why deferred](#why-deferred)  
<!-- TOC created by '../mdtoc/mdtoc.pl internals.md' (see https://github.com/fordsfords/mdtoc) -->
<!-- mdtoc-end -->

## Purpose and Background

ldraw is a GUI-based interactive schematic diagram drawing tool for
creating, modifying, and displaying logic circuits. It is the graphical
front-end for `lsim`, a digital logic hardware simulator. Rather than
hand-editing `.lsim` text files, the user draws the circuit interactively
and can export an `.lsim` file at any time. The drawing is saved in a
`.ldraw` file that serves as the master representation.

Both lsim and ldraw are hobby projects. Only device types recognized by
lsim are supported.

---

## Definitions

These terms are used precisely throughout this document and in code comments.

* **Device** — a circuit component (NAND gate, LED, register, etc.).
  Corresponds to a `d` command in `.lsim`.
* **Named Net** — a pseudo device (`netsource` / `netsink`). See the
  Named Net section under Data Model.
* **Wire** — a line graph connecting a device output to one or more
  device inputs.
* **Segment** — one straight piece of a wire. Axis-locked (horizontal or
  vertical only).
* **Waypoint** — a point where one segment ends and another begins,
  forming a turn. One upstream segment, one downstream segment.
* **Branch point** — a T-junction where one segment fans out to two.
  One upstream segment, two downstream segments.
* **Upstream** — the direction toward the driving device's output pin.
* **Downstream** — the direction toward the consuming device's input pins.
* **Fine grid** (`PIN_SPACE = 10`) — the snap granularity. All positions
  snap to this pitch. Canvas coordinates map 1:1 to CSS pixels at the
  default transform.
* **Pin pitch** (`PIN_PITCH = 20`) — minimum spacing between pins on a
  device (2 fine-grid steps).
* **Interfere** — overlap or touch between objects in a disallowed way.
  Current interference rules:
  - Two wire segments from different wires cannot share any portion of a
    collinear run.
  - All other overlap (device-device, device-wire, etc.) is the user's
    responsibility.
* **Oops** — an error log message (level `ERROR`). Accompanied by an
  audible beep. See Log Message Prefixes below.

---

## Implementation Environment

The deliverable is a single self-contained `ldraw.html` file, opened
directly in Chrome from the local file system. No server, no installed
dependencies. External JS libraries may be loaded from CDNs.

### Source Files and Build

The source is split across two files for maintainability:

* **`symbols.js`** — device symbol definitions (drawing geometry, pin
  lists, label positions).
* **`ldraw-app.html`** — everything else (canvas, UI, data model, all
  interactive logic). Contains an `// @INCLUDE symbols.js` marker where
  the symbol definitions are injected.

Running **`bld.sh`** uses `sed` to inline `symbols.js` at the marker,
producing the single-file `ldraw.html` that the browser opens.

### File I/O

Uses the browser's File System Access API (Chrome):

* **Read**: user selects a file via picker or drags and drops onto canvas.
* **Write**: "Save" reuses the writable handle from the last save picker;
  "Save as…" always opens a new save picker. Read-only handles from the
  open picker are not reused for writing, as `file://` does not permit it.

The tool remembers the most recently used filename and directory.

### Constraints

* Chrome only.
* No persistent storage; all state lives in memory. `localStorage` is
  used only for hints (e.g. last saved filename) that improve UX but
  are not essential.
* A **dirty flag** tracks unsaved changes (asterisk in tab title, leave-page
  dialog).
* **No backward compatibility.** When the data model changes, the `.ldraw`
  version number is incremented. No migration from older versions.
* All log messages are written via `logMsg(level, msg)` using a `LogLevel`
  enum. See Log Message Prefixes below.
* Debug output goes to `console.log`.

### Log Message Prefixes

All log output goes through `logMsg(level, msg)`. The `level` parameter
is one of four values from the `LogLevel` enum, which controls the
prefix prepended to `msg` and whether a beep is emitted:

| `LogLevel` | Prefix | Meaning | Beep |
|------------|--------|---------|------|
| `INFO`  | `Yep. ` | Informational — operation succeeded | no |
| `ERROR` | `Oops! ` | Error — operation failed, not performed | yes |
| `WARN`  | `Um. ` | Warning detail — something to review | no |
| `ALERT` | `Yo! ` | Attention summary — aggregates warnings | yes |

`WARN` messages may appear in batches (e.g. during export). The `ALERT`
summary at the end provides a single beep so the user knows to check
the log. If there are no warnings, `INFO` is used instead.

---

## `.ldraw` File Format

Pretty-printed JSON. Current version: **4**.

```json
{
  "version": 4,
  "drawingName": "my-circuit",
  "devices": [
    {
      "type": "nand",
      "name": "nand1",
      "params": { "numInputs": 2 },
      "x": 100,
      "y": 200,
      "orientation": "right"
    }
  ],
  "wires": [
    {
      "id": "w1",
      "srcDev": "nand1",
      "srcPin": "o0",
      "segments": [
        {
          "id": "s1",
          "orientation": "right",
          "upstream": { "type": "pin" },
          "downstream": { "type": "pin", "dev": "nand2", "pin": "i0" },
          "endX": 200,
          "endY": 200
        }
      ],
      "waypoints": [
        { "id": "wp1", "x": 150, "y": 200 }
      ],
      "branchPoints": []
    }
  ]
}
```

`x` and `y` are the `(ox, oy)` origin passed to the device's geometry
function, in multiples of `PIN_SPACE`.

The upstream end position of a segment is derived at load time from the
source pin's geometry (for the root segment) or from the waypoint/branch
point position.

`endX`/`endY` store the downstream endpoint. Wire-level `waypoints` and
`branchPoints` arrays hold the actual waypoint and branch point objects.
(Older files may contain a per-segment `waypoints` field; it is ignored
on load.)

On load, auto-name counters are reconstructed by scanning all device names
for the highest numeric suffix of each type.

---

## `.lsim` Output Format

Exported via "Export .lsim…" in the canvas context menu. The output
contains only `d` (define device) and `c` (connect) commands.

### Device commands

One `d` command per non-net device. Format varies by type:

* No-param types (`gnd`, `vcc`, `led`, `clk`, `srlatch`, `dflipflop`,
  `addbit`): `d;type;name;`
* `swtch`: `d;swtch;name;initialState;` (0 or 1)
* `nand`: `d;nand;name;numInputs;`
* `mem`: `d;mem;name;numAddr;numData;`
* `reg`, `panel`, `addword`: `d;type;name;numBits;`

Net devices (`netsource`, `netsink`) are omitted — they are resolved
into `c` commands.

### Connect commands

Each wire tree is flattened into hub-and-spokes `c` commands:
`c;srcDev;srcPin;dstDev;dstPin;` — one per connected input pin.

For named nets, `resolveNetSource(wire)` follows the chain: if a wire's
source device is a netsink, it finds the matching netsource, then the
wire driving that netsource's `i0`, and returns the real (non-net)
driver. This recurses to handle chained nets, with a visited-set guard
against circular references.

### Validity warnings

The export checks for three categories of problems, each reported as a `WARN`-level log message:

* **Floating wire ends** — segments with `downstream.type === 'floating'`.
* **Unconnected device input pins** — input pins with no wire attached
  (checked via `findWireAtInput` for each non-output pin of each
  non-net device).
* **Orphaned nets** — netsinks with no matching netsource, or
  netsources with nothing connected to their `i0`.

Warnings do not block the export. The file is written with as much
content as can be generated. If any warnings were produced, the summary
uses `ALERT` (with beep); otherwise `INFO`.

---

## Pin Naming Convention

Pin IDs are a letter followed by a number (e.g. `i0`, `q0`, `R0`).
**Upper-case letter = active-low (inverted) signal.** Any pin whose ID
starts with an upper-case letter automatically gets an inversion bubble.
This is the only bubble mechanism.

---

## Data Model

### Devices

Each device object in application state:

* `type` — device type string (key into `DEVICE_DEFS`).
* `name` — unique instance name.
* `params` — type-specific parameters (e.g. `numInputs`, `numBits`).
* `position` — `{x, y}` canvas coordinates (multiples of `PIN_SPACE`).
* `orientation` — `'right'|'left'|'up'|'down'`.
* `geo` — cached geometry object. Immutable after creation; safe to share
  in undo snapshots. Recomputed whenever position, name, or params change.
  The `geo.pins` dictionary maps pin ID to `{x, y, dir}`.

### Wires

A wire connects a device output pin to one or more device input pins.
It is internally a binary tree of segments: the root is the output pin,
leaves are floating ends or connected input pins, and interior nodes are
waypoints (one-to-one) or branch points (one-to-two).

Wire object structure:
* `id` — unique within session (for logging/debugging).
* `srcDev`, `srcPin` — the driving device output.
* `segments[]` — flat array of segment objects.
* `waypoints[]` — flat array of `{id, x, y}` objects.
* `branchPoints[]` — flat array of `{id, x, y}` objects.

Segment object structure:
* `id` — unique within session.
* `orientation` — `'right'|'left'|'up'|'down'`. Immutable after creation;
  constrains extend axis (horizontal segments lock Y, vertical lock X).
* `upstream` — `{type:'pin'}` | `{type:'waypoint', id}` | `{type:'branchpoint', id}`.
* `downstream` — `{type:'floating'}` | `{type:'pin', dev, pin}` |
  `{type:'waypoint', id}` | `{type:'branchpoint', id}`.
* `endX`, `endY` — downstream endpoint coordinates.

Segments and waypoints are cross-referenced by ID string. Key lookup
functions: `findSegByUpstreamWp`, `findSegByDownstreamWp`,
`findSegsByUpstreamBp`, `findSegByDownstreamBp`, `getSegStart`,
`getWireOrigin`.

### Named Net

`netsource` and `netsink` are pseudo devices with a single pin each.
Placeable as normal devices. When generating `.lsim` output,
like-named net pairs are treated as direct wire connections (`c` commands)
rather than devices. Net devices share names (enforced by
`isNameAvailable`). Cascade rename, orphan detection, and colour
rendering are implemented.

---

## Symbol Library

### Architecture: geometry/render separation

Each device type has three functions:

* `xxxGeometry(ox, oy, name, ...params)` — computes all shape coordinates,
  label positions, and pin endpoints. Pure function.
* `renderXxxCanvas(ctx, geo, fg, mid, bg)` — issues canvas 2D draw calls.
* `renderXxxSVG(geo, fg, mid, bg)` — returns SVG element strings.

Geometry is computed once and reused for both renderers.

### Dispatch tables

`SYMBOL_FACTORIES`, `CANVAS_RENDERERS`, and `SVG_RENDERERS` are
dictionaries keyed by device type string.

### Shared helpers

* `_renderShapesCanvas` / `_renderShapesSVG` — render rect/circle/line/polygon/clockTriangle.
* `_renderLabelsCanvas` / `_renderLabelsSVG` — render name and pin labels.
* `_l2c(pivotX, pivotY, totalW, totalH, cos, sin, lx, ly)` — local-to-canvas
  coordinate transform with rotation.
* `_mirrorBoxGeo(geo, axisX)` — horizontal flip for `'left'` orientation.

### Coordinate constants

```
PIN_SPACE   = 10   Fine grid pitch (snap unit, CSS pixels)
PIN_PITCH   = 20   Device pin-to-pin spacing (2 fine-grid steps)
STUB        = 20   Regular pin stub length (= PIN_PITCH)
BUBBLE      = 5    Active-low inversion bubble radius
BUBBLE_STUB = 10   Line segment preceding the bubble (= STUB - 2*BUBBLE)
```

**Pin-to-grid guarantee:** With `ox`/`oy` snapped to `PIN_SPACE` multiples,
every pin tip also lands on a `PIN_SPACE` multiple.

**Equal-reach guarantee:** Regular pins and active-low pins extend exactly
the same distance (`STUB = 20px`) from the device body edge.

### Supported device types

| Type | Label | Orientations | Singleton | Size params |
|------|-------|-------------|-----------|-------------|
| `nand` | NAND | right/left/up/down | — | `numInputs` (1–16) |
| `led` | LED | right/left/up/down | — | — |
| `swtch` | Switch | right/left/up/down | — | `initialState` (0–1) |
| `gnd` | GND | fixed (down) | yes | — |
| `vcc` | VCC | fixed (up) | yes | — |
| `clk` | Clock | right/left | yes | — |
| `mem` | Memory | right/left | — | `numAddr`, `numData` (1–16 each) |
| `srlatch` | SR Latch | right/left | — | — |
| `dflipflop` | D Flip-Flop | right/left | — | — |
| `reg` | Register | right/left | — | `numBits` (1–16) |
| `panel` | Panel | right/left | — | `numBits` (1–16) |
| `addbit` | 1-bit Adder | right/left | — | — |
| `addword` | N-bit Adder | right/left | — | `numBits` (1–16) |
| `netsource` | Net Source | right/left/up/down | — | — |
| `netsink` | Net Sink | right/left/up/down | — | — |

Singleton devices are greyed out in the selection view once one exists.

`gnd` and `vcc` use half-size triangles and display their instance name
(below the triangle for gnd, above for vcc).

`netsource` and `netsink` use half-size arrow/chevron symbols.

Switch displays `initialState` (0 or 1) inside the circle below the
device name. Configurable in the selection-view parameter editor and
togglable after placement via device context menu → "Toggle initial
state".

Per-device pin assignments and geometry notes are documented in block
comments above each geometry function in `symbols.js`.

### Extensibility

New box-style device types need only:
1. A geometry function following existing conventions.
2. Entries in `SYMBOL_FACTORIES`, `CANVAS_RENDERERS`, `SVG_RENDERERS`.
3. An entry in `DEVICE_DEFS` (label, defaultParams, orientations, paramSpecs).

No other code changes required.

---

## Design Decisions

**Interference checking.** Most interference
checks were removed. The only remaining check is collinear overlap between
segments of different wires. All other overlap is the user's responsibility.
This significantly simplified the code.

**Wire creation orientation choice.** When creating a new wire, a submenu
offers all four directions. The initial segment is not constrained to
match the pin stub direction.

**Cross-orientation connections.** A wire segment can connect to an input
pin from any direction. The endpoint just needs to coincide with the pin
tip position.

**Feedback connections.** A wire can route back to the same device's inputs.

**No wire dots.** Connection dots at pin junctions and waypoints were
removed. Wire rendering is lines and color only.

**Wire-to-pin attachment.** Each pin has a connection point at the stub
tip with a direction. A segment's floating end can only connect to an
input pin (including `netsource` input). Dropping onto an output pin is
an error.

**Z-order.** Wires drawn first, devices on top. Wire crossings rendered
as plain crosses (no hop arcs).

**Extending crosshair.** While dragging a segment's floating end, a faint
crosshair (full canvas width and height) is drawn through the endpoint
to aid visual alignment.

**Status bar.** A 20px opaque white bar at the top of the normal view,
drawn last (on top of drawing content). Left side shows drawing name,
dirty indicator, hash; right side shows pan coordinates.
Painted in screen space after resetting the canvas transform — no effect
on the drawing coordinate system or hit testing.

**Action-only context menus.** Context menus contain only action items
(no inline edit fields). Editing operations (rename, drawing name) open
separate durable modal dialogs with OK/Cancel. This avoids mixed-mode
problems (e.g. editing a name then clicking "delete" in the same menu).

**Device orientation change.** The device context menu includes an
"Orientation ▸" submenu for devices with multiple orientations.
Directions not supported by the device type are greyed out, as is the
current orientation. Same rules as move/delete: blocked if the device
has output wires; input wires are disconnected. Fixed-orientation
devices (`gnd`, `vcc`) have no submenu.

**Undo.** Deep-copy snapshots. Geo objects shared (not copied) because
they are immutable after creation and recomputed on restore. Unbounded
stack depth.

**No-op undo policy.** Null moves (device dropped at starting position)
are true no-ops: no undo slot, no dirty flag, no log message. Other
no-ops (e.g. disconnect and reconnect a segment at same point) still
consume an undo slot.

**Auto-naming.** Names are `type` + `N`. Counter is recalculated on load
and undo by scanning existing names for highest numeric suffix per type.

---

## Coding Guidelines

**Simplicity over efficiency.** Prefer obvious, maintainable code over
clever optimizations. Fatal asserts over graceful error handling.

**Match the mental model.** If the natural way to think about a problem
is "do this loop, then do that loop," write two loops, even if they
iterate the same list.

**Explicit commit model for popups.** All parameter editor popups should
have OK and Cancel buttons. Clicking outside does not dismiss. Escape =
Cancel. No auto-save-on-edit.

**Future-phase documentation.** When updating this document after
completing a phase, do NOT remove or compress detail from future phases.
Future-phase requirements should remain in full until that phase is
implemented. Losing future detail forces the user to dig through git history,
which defeats the purpose of having a living document.

---

## Known Quirks

Things that look odd but are intentional or harmless.

**`pushUndo` stores `geo` by reference.** Geo objects are immutable after
creation and `popUndo` recomputes them, so sharing is safe. The stale geo
sitting in old undo snapshots is never used — it's just dead weight that
avoids the cost of a deep copy for no benefit beyond correctness.

**`recalcNameCounters` ignores type prefix.** It extracts the trailing
integer from a device's *name*, keyed by the device's *type*. A nand
manually renamed to "led5" inflates `nameCounters['nand']` to 5. This
never causes name collisions (just skips a few numbers) and the
alternative — parsing and matching the prefix — adds complexity for zero
practical gain.

**`collectDownstream` is unbounded recursion.** A deeply nested wire tree
(many sequential waypoints / branch points) could overflow the call stack.
No realistic circuit approaches this limit.

**Wire lookups use pin + position checks for disambiguation.** Net
devices share names. For `downstream.dev` lookups, verifying
the pin exists in `device.geo.pins` suffices (cross-type disambiguation).
For `srcDev` lookups, same-type devices (e.g. two netsinks) also need
position matching via `wireSrcMatchesDev`. New code that resolves a
device from wire references must follow this pattern — see
"Wire Reference Disambiguation" section for details.

---

## Known Inefficiencies

Deliberate "simplicity over efficiency" choices. If performance degrades,
these are the places to look first.

**`netDeviceColor` scans devices and wires every frame.** For each
netsink, `netDeviceColor` calls `Array.some()` over all devices to find a
matching netsource. For each netsource, it calls `findWireAtInput` which
iterates all wires and segments. This runs on every `render()` call.
Optimization: cache a `netColor` property on each net device and update it
only on state changes (rename, delete, wire connect/disconnect).

**`isNameAvailable` iterates all devices.** Called during placement and
rename. Linear scan is fine for any realistic device count.

---

## Future Work

### Phase 6 — Export

`.lsim` generation and `.svg` export.

#### Phase 6a — Misc
**Complete.** Half-size gnd/vcc triangles with name
labels, half-size netsource/netsink arrows, "Save as…" menu item,
switch `initialState` parameter, device orientation change from context
menu, log message prefix system (LogLevel enum: INFO/ERROR/WARN/ALERT).

#### Phase 6b — .lsim export:
**Complete.** See `.lsim` Output Format above.

#### Phase 6c — .svg export
Not yet implemented. The SVG viewBox should
be bounded by the outermost device and wire bounding boxes plus a
2-unit margin. All colours should be reproduced (including net device
red/yellow and floating wire yellow). The existing `_renderShapesSVG`
and `_renderLabelsSVG` helpers can be reused. No validity checking
needed for SVG.

### Phase 7 - Misc

None of these are "must haves", including the bugs. Evaluate how much it
impacts maintainability (complexity).

1. BUG: Load drawing. Make minor modification. Save. Reload page. Load drawing.
   The starting path is not saved. Isn't localstorage supposed to save that?
2. BUG: Load drawing. Make minor modification. Save. It launches file picker.
   Can load prep to be able to save without picker? Maybe open for update
   so that it can write later on?
3. BUG: When right-click a device close to the bottom viewable edge,
   some of the menu is off-screen.
4. Enh: Maybe color floating device input stubs yellow?
5. Enh: Display device select canvas with next auto device name
   displayed as the name. Currently dispays the device type, which
   is already displayed at the bottom of the selector box.
6. Enh: Text boxes. Auto-size? Faint outline?
7. Chg: Log box at bottom: possible to put a frame around it?
   Twice the width of a wire segment, same color as canvas.
8. Question: should the file path name also to be displayed on the status line?
   Since it no longer has a strong tie to the drawing name, it might be good.
9. Enh: add the status line information to .lsim (as comment) and .svg
   (increase the height of the drawing to accommodate the status line).

### Phase 8 - Re-Size

1. Enh: Allow re-sizing of non-leaf wire segments.
   When left-click on a waypoint, you enter resize mode of
   the segment whose downstream end is attached to the waypoint.
   Note that this will disconnect everything downstream from
   device inputs.
   When resizing, ideally it would ghost the entire downstream wire tree,
   but it would be acceptable for the downstream to disappear during the
   resize and only reappear when the waypoint is released.

### Phase 9 - Self Test

Is it feasible to create a "white box" self test module?
I enision two soruce files, one called "self_test.js" and the other "no_test.js".
They both declare a funcion that returns whether or not the tests are included.
The main code would call that to determine if a "selfTest" menu item should be
included.

The build script would build two versions of the application: "ldraw.html" and "ldraw_test.html".
The sed-based include method would be used to build them.

Both files also contain a "beginTest" function.
In "no_test.js" it simply returns.
In "self_test.js" it initiates a unit test sequence.

The idea is that it would be hard-coded to call event handlers with
fake event data, and evaluate the contents of the internal state
data when the event is processed.

This would not do any visual testing of the GUI, only test that the
event handlers update the internal state correctly.
But this assumes the self test function has access to the internal state,
which might violate encapsulation and data hiding rules.

This approach needs discussion.

The approach to coding must also be carefully considere.
The instance of Claude writing the test code must not have access
to the application code.
Past experience has demonstrated that Claude simply writes tests to
verify that the code does what it is written to do.
This is fine if the code is "known good", but not good if the code
might have bugs.

Instead, a "clean room" approach must be taken where event handlers
are described according to their intentended function,
not their implementation.
This produces a detailed document,
which Claude then uses to design tests to verify intended function.

Note that whereas the actual js code does not need to be reviewed,
this detailed document should be reviewed to ensure that it
doesn't simply detail what the code does, as-written.

Also note that this could be a hell of a lot of work.
Would it be worth the effort?

Manual GUI testing should do a reasonable job.

### Phase 10 — Incremental wire re-routing

Goal is to allow small changes in device position without breaking
connections.

A lighter-weight variant of rubberband wires: Allow movement of a device. 
As before, it breaks input connections. Can those connections be "repaired"
by expanding or contracting existing line segments?
Maybe starting with leaf segments and working your way back?
Never contract a segment smaller than 1 unit, do not insert new
waypoints, do not change orientation of existing waypoints.
If the new device position is such that it would require "negative"
segment lengths, snap to the original position and print a "Yo. "
(It's not an error because the device was successfully moved,
but the wires could not be automatically re-routed).

Branch points are harder to include in this.
Perhaps consider them immovable.

- **Common case is tractable.** For a simple L-shaped or Z-shaped wire,
  only the segment(s) adjacent to the moved pin need to change length.
  The rest of the wire can stay put. A greedy local adjustment — absorb
  the delta into the segments nearest the moved device first — handles
  this correctly.
- **Degenerate cases require fallback.** If the adjustment would collapse
  a segment to zero or negative length (the device moved past a waypoint),
  the repair cannot succeed without deleting or relocating waypoints. The
  correct fallback is to break the connection and leave it floating, same
  as Phase 7 behaviour.
- **Branch points add complexity.** A wire tree can be partially repairable
  — some branches fit, others do not. Partial repair with selective
  breakage is significantly harder to specify and test than a clean
  break-everything approach.

### Phase Infinity — Lasso select and group move

**Status:** Considered and deferred indefinitely. Too large a lift for the
current scope of the tool.

#### Concept

Allow the user to draw a freehand selection boundary around a set of
devices and move them as a group, preserving internal wire connections
while breaking wires that cross the selection boundary.

#### Open design questions (unresolved)

- **Partial containment:** Whether a device whose bounding box is only
  partially inside the lasso boundary counts as selected. Recommended
  default: require full containment.
- **Unclosed lasso:** If the user releases the mouse without closing the
  polygon, close it with a straight line from end point to start point
  (standard convention).
- **Boundary-crossing wires:** A wire tree can be partially inside and
  partially outside. All segments whose downstream endpoint lands on an
  inside device move with the group; segments crossing the boundary are
  broken at the boundary end.
- **Selection state and undo:** Selection state should not be part of the
  undo stack. `pushUndo` must fire at drag-start, not at selection time.

#### Why deferred

The constraint logic for boundary-crossing wire trees is non-trivial.
Classifying every wire endpoint as inside or outside the selection polygon
requires per-device membership testing for both `srcDev` and all
`downstream.dev` references, with branch points complicating the tree walk.
This is a qualitatively larger feature than any phase implemented to date,
and the usability payoff does not justify the implementation cost at this
stage of the project.
