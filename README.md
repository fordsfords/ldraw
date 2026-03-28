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

ldraw is built in phases. **Phases 1 and 2 are complete.**

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Static canvas, device placement, load/save `.ldraw` | **Complete** |
| 2 | Device interactions: move, delete, undo, rename, dirty tracking | **Complete** |
| 3 | Basic wires: create, extend, connect, floating-end indicator | Planned |
| 4 | Wire topology: turns (way points), branch points, tap, delete segment | Planned |
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
* **Oops** - an "oops" is an error message printed to the text box at the
  bottom of the screen. It starts with "Oops!" followed by the text of the
  error message. When printed, an audble beep is generated.

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
* Error messages appear in the log panel prefixed with `"Oops! "` and are
  accompanied by a brief audible beep. Informational messages (placement
  confirmations, save/load results, undo) appear without a beep.
* Debug messages may also appear in the browser console (`console.log`).
* A **dirty flag** tracks whether the canvas has unsaved changes. When dirty,
  an asterisk appears in the browser tab title. Loading a file while dirty
  prompts for confirmation. Closing or navigating away while dirty triggers
  the browser's native "leave page?" dialog.

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

On load, auto-name counters are reconstructed by scanning all device names
for the highest numeric suffix of each type, so that newly placed devices
receive non-conflicting names regardless of how loaded devices were named.

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

Right-clicking on the idle canvas (not on a device) opens a context menu with:

* **Add device…** — enters the device selection view.
* **Pan to x, y…** — prompts for canvas coordinates and scrolls the
  view so that point is centered on screen.
* **Load…** — opens a file picker to load a `.ldraw` file. If there are
  unsaved changes, a confirmation dialog is shown first.
* **Save…** — saves the current drawing. If a writable file handle
  already exists from a previous save, it is reused silently. Otherwise
  a save picker opens, pre-populated with the last-used filename and
  directory.
* **Undo** — undoes the last state-changing operation (greyed out when
  nothing is available to undo).
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
the form `type` + `N`, where `N` is one more than the highest numeric suffix
currently in use among devices of that type (e.g. `nand1`, `nand2`, `nand3`).
This counter is recalculated on load by scanning the actual device names, so
it advances correctly past any manually assigned names. If a device is placed
with a custom name that has a higher numeric suffix than the counter, the
counter is immediately advanced past it so future auto-names do not collide.

### Interference detection

Devices may not overlap or touch. Each device has a **pin buffer zone**
extending `PIN_SPACE` (10px, one fine-grid step) outward from any edge
that has pins. This buffer is invisible but participates in interference
checks, guaranteeing that there is always room for a wire segment to
depart from any pin without immediately colliding with a neighbour.

### Device context menu

Right-clicking a placed device opens a context menu showing the device type
and current name. The menu provides:

* **Rename** — an inline text field pre-filled with the current name. Press
  Enter or click OK to commit. Duplicate names and empty names are rejected.
  Escape dismisses without change.
* **Delete** — removes the device from the canvas. Undoable.

### Device movement

Left-click drag on a placed device grabs it. The device disappears from its
original position and a 50%-opacity ghost follows the cursor, snapping to the
fine grid. Releasing the mouse button drops the device. If the new position
interferes with another device, the move is rejected and the device is left
in its original position. Escape cancels the move.

### Undo

An unlimited undo stack is maintained. Every operation that changes canvas
state (place, move, delete, rename) pushes a snapshot before the change.
Undo is invoked by **Ctrl+Z** (or Cmd+Z on Mac) at any time, or via the
**Undo** item in the canvas context menu. The canvas context menu shows Undo
greyed out when the stack is empty. A failed or cancelled move does not
consume an undo slot.

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
* The undo stack is cleared (the loaded state becomes the new baseline).
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

---

## Phase 2 details: *(Complete)*

### Move

Left-click on the body of a device grabs it. The device disappears from its
original position and a 50%-opacity ghost follows the cursor, snapping to
the fine grid. Releasing the button drops the device. Interference is
checked at the drop location; if blocked, the device is restored to its
original position and a message is logged. Escape cancels the move.

A failed or cancelled move does not push to the undo stack.

#### For future when wires are added:

Left clicking on a device also disconnects any input wire segments that
might be attached, but does not delete them. Note that since those wire
segments are floating, they will turn yellow.

If the device has one or more outputs attached, an error dialog is displayed:
```
Cannot move device with a connected output. Delete output wires if you want to move the device.
```

### Delete

Right-click on the body of the device brings up a context menu that includes
a delete function. If selected, the device is deleted. Undoable.

#### For future when wires are added:

Deleting a device also disconnects any input wire segments that might be
attached, but does not delete them. Note that since those wire segments are
floating, they will turn yellow.

If the device has one or more outputs attached, an error dialog is displayed:
```
Cannot delete device with a connected output. Delete output wires if you want to delete the device.
```

### Undo

An unlimited undo stack is supported. Ctrl+Z (Cmd+Z on Mac) or the Undo
item in the canvas context menu restores the previous state. All
state-changing operations (place, move, delete, rename) are undoable.

#### For future when wires are added:

If the operation being undone resulted in wires being disconnected, the undo
should restore the system state fully, including undoing the wire
disconnections. Thus, state save points are tied to user operations, not
individual element operations. For example, a device deletion might have
multiple side-effect operations, like wire segment disconnections. Since the
device deletion is seen by the user as a single operation, the system state
should not be saved until the user-perceived operation is completed.

### Device Editing

Right-clicking a placed device opens a context menu allowing name editing.
Orientation, number of inputs, and other attributes are not allowed to be
edited after placement.

## Review Comments

1. screenToCanvas calls getBoundingClientRect() on every invocation.
This is called on every mousemove during place/move. getBoundingClientRect() forces a layout reflow. For a full-screen canvas that never moves, the rect doesn't change between frames. Caching it (invalidated on resize) would be cleaner, though at this app's scale it's unlikely to be measurable.
Decided not to act.

## Next steps

Implement phase 3: Basic wires: create, extend, connect, floating-end indicator

### Create

A wire is created by right-clicking on a device's output pin and selecting "New Wire".
This creates an underlying wire object, which itself has no visible component, and also a single grid-tick wire segment
which attaches to the output pin. For now, I want a small dot to be visually present indicating the connection,
even though this is not common with professional circuit design tools. Since the segment is floating, it should be
colored yellow. The orientation of the segment should be the same as the stub it connects to.

## Extend

The floating end of the wire segment can be grabbed (left-click) and extended or contracted in its direction of orientation.
It must maintain a minimal length of 1 grid unit.
If the mouse pointer drifts off-axis, the segment should maintain its direction of orientation,
matching the coordinate of the mouse pointer along its axis but allowing the mouse pointer to show off axis.
I.e. the dragging end of the segment will not necessarily be directly connected to the mouse pointer.

During travel, the floating end might travel through points that it is not allowed to be dropped at.
For example, the segment is allowed to cross another wire, but is not allowed to be dropped onto a segment.
Trying to do so should print an oops, and the segment snaps back to its original location.

Similarly, if the user drags the end through a device, it will draw on top of the device.
But dropping the segment end should perform a full interference check,
with the same oops/snap back behavior if there is interference.

QUESTION: should we allow an orientation change by allowing the connected point to act as a hinge?
Will this greatly increase the complexity?
Since a segment can only be horizontal or vertical, how do we differentiate between the mouse drifting off
axis but maintaining orientation vs. detecting that the user wants to change the orientation by dragging?
If we support this, we should not allow going "backwards" - only 90 degree orientation changes are allowed.
And how should this be represented internally? Will it require an immediate waypoint where the segment attaches
to an output? I doubt it, but I'll let you analyze how a connection should be represented.
Finally, we could forgo the "change orientation by dragging" function and instead make it a right-click option
of the pin: "change orientation". I would prefer this if both methods are feasible but the drag method is
significantly more complex.

Phase 3 does not include general waypoints.

### Connect

If a segment is being dragged and the mouse pointer is over a device input pin colinear with
the segment being extended, the segment will change color to black, indicating that if the
end is dropped at that point, it will establish a connection. Be careful - if the mouse pointer
is off axis and pointing at a device input that is not in line with the segment,
this should not happen.

If a segment is being dropped and the mouse pointer is over a device input pin colinear with
the segment being extended, the segment will be connected to the input.
It's color should be black, indicating that it is no longer floating.
There should also be a small dot where the segment touches the input stub.

Note that if a segment is dropped one grid unit from an input pin, this will be interpreted
as interfering with the device since it will be in the buffer zone of the device. It
should print an oops and snap back.

### Disconnect

If the user left-clicks on a connected input pin of a device, they are effectively
grabbing the line segment that connects to it. This visually disconnects the
segment and enters "extend" mode. Note that at this point, the mouse pointer will be
over an input pin, so the segment will be colored black, meaning if it is dropped,
it will connect, But if the segment is extended or contracted, it will follow the
rules of segment extension.

If a segment is grabbed, disconnected, moved around, and dropped back at its
starting point, this is conceptually a "no-op" (like moving a device is a no-op if it is
dropped back at its starting point).

### Breaking Connections

If a device has one or more input pin connections and is moved, all connections are 
are "broken". Same with deleting a device with one or more input connections.
Note that a device with one or more output connections is not allowed to be moved
or deleted.

Exception: if a move operation is a "null move" (i.e. it is dropped back in its starting point),
it is treated as a "no-op". No connections are broken.
Note: this exception might contradict some explanation earlier in this document -
this is the new desired behavior.
The doc should be updated if necessary to reflect this behavior.

QUESTION: This phase has mentioned "no-op" a few times. Another no-op would be a simple
device move with no connections. This is already supported in phase 2. Note that this
"null move" consumes an undo slot. Should it? This question becomes important when
considering the other no-ops mentioned in phase 3 - should they consume an undo slot?
I'm leaning toward yes. It might be difficult to say for sure if a user operation
is truely and completely a no-op. But I will make a comparison to VIM: if I enter insert
mode and insert one character and hit escape, that consumes an undo slot. If I enter insert mode and
escape without any insert, it does not consume an undo. BUT! If I enter insert mode, insert a character, deleted
that character, and hit esacape, it is "effectively" a no-op but it DOES consume an undo slot.
So even vim has trouble differentiating. Handle this in whichever way is the least complex.

### Data Representation

The following is a conceptual sketch of the data model for wiring.
It should not be seen as "handcuffs" during implementation,
but changes to it should be made with due consideration to all code areas
that rely on the data model.

A wire is a collection of wire segments and branch points.
It forms a binary tree with branch points as the nodes of the tree.
The tree does not need to be balanced; its structure will be
fully under the control of the user.
In phase 3 we are not doing branch points yet,
but the data model should allow for them.

A wire is associated with a device output pin which drives the wire.
So the wire contains a reference to a (device name, output pin name),
and a device's output pin contains a refreence to a (wire, wire segment).

A segment has two ends and a list of waypoints. In phase 3 we are not doing waypoints yet,
but the data model should allow for them.

One end of a segment is called "upstream" and is graphically closer to
the output pin to which the overall wire attaches.
The other end is called "downstream".
A segment can be "floating", which means that its downstream end is
not connected to anything.
In phase 3, the only thing we will connect a downstream segment end to
is a device input pin. In phase 4 it can also connect to a branch point.
The data model will need to differentiate between them.

An orphaned wire would be one that has no device output pin associated
with it. We are designing the UI to prevent the creation of orphaned
wires, so every existing wire must have a device output pin.
(In contrast, orphaned devices with no connections to them are perfectly fine.)
