# ldraw — logic circuit schematic drawing

## Purpose

ldraw is a GUI-based interactive schematic diagram drawing tool for creating,
modifying, and displaying logic circuits.

There is a library of parts that can be placed on a canvas and interconnected.
The drawing can be saved in a `.ldraw` file that fully defines everything about
the drawing so that it can be read in the future and the drawing edited.

The visual diagram can also be written in `.svg` form for printing purposes,
but this will not retain full knowledge of the circuit itself.

The logic circuit can also be saved in a special `.lsim` format that can be
read by a hardware simulator I wrote called "lsim". This format will be
fully described in a separate document.

Note that both lsim and ldraw are hobby projects, not intended for public
use (although both will be on public GitHubs).
Thus, neither the drawings nor the hardware simulation are intended to
compete with state of the art tools.
In particular, only the limited device types recognized by lsim are supported in ldraw.

## Background

I wrote a digital logic hardware simulator. As part of that, I have a simple circuit
definition language that defines devices and the connections between
them. A circuit is defined with this language in a text file with
the suffix ".lsim".

To date, creation of the `.lsim` file has been fully manual by text editor.
The ldraw program replaces that with a graphical circuit design tool.
Rather than hand-editing `.lsim`, the user draws the circuit interactively
and can export an `.lsim` file at any time. The drawing is saved in
a `.ldraw` file that serves as the master representation of the circuit.

The ldraw program will:
* Initially have an empty canvas.
* Optionally read a `.ldraw` file that defines devices, wires, etc for a previously created circuit.
* Provide a drawing canvas that renders the circuit.
* Add and edit devices and wires to complete the circuit.
* At any time, the user can request an `.svg` file, which will match the drawing on the canvas.
* The tool can also save its internal representation of the drawing to a `.ldraw` file.
  Thus, at startup, you can read a `.ldraw` file.
  You will see the drawing as it previously existed and can modify it and re-save it.
* The tool can also save a `.lsim` file that represents the circuit for the lsim hardware simulator.

---

## Development Status

ldraw is built in phases. **Phase 1 is complete.**

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Static canvas, device placement, load/save `.ldraw` | **Complete** |
| 2 | Device interactions: move, delete, undo, right-click context menu | Planned |
| 3 | Basic wires: create, extend, connect, floating-end indicator | Planned |
| 4 | Wire topology: turns, branch points, tap, delete segment | Planned |
| 5 | Named nets: cascade rename, orphan detection | Planned |
| 6 | Export: `.lsim` generation, `.svg` export | Planned |

---

## Definitions

These terms will be used carefully and unambiguously in this document
to mean only what is defined here.

* **Device** — a circuit component, like a NAND gate, an LED, or a register.
  These correspond to devices created by a `d` command in a `.lsim` file.
* **Named Net** — a special type of pseudo device. See [Named Net](#named-net).
* **Wire** — a line graph on the drawing connecting a device output to one or
  more device inputs. *(Phase 3+)*
* **Segment** — one connected piece of a wire. *(Phase 3+)*
* **Branch point** — a T-junction where one wire segment fans out to two.
  *(Phase 4+)*
* **Upstream** — the end of a segment that is graphically closer to the
  driving device's output.
* **Downstream** — the end of a segment that is graphically closer to the
  consuming device's inputs.
* **Fine grid** (`PIN_SPACE = 10`) — the snap granularity; all device
  positions, waypoints, and branch points snap to this pitch. Canvas
  coordinates map 1:1 to CSS pixels at the default transform.
* **Pin pitch** (`PIN_PITCH = 20`) — the minimum spacing between any two
  pins on a device (2 fine-grid steps). Wire routing runs occupy the
  half-pitch lanes between adjacent pins.
* **Interfere** — when placing or extending an object, interference occurs
  when any part of the object being placed overlaps with an existing object
  in a disallowed way. Objects that merely *touch* (share a boundary) are
  also considered to interfere. The complete set of interference rules:
  - A device cannot overlap or touch another device (including pin buffer zones).
  - A device cannot overlap a wire segment, waypoint, or branch point.
    *(Wire rules apply Phase 3+)*
  - Two wire segments cannot share any portion of a collinear run.
  - A wire segment cannot overlap a device (including pin buffer zones).
  - A waypoint or branch point cannot occupy the same coordinates as another
    waypoint, branch point, or device pin.
  - Wire segments *are* allowed to cross other wire segments at a point
    (a "+" junction), provided the crossing point is not at a waypoint or
    branch point of either segment.

---

## Implementation Environment

A single self-contained `.html` file, opened directly in Chrome from the
local file system. No server, no build step, no installed dependencies.
External JS libraries may be loaded from CDNs.

All rendering, interaction, and application logic is in HTML, CSS, and
JavaScript within this single file.

### File I/O

Uses the browser's **File System Access API** (Chrome):

* **Read**: user selects a file via picker or drags and drops onto the canvas.
* **Write**: user selects destination via picker on first save; subsequent
  saves to the same file reuse the writable handle obtained from the save
  picker directly (read-only handles obtained from the open picker are not
  reused for writing, as the `file://` security origin does not permit it).

The tool remembers the most recently used filename and directory. When the
save picker opens, it is pre-populated with the last-used filename and
navigated to the last-used directory.

### Constraints

* Chrome is the target browser.
* No persistent storage between sessions; all state lives in memory.
* Error, warning, and status messages appear in a scrollable log panel
  fixed at the bottom of the window. Debug messages may also appear in
  the browser console (`console.log`).

---

## `.ldraw` File Format

The `.ldraw` file is the master drawing representation. It is
pretty-printed JSON for human readability and diff-friendliness.

### Phase 1 schema (devices only)

```json
{
  "version": 1,
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
  "wires": []
}
```

`x` and `y` are the `(ox, oy)` origin passed to the device's geometry
function. They are multiples of `PIN_SPACE` (10). `wires` is present but
empty in Phase 1; it will be populated in Phase 3.

On load, auto-name counters are reconstructed by counting how many devices
of each type exist, so that newly placed devices receive non-conflicting
names regardless of what the loaded devices are named.

---

## Lsim Output File Format

*(Phase 6 — not yet implemented)*

See `circuit-language-docs.md` for the full `.lsim` format. The drawing
tool will generate only structural commands:

* `d` — Define device (creates a device with typed pins)
* `c` — Connect (single wire between one output pin and one input pin)

---

## Pin naming convention

Pin IDs are a letter followed by a number (e.g. `i0`, `q0`, `R0`).
**Upper-case letter = active-low (inverted) signal.**
Any pin whose ID starts with an upper-case letter automatically gets an
inversion bubble in the rendered symbol. This is the only mechanism that
produces bubbles — there is no per-device bubble specification.

---

## Data Model

### Devices

Each device object in application state contains:

* `type` — device type string (e.g. `nand`, `dflipflop`, `reg`, `netsource`, `netsink`).
* `name` — unique instance name. Duplicate names are not allowed.
* `params` — type-specific parameters (e.g. `numInputs`, `numBits`, `numAddr`, `numData`).
* `position` — `{x, y}` canvas coordinates (multiples of `PIN_SPACE`).
* `orientation` — `'right'|'left'|'up'|'down'` (default `'right'`).
* `geo` — cached geometry object, recomputed when position changes.

See the lsim language document for full details of params per device type.

### Wires *(Phase 3+)*

A "wire" is a line graph on the drawing that connects a device output to one or
more device inputs. A wire can be a single segment or a set of
segments joined by branch points, forming a binary tree of segments.
When an output must be connected to more than one input, the path must be
broken into multiple segments connected at "branch points", represented
visually as filled dots.

Each branch point has one upstream segment and two downstream segments.
The root of the tree is the output of a device and the leaves are
the inputs that it connects to.

A wire is internally represented as:
* A reference to a device output (root of the tree)
* A binary tree of segments, each node referencing a branch point

Segments are allowed to cross without connection (a "+" junction visually),
but cannot overlap a device or overlap another segment collinearly.

### Named Net *(Phase 5)*

A "named net" is a special kind of pseudo device. There are two distinct
device types: `netsource` and `netsink`. Each has a single parameter: the
net name.

A `netsource` is drawn as a `-->` arrow (shaft ending in an open chevron);
a `netsink` is drawn as an open chevron pointing at the connection point.
Both device types are placeable in Phase 1. The special naming logic
(cascade rename, orphan detection, red rendering) is deferred to Phase 5.

For most purposes, named nets are treated as any other device:
they can be created, oriented, and placed. A `netsource` has a single
input pin; a `netsink` has a single output pin.

When generating a `.lsim` output file *(Phase 6)*, named net devices are
not treated as devices but rather like wires: a group of like-named
`netsource`/`netsink` devices are considered directly wired together,
generating `c` commands rather than `d` commands.

---

## Symbol Library

### Architecture: geometry/render separation

Each device type has three functions:

* `xxxGeometry(ox, oy, name, ...params)` — computes all shape coordinates,
  label positions, and pin endpoints in canvas space. Returns a plain data
  structure. Pure function, no side effects.
* `renderXxxCanvas(ctx, geo, fg, mid, bg)` — consumes geometry, issues
  canvas 2D draw calls.
* `renderXxxSVG(geo, fg, mid, bg)` — consumes the same geometry, returns
  SVG element strings. Identical visual output to canvas version.

Geometry is computed once and reused for both interactive canvas rendering
and SVG export.

### Dispatch tables

`SYMBOL_FACTORIES`, `CANVAS_RENDERERS`, and `SVG_RENDERERS` are
dictionaries keyed by device type string. Adding a new device type
requires entries in all three; no other code changes are needed.

### Shared helpers

* `_renderShapesCanvas(ctx, shapes, fg, bg)` — renders rect/circle/line/polygon/clockTriangle
* `_renderShapesSVG(shapes, fg, bg)` — same for SVG
* `_renderLabelsCanvas(ctx, labels, fg, mid)` — renders name and pin labels
* `_renderLabelsSVG(labels, fg, mid)` — same for SVG
* `_l2c(pivotX, pivotY, totalW, totalH, cos, sin, lx, ly)` — transforms
  local symbol coordinates to canvas space with rotation
* `_mirrorBoxGeo(geo, axisX)` — flips a geometry object horizontally
  around `axisX`; used by all box devices to implement `'left'` orientation

### Style globals

`SYM_FG`, `SYM_MID`, `SYM_BG` — set via `symSetColors(fg, mid, bg)`.
Used by both canvas and SVG renderers.

### Coordinate constants

```
PIN_SPACE   = 10   Fine grid pitch (snap unit, CSS pixels)
PIN_PITCH   = 20   Device pin-to-pin spacing (2 fine-grid steps)
STUB        = 20   Regular pin stub length (= PIN_PITCH)
BUBBLE      = 5    Active-low inversion bubble radius
BUBBLE_STUB = 10   Line segment preceding the bubble (= STUB - 2*BUBBLE)
```

**Pin-to-grid guarantee:** With `ox`/`oy` snapped to `PIN_SPACE` multiples,
every pin tip also lands on a `PIN_SPACE` multiple. This is achieved by
expressing all device dimensions as multiples of `PIN_PITCH`, using
`PIN_PITCH` for pin spacings, and `PIN_SPACE` for the NAND `pinStart` offset.

**Equal-reach guarantee:** Regular pins and active-low pins extend exactly
the same distance (`STUB = 20px`) from the device body edge, so `q` and `Q`
outputs align at the same x-coordinate regardless of which carries a bubble.
Reach: plain = `STUB`; active-low = `BUBBLE_STUB + 2*BUBBLE = 10 + 10 = 20`.

### Supported device types

| Type | Label | Orientations | Singleton | Size params |
|------|-------|-------------|-----------|-------------|
| `nand` | NAND | right/left/up/down | — | `numInputs` (1–16) |
| `led` | LED | right/left/up/down | — | — |
| `swtch` | Switch | right/left/up/down | — | — |
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

**Singleton devices** (`gnd`, `vcc`, `clk`) may only appear once on the
canvas. They are greyed out in the selection view once one exists.

**`gnd` and `vcc`** do not display their instance name (the symbol is
self-identifying). All other devices display their name.

**1-input NAND** is rendered the same size as a 2-input NAND (floor at 2
rows), with the single input pin colinear with the output — it looks like
a rounded inverter.

**NAND input alignment:** With `PITCH = PIN_PITCH`, inputs are placed at
`PIN_PITCH/2` from the top, so even counts straddle the output centre and
odd counts have their middle input exactly colinear with the output.

The `probe` device type defined in the lsim language is deliberately
excluded from ldraw. It is a simulator-only diagnostic tool, not a circuit
component.

Per-device pin assignments, visual details, and geometry notes are
documented in block comments above each geometry function in `ldraw.html`.

---

## User Interface

### Application Launch

Single self-contained HTML file opened in Chrome. URL parameters provide
hints for which files to load:

    ldraw.html?ldraw=seq1.ldraw

A hint is displayed in the log panel but cannot auto-open files (browser
security). The user confirms each file load via the picker dialog.

### Canvas

The canvas occupies the full browser window except for the log panel
at the bottom. A fine dot grid (10px pitch) and major grid lines
(100px pitch) are rendered as a visual reference. The canvas
coordinate origin (0, 0) is marked with a small crosshair.

There is no zoom. Pan by left-click dragging on empty canvas.

### Log panel

A two-line dark terminal strip is fixed at the bottom of the window.
It displays placement confirmations, interference warnings, file
operation results, and any other messages. It scrolls and retains
up to 50 lines.

### Canvas context menu

Right-clicking on the idle canvas opens a context menu with:

* **Add device…** — enters the device selection view.
* **Pan to x, y…** — prompts for canvas coordinates and scrolls the
  view so that point is centered on screen.
* **Load…** — opens a file picker to load a `.ldraw` file.
* **Save…** — saves the current drawing. If a writable file handle
  already exists from a previous save, it is reused silently. Otherwise
  a save picker opens, pre-populated with the last-used filename and
  directory.
* **Redraw** — repaints the canvas from internal state (diagnostic).

Pressing **Escape** dismisses the context menu.

### Device selection view

Right-click → **Add device…** (or pressing Escape while in selection view
returns to the normal canvas).

The selection view shows all 15 device types in a dynamic grid,
scrollable with the mouse wheel. A pinned header reads
*"Select device — Left-click: grab   Right-click: configure"*.
Singleton devices (`gnd`, `vcc`, `clk`) are greyed out when one already
exists on the canvas.

**Right-click** a device tile opens the parameter editor popup for that type.
The popup always includes:
* **Name** — the instance name that will be used when the device is placed.
  Pre-filled with the next auto-generated name (e.g. `nand3`). May be
  edited freely; a duplicate name is rejected at placement time.
* **Orientation** — for devices that support more than one orientation.
  The tile re-renders at the selected orientation immediately.
* **Size parameters** — number of inputs for `nand`; bit widths for
  `reg`, `panel`, `addword`; address and data widths for `mem`.
  The tile re-renders at the new size immediately.

`gnd` and `vcc` have no orientation or size parameters but still show the
name field in the popup (right-click to rename before placing).

The selection view remembers the most recently configured parameters for
each device type for the duration of the session.

**Left-click** a device tile grabs it:
* The canvas returns to normal view immediately.
* The device appears as a 50%-opacity ghost attached to the cursor.
* Moving the mouse snaps the ghost to the nearest `PIN_SPACE` grid point.
* Releasing places the device. If placement interferes with an existing
  device, the placement is rejected and a message is logged.
* **Escape** during drag cancels placement.

### Auto-naming

When a device is placed without a custom name, it is assigned a name of
the form `type` + `N`, where `N` is one more than the count of existing
devices of that type on the canvas (e.g. `nand1`, `nand2`, `nand3`).
This counter is recalculated from the actual device list on load, so it
advances correctly regardless of what loaded devices are named.

### Interference detection

Devices may not overlap or touch. Each device has a **pin buffer zone**
extending `PIN_SPACE` (10px, one fine-grid step) outward from any edge
that has pins. This buffer is invisible but participates in interference
checks, guaranteeing that there is always room for a wire segment to
depart from any pin without immediately colliding with a neighbour.

### Device context menu *(Phase 2)*

Right-clicking a placed device will open a context menu allowing name
editing, deletion, and wire creation. This is not yet implemented.
Orientation and size parameters are not editable after placement.

### Device movement *(Phase 2)*

Placed devices can be moved by left-click drag. Not yet implemented.

### Undo *(Phase 2)*

Single-level undo (Ctrl-Z). Not yet implemented.

### Wire creation and editing *(Phases 3–4)*

Not yet implemented. See the phase plan for the intended interaction model.

---

## Design Decisions

### Wire-to-pin attachment *(Phase 3+)*

Each pin's geometry includes a connection point (the tip of its stub line,
stored in `pins[id] = {x, y}`). Wires attach at this point. The first
run of a wire leaving an output pin must travel in the direction the stub
points. The same constraint applies to the last run arriving at an input pin.

A segment's floating downstream end can only connect to a device **input** pin
(including the input pin of a `netsource` device). Dropping onto a device
**output** pin is an error.

### Grid and snapping

All device positions, waypoints, and branch points snap to `PIN_SPACE`
(10px). The pin-to-grid guarantee (see Symbol Library) means that once a
device origin is on-grid, every one of its pin tips is also on-grid and
wire endpoints will meet pins exactly.

### Z-order / draw order

Wires drawn first, devices on top. Wire crossings shown as a plain cross
(no gaps, no "hop" arcs).

### SVG export scope *(Phase 6)*

Export all placed devices and their attached wires (complete or incomplete).
The SVG viewBox is bounded by the outermost device and wire bounding boxes
plus a 2-unit margin. Disconnected segments and orphaned named nets are
included — the SVG reflects the canvas exactly.

---

## File Operations

### Load `.ldraw`

Opens a file picker. After a successful load:
* The canvas is cleared and repopulated from the file.
* The read-only file handle is remembered for directory navigation on
  the next open/save picker, and the filename is remembered as the
  suggested name for the next save.
* The writable save handle is cleared (the loaded handle is read-only
  in `file://` origins).

Drag-and-drop of a `.ldraw` file onto the canvas is also supported.

### Save `.ldraw`

* If a writable handle exists from a previous save-picker operation,
  the file is overwritten silently.
* Otherwise the save picker opens, pre-populated with the last-used
  filename and directory.
* The resulting writable handle is stored for future saves.

### Export `.svg` *(Phase 6)*

Not yet implemented.

### Export `.lsim` *(Phase 6)*

Not yet implemented.

### Typical workflow

1. Launch tool, optionally load `.ldraw` via right-click → Load…
   (or drag-and-drop).
2. Place devices via right-click → Add device…
3. Save via right-click → Save…
4. Continue editing; Save… again (overwrites silently).
5. *(Future)* Route wires, export `.svg` and `.lsim`.

---

## Extensibility

New composite device types (box-style) need only:
1. A geometry function following the existing conventions.
2. Entries in `SYMBOL_FACTORIES`, `CANVAS_RENDERERS`, and `SVG_RENDERERS`.
3. An entry in `DEVICE_DEFS` (label, defaultParams, orientations, paramSpecs).

No other code changes are required.
