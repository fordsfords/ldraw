# ldraw — logic circuit schematic drawing

## Purpose

ldraw is a GUI-based interactive schematic diagram drawing tool for creating,
modifying, and displaying logic circuits.

There is a library of parts that can be placed on a canvas and interconnected.
The drawing can be saved in a `.ldraw` file that fully defines everything about
the drawing so that it can be read in the future and the drawing edited.

The visual diagram can also be written in `.svg` form for printing purposes,
but this will not retain full knowledge of the circuit itself.

The logic circuit can also be saved in a special ".lsim" format that can be
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
* The tool can also save its internal representation of the drawing to a ".ldraw" file.
  Thus, at startup, you can read a ".ldraw" file.
  You will see the drawing as it previously existed and can modify it and re-save it.
* The tool can also save a ".lsim" file that represents the circuit for the lsim hardware simulator.

---

## Definitions

These terms will be use carefully and unambiguously in this document to mean only what is defined here.

* Device - a circuit component, like a NAND gate, an LED, or e register. These correspond to devices created by a "d" command in a `.lsim` file.
* Named Net - a special type of pseudo device. See [Named Net](#named-net).
* Wire - an object created by ldraw. See [Data Model](#data-model) below.
* Segment - an object created by ldraw. See [Data Model](#data-model) below.
* Branch point - an object created by ldraw. See [Data Model](#data-model) below.
* Upstream - the end of a segment that is graphically closer to the driving device's output.
* Downstream - the end of a segment that is graphically closer to the consuming device' inputs.
* Unit - the fundamental spatial quantum of the drawing. Grid pitch, minimum pin-to-pin
  spacing, minimum parallel wire spacing, and snap granularity are all one unit.
  One unit equals `PIN_SPACE` (20) canvas coordinate units. Canvas coordinates map
  1:1 to CSS pixels at the default transform.
* Interfere - when placing or extending an object (device, wire segment, waypoint, branch point),
  interference occurs when any part of the object being placed overlaps with an existing object
  in a disallowed way. The complete set of interference rules:
  - A device cannot overlap another device (including pin buffer zones).
  - A device cannot overlap a wire segment, waypoint, or branch point.
  - Two wire segments cannot share any portion of a collinear run (two horizontal segments on
    the same Y must not share any X range; two vertical segments on the same X must not share
    any Y range). This applies across all wires.
  - A wire segment cannot overlap a device (including pin buffer zones).
  - A waypoint or branch point cannot occupy the same coordinates as another waypoint,
    branch point, or device pin (all must be globally unique positions).
  - Wire segments *are* allowed to cross other wire segments at a point (a "+" junction),
    provided the crossing point is not at a waypoint or branch point of either segment.

## Implementation Environment

A single self-contained `.html` file, opened directly in Chrome from the
local file system. No server, no build step, no installed dependencies.
External JS libraries may be loaded from CDNs.

All rendering, interaction, and application logic is in HTML, CSS, and
JavaScript within this single file.

### File I/O

Uses the browser's **File System Access API** (Chrome):

* **Read**: user selects a file via picker; app reads contents as text
  - Also support drag-and-drop a file
* **Write**: user selects destination; app writes text content directly

### Constraints

* Chrome is the target browser
* No persistent storage between sessions; all state lives in memory
* Error and warning messages are written to the browser console (`console.log`)

---

## Lsim Output File Format

See `circuit-language-docs.md` for the full `.lsim` format. The drawing tool
only generates structural commands:

* `d` — Define device (creates a device with typed pins)
* `c` — Connect (single wire between one output pin and one input pin)

### Pin naming convention

Pin IDs are a letter followed by a number (e.g. `i0`, `q0`, `R0`).
**Upper-case letter = active-low (inverted) signal.**
Any pin whose ID starts with an upper-case letter automatically gets an
inversion bubble in the rendered symbol. This is the only mechanism that
produces bubbles — there is no per-device bubble specification.

---

## Data Model

### Devices

Each device object contains:

* `type` — device type string (e.g. `nand`, `dflipflop`, `reg`, `netsource`, `netsink`).
* `name` — unique instance name. Duplicate names are not allowed (except for named nets).
* `params` — type-specific parameters (e.g. numInputs, numBits, numAddr, numData).
* `position` — {x, y} on canvas.
* `orientation` — 'right'|'left'|'up'|'down' (default 'right').
* `geo` — cached geometry object, recomputed when position changes.

See the lsim language document for full details of params.

### Wires

A "wire" is a line graph on the drawing that connects a device output to one or
more device inputs. A wire can be a single segment or a set of
segments joined by branch points, forming a binary tree of segments.
When an output must be connected to more than one input, the path must be
broken into multiple segments connected at "branch points", represented
visually as dots.
Each branch point has one upstream segment and two downstream segments.
The root of the tree is the output of a device and the leaves are
the inputs that it connects to.

A branch point is visually a "T" junction that can be in any of the 4
orientations. Note that the letter "T" itself is shaped as a down-facing
branch point. The vertical stroke is the "stem" (the upstream segment)
and the two ends of the horizontal stroke are the "arms" (the downstream
segments). A branch point can be created in two ways: by branching at
the floating downstream end of a segment (producing two new arm segments),
or by tapping into an existing connected segment (splitting it and adding
a new arm).

Segments are allowed to cross without connection (a "+" junction visually).
But segments cannot overlap a device or overlap another segment.

#### Segment non-overlap rule

A segment is an orthogonal polyline defined by an ordered list of waypoints;
each consecutive pair of waypoints forms one horizontal or vertical run.
A segment has two ends, upstream and downstream.
Each segment end connects to either a device output, a device input, or a branch point.
A segment also contains a reference to the wire that it is part of.

No two segments may share any portion of a collinear run: two horizontal
segments on the same Y must not share any X range, and two vertical segments
on the same X must not share any Y range. This applies across all wires,
not just within a single wire.

Additionally, every waypoint and branch point must have globally unique
coordinates — no two unconnected segment endpoints or waypoints may occupy
the same (x, y) position.

A wire is internally represented as:
* A reference to a device output (root of the tree)
* A binary tree of segments. Each node references a branch point.

A branch point contains references to the three segment ends that connect to it:
* stem (upstream, toward the driving device's output).
* arm A (downstream).
* arm B (downstream).

Each device's inputs and outputs contain references to the wire and segment end they connect to.

For this version of the tool, the creation of wires, segments, branch points, and way points are
created by user action, not generated automatically by the tool (no auto routing).

During operation, a wire is created at an output pin of a device. It can be in an incomplete state,
meaning that it contains segments with "floating" downstream ends (not yet connected to any thing).
This is a normal state of affairs. A wire is termed complete when it fully represents the set of
connections made to that wire's device output.

### Connections

When generating a `.lsim` file, a wire will generate a set of "c" connection commands for lsim.
For example, a wire that connects a NAND gate's output to three other devices' inputs will
generate three connection commands for each of the output:input pairs. Note that the `.lsim`
file does not have any location information.

### Named Net

A "named net" is a special kind of pseudo device. There are two distinct
device types: `netsource` and `netsink`. Each has a single parameter: the
net name.

A `netsource` is drawn as an arrowhead pointing at a name.
A `netsink` is drawn as a chevron (V-shape) with the point
being the connection point, next to the name.
The distinct shapes make signal direction immediately visible.

For most purposes, named nets can be treated as any other device.
They can be created, moved, oriented, and connected to wires.
A `netsource` has a single input pin; a `netsink` has a single output pin.
They can be wired to other devices like any other kind of device.

The special properties are:
* Multiple named net devices can share the same name. In fact, that's the point.
* A group of like-named net devices must have exactly one `netsource` member
and zero or more `netsink` members.
* When generating a `.lsim` output file, named net devices are not treated as
devices, but rather like wires. All named net devices with a given name are
considered to be wired directly together. So there is no "d" lsim command
for the named net. Rather it will generate "c" lsim commands defining the
connections.

A common use for a named net would be to create a `vcc` device and a
`netsource` named "vcc". A wire segment will be drawn between these two.
Then, everywhere that a device input needs vcc, a `netsink` named "vcc"
will be created and connected to the device input that needs vcc.
Visually there is no line connecting the vcc device and the input pin.

If a `netsource` is deleted, all `netsink` devices with the same name
are drawn in red and a warning is printed. The user can resolve this by
creating a new `netsource` with that name. The red rendering clears
automatically once a matching source exists again.

---

## Symbol Library

Each device type has three
functions: `xxxGeometry()`, `renderXxxCanvas()`, `renderXxxSVG()`.

### Architecture: geometry/render separation

* `xxxGeometry(ox, oy, name, ...params)` — computes all shape coordinates,
  label positions, and pin endpoints in canvas space. Returns a plain data
  structure. Pure function, no side effects.
* `renderXxxCanvas(ctx, geo, fg, mid, bg)` — consumes geometry, issues
  canvas 2D draw calls.
* `renderXxxSVG(geo, fg, mid, bg)` — consumes same geometry, returns SVG
  element strings. Identical visual output to canvas version.

This separation means geometry is computed once and reused for both
interactive canvas rendering and SVG export.

### Dispatch tables
`SYMBOL_FACTORIES`, `CANVAS_RENDERERS`, and `SVG_RENDERERS` are dictionaries
keyed by device type string. Use these for dispatch instead of switch
statements — makes adding new device types trivial.

### Shared helpers

* `_renderShapesCanvas(ctx, shapes, fg, bg)` — renders rect/circle/line/polygon/clockTriangle
* `_renderShapesSVG(shapes, fg, bg)` — same for SVG
* `_renderLabelsCanvas(ctx, labels, fg, mid)` — renders name and pin labels
* `_renderLabelsSVG(labels, fg, mid)` — same for SVG
* `_l2c(pivotX, pivotY, totalW, totalH, cos, sin, lx, ly)` — transforms
  local symbol coordinates to canvas space with rotation
* `_mirrorBoxGeo(geo, axisX)` — flips a geometry object horizontally
  around axisX; used by all box devices to implement 'left' orientation

### Style globals

`SYM_FG`, `SYM_MID`, `SYM_BG` — set via `symSetColors(fg, mid, bg)` at
startup. Separate from CSS; used by both canvas and SVG renderers.

`PIN_SPACE` (constant, 20) — default pin-to-pin spacing used by all box
device geometry functions.

### Symbol details

Per-device shapes, pin layouts, orientation support, and rendering logic
are defined in `ldraw.html` (the block comments above each geometry function
document the pin assignments and visual conventions). That file is the
authoritative source for all device rendering details.

Key conventions enforced across all devices:

* A device's "natural" orientation has primary outputs pointing right.
  "fixed" = right only; "mirror" = right or left; "all 4" = right/left/up/down.
* `nand`, `led`, and `swtch` support all 4 orientations.
* `netsource` and `netsink` support all 4 orientations.
* Box devices (`clk`, `mem`, `srlatch`, `dflipflop`, `reg`, `panel`, `addword`, `addbit`) support mirror orientation.
* `gnd` and `vcc` are fixed orientation.
* Edge-triggered clock inputs use a `clockTriangle` shape instead of a pin label.

The `probe` device type defined in the lsim language is deliberately excluded
from ldraw. It is a simulator-only diagnostic tool, not a circuit component.

---

## Extensibility

New composite device types (all will be boxes) need only:
1. A geometry function (or reuse a generic box geometry helper — TBD)
2. Entries in `SYMBOL_FACTORIES`, `CANVAS_RENDERERS`, `SVG_RENDERERS`

No other code changes required.

---

## Design Decisions

These items were identified during review. Most are now resolved;
remaining open items are marked.

### Wire-to-pin attachment

Each pin's geometry includes a connection point (the tip of its stub line,
stored in `pins[id] = {x, y}`). Wires attach at this point. The first
run of a wire leaving an output pin must travel in the direction the stub
points (away from the device body). Same constraint applies to the
last run arriving at an input pin.

#### Connection validity

A segment's downstream (floating) end can only connect to a device **input** pin
(including the input pin of a `netsource` device). Dropping a downstream
end onto a device **output** pin (including the output pin of a `netsink`
device) is an error — the segment snaps back. This enforces the rule that
signal flows from a single output through the wire tree to one or more inputs.

### Grid and snapping

All device positions, waypoints, and branch points snap to a grid
whose pitch is one unit (see Definitions). It is the pins that must
be exactly on grid; the device shape does not have to be.

### Z-order / draw order

Wires drawn first, devices on top.
Wire crossings shown as a plain cross (no gaps, no "hop" arcs).

### `.ldraw` save format — OPEN

Must store at minimum: device positions and orientations, wire trees
(segment waypoints, branch point locations, pin attachments).

Format is pretty-printed JSON. Schema not yet defined.

### SVG export scope

Export all placed devices and their attached wires (complete or incomplete).
Disconnected segments (yellow) and orphaned named nets (red) are included
in the export — the SVG reflects the canvas exactly, including work-in-progress
state. The SVG viewBox is bounded by the outermost device and wire bounding
boxes plus a 2-unit margin on all sides.

### Device Repositioning

**Resolved:** Placed devices can be moved (left-click drag), but only
if no output wires are attached. Input wire segments detach and become
floating. No rubber-banding — reconnection is manual.

---

## User Interface

### Application Launch

Single self-contained HTML file opened in Chrome. URL parameters provide
hints for which files to load:

    ldraw.html?ldraw=seq1.ldraw

These hints are displayed to the user but cannot auto-open files (browser
security). The user confirms each file load via a picker dialog.

### File Loading

One load operation at startup, via File System Access API picker:

* **Load `.ldraw`** (optional) — restores previous drawing state. If
  skipped, the canvas starts empty with no devices or wires.

Drag-and-drop is also supported: user can drop a `.ldraw` file onto
the canvas area.

### Saving

Three independent save/export operations, each triggered separately:

* **Save `.ldraw`** — serializes drawing state (device positions,
  orientations, wire trees, named-net assignments). Format is
  pretty-printed JSON for human readability and diff-friendliness.
* **Export `.svg`** — exports current canvas as SVG.
* **Export `.lsim`** — generates a circuit definition file for the
  lsim hardware simulator, containing `d` and `c` commands derived
  from the drawing.

These are deliberately not bundled. The user may save `.ldraw` frequently
while working and only export occasionally, or vice versa.

### Typical Workflow

1. Launch tool, optionally load `.ldraw`.
2. Place devices, route wires, edit drawing.
3. Save `.ldraw`.
4. Optionally export `.svg` file.
5. Optionally export `.lsim` file.
6. Return to step 2 or close tool.

Relaunch later: load same `.ldraw`, and resume at step 2.

### Device Placement — Selection View

A button labeled "Add" switches the canvas to a dedicated view
showing all supported devices rendered with their symbols and names,
each at its default size. Mouse pointer stays in same place on screen.

If a `clk` device already exists on the canvas, the `clk` entry in
the selection view is greyed out and cannot be selected (the lsim
simulator allows at most one clock).

**Right-click in selection view** opens a parameter editor for the
clicked device type. This is the only place to configure orientation
and size-affecting parameters — neither can be changed after placement.

Available settings per device type:
- **Orientation:** all devices except `gnd` and `vcc` (which are fixed)
  can be set to the orientations they support. Default is 'right'.
  The device re-renders at the selected orientation so the user sees
  exactly what they are about to grab.
- **Size parameters:** number of inputs for `nand`, bit widths for
  `reg`/`panel`/`addword`, address and data widths for `mem`.
  The device re-renders at the configured size.

The selection view remembers the most recently configured parameters
for each device type. Creating multiple 4-input NANDs in a row does
not require reconfiguring each time.

`gnd` and `vcc` have no right-click action in this view (fixed
orientation, no size parameters).

**Left-click (mousedown) in selection view** on a device grabs it:
* Immediately repaints the canvas to the normal drawing view.
* The device appears as a ghost image attached to the cursor at
  the current mouse position (no spatial discontinuity — pointer
  stays in the same screen position across the repaint).
* The device uses the orientation configured in the selection view
  (default 'right'). Orientation is not changeable during the drag.
* User moves the ghost to the desired position and releases.
  The device is now placed.
* The device name defaults to a globally unique name consisting of
  the device type and a number that is incremented each time a device
  of that type is created. Thus the first NAND gate will be named nand1.
  For `netsink` devices, the naming follows the rules in Named Net Naming.

This interaction is deliberately consistent with the move interaction
(see below).

If a device is released at a position that interferes with another device or wire segment, an error message
is printed and it is automatically deleted (or just not created to begin with). This lack of user friendliness is acceptable.

**Pin buffer zone** — Devices have a 2-unit buffer zone extending outward
from any edge that has pins. This buffer is not part of the device's visual
shape; it is applied during interference checks only. Its purpose is to
guarantee that a 1-unit wire segment can always be created on any output pin
without interfering with adjacent objects. When checking whether a device
placement or object placement interferes, the buffer zone is treated as
part of the device's occupied area.

### Device Context Menu (Right-Click)

Right-clicking a placed device opens a context menu with:

* **Name** — edit the device's instance name.
  For named net devices (`netsource`, `netsink`), this edits the net name
  with the rename rules described in Named Net Renaming below.
* **Delete** — the device is deleted from the drawing. Any wire segments
  attached to pins will be detached and become floating.
* **Wire** — brings up submenu of each unconnected output pin. When selected,
  initiates wire creation.

Orientation and size-affecting parameters are **not** editable after
placement. They can only be configured in the device selection view
before the device is placed (see Device Placement above).

### Wire Creation

* Right-click on a device to bring up its context menu.
* The "wire" submenu lists the unconnected output pins.
* User selects one.
* That output is re-drawn with a wire segment attached to it of length 1,
  extending in the same direction as the output is pointing.

This segment is currently the only segment of the wire object.
It is "floating", meaning that its downstream side
is not connected to anything.

The floating end can be grabbed (left click) and extended or contracted (minimum length 1).

If during extension the segment end is released and the resulting segment interferes with something,
the operation is rolled back (the segment end snaps back to its original position) and an error is printed.
Note that wires are allowed to cross other wires, but not at way points or branch points.
Also, if at release the floating end of the wire segment is directly over a device input pin,
a connection is established and the end is no longer floating (its color should change to black).
A dot should be drawn to indicate the connection.

Right-click the wire segment brings up wire context menu.

* **Turn right** - inserts a way point and extends one unit past that way point in the direction 90 degrees clockwise.
  If that extension interferes with something, the operation is un-done and an error is printed.
* **Turn left** - inserts a way point and extends one unit past that way point in the direction 90 degrees counter-clockwise.
  If that extension interferes with something, the operation is un-done and an error is printed.
* **Branch** - inserts a branch point at the floating end of the segment.
  A branch point is a "T" junction: the stem is the upstream segment
  (the existing segment terminates here) and two arms extend downstream
  as new segments of length one unit. The user picks which two of the three
  remaining directions the arms point in. For example, if the floating end
  is pointing right, the stem arrives from the left; the arms can be any
  two of {right, up, down}, giving three choices. A sub-menu presents
  these choices as small "T" icons in the appropriate orientations.
  On selection, the branch point is inserted and two new segments are created.
  If either new segment interferes with something, the whole operation is
  rolled back and an error is printed. If a newly created segment end
  lands on a device input pin, it is immediately connected.
* **Delete** — deletes this segment and everything downstream of it,
  including any branch points and their downstream segments (recursively).
  If this is the root segment (directly connected to a device output pin),
  the entire wire is deleted. If deleting one arm of a branch point, the
  branch point remains intact: the deleted arm is replaced by a new 1-unit
  floating segment in the same direction the deleted arm was pointing.
  To remove a branch point entirely, right-click the branch point dot
  (see Branch Point Context Menu below).
* **Tap** — available only when right-clicking a segment that is part of
  a connected path (not a floating end). Inserts a branch point at the
  right-click location (snapped to grid), splitting the segment into two
  (upstream and downstream of the new branch point). A new 1-unit floating
  arm segment is created perpendicular to the tapped segment. If the
  insertion point or new arm interferes with anything, the operation is
  rolled back and an error is printed. The user picks the perpendicular
  direction (two choices) from a sub-menu.
  
  If the tap point falls on a waypoint (a bend in the segment), the waypoint
  is removed and replaced by the branch point. The segment is split into two
  at that location. The orientation choices for the new arm are constrained
  by the two directions already occupied by the segments entering the branch
  point — the arm must go in one of the two remaining directions.

### Branch Point Context Menu

Right-click on a branch point dot opens a context menu with:

* **Delete** — removes the branch point entirely. Both arm segments
  (and everything downstream of each) are deleted recursively. The stem
  segment's downstream end becomes floating at the former branch point
  location.

### Wire Editing Limitations

Inserting or moving waypoints on existing segments is not supported in
this version. To reroute a wire, delete the segment (and its downstream
tree) and rebuild from that point.
  
### Named Net Creation

`netsource` and `netsink` are available as device types in the Add
button's device selection view. They are created, placed, and connected
to wires using the same interactions as any other device. The net name
can be changed via the device context menu.

#### Named Net Naming

The editor maintains a "current net name" to streamline creation of
multiple sink devices for the same net:

* When a `netsource` is created, it receives an auto-generated
  unique name (following the standard naming pattern) and that name is
  saved as the current net name. If the user later renames this source
  via the context menu, the current net name is updated to match.
* When a `netsink` is created, it reuses the current net name.
  This allows creating multiple sinks in a row for the same net without
  manually renaming each one.
* Creating a non-named-net device does not affect the current net name.
* If no current net name exists (e.g. at startup before any source has
  been created), a new `netsink` receives an auto-generated unique name
  as a fallback.

#### Named Net Renaming

* **Renaming a `netsource`** cascades: all `netsink` devices that share
  the old name are automatically renamed to the new name. The current
  net name is also updated.
* **Renaming a `netsink`** does not cascade. The new name must match an
  existing `netsource`; if no source with that name exists, the rename
  is rejected and an error is printed.

### Device Movement

Left-click and hold on a placed device picks it up as a ghost image.
Drag to new position, release to place. Same visual feedback as initial
placement.

**Output wire restriction:** A device that has any wire attached to an
output pin cannot be moved. The user must delete the output wire(s)
first. This is because a wire's data structure is rooted at its device
output pin — detaching it would orphan the wire.

**Input wire detachment on move:** If the device has segments attached
to its input pins, those segments remain in place but their endpoints
become floating (disconnected from the pin). Even if the device is moved
back to its original position, segments remain disconnected and must be
manually reconnected.

If a device being moved is released at a position that interferes with
another device or wire segment, the device snaps back to its original
location, re-detaching any input wires (use undo to restore the
pre-move state including input wire connections).

There is no explicit cancel during a drag. To abort, drop the device
anywhere (even its original position) and then undo to restore the
previous state.

### Disconnected Segment Visual

A segment with at least one end that is not connected to a device pin
or branch point is drawn in yellow (vs. the normal wire color). This
provides a clear visual indicator of "broken" wires that need attention.

### Click Interpretation

Left-click meaning depends on what is under the cursor:

* **Device selection view:** mousedown on a device grabs it for placement.
  Right-click opens a parameter editor for orientation and size parameters.
* **Normal drawing view — on a device:** picks it up for movement
  (blocked if device has output wires attached).
* **Normal drawing view — near a floating segment end:** grabs the end
  for extension or contraction. "Near" means within a small hit radius
  of the endpoint. The drag is constrained to the segment end's current
  direction; to change direction, use the right-click context menu
  (Turn right / Turn left). Clicking in the middle of a segment
  does nothing.
* **Normal drawing view — on empty canvas:** initiates canvas panning
  (grab-and-drag to scroll the view).

Right-click on a placed device opens the device context menu.
Right-click on a wire segment opens the wire context menu.
Right-click on a branch point dot opens the branch point context menu
(see Branch Point Context Menu above).

**Click priority:** if a floating segment end overlaps a device (e.g. in
the pin buffer zone), the segment end takes priority for both left-click
and right-click. Devices have large click targets; segment ends are small
and easy to miss, so they get priority when overlapping.

### Canvas Navigation

Left-click and drag on empty canvas pans the view. The canvas
coordinate space ranges from −512 to +512 units in both axes, with the
origin at (0, 0). The first device placed defaults to near the center.
This is far larger than any practical circuit but keeps coordinates
bounded.

Zoom is not supported in this version.

### Undo

Every user operation captures a snapshot of the affected state before
making changes. This snapshot serves two purposes:

* **Error rollback:** if the operation fails partway through (e.g.
  interference detected after partial mutation), the snapshot is
  restored immediately. This eliminates the need for operation-specific
  rollback logic.
* **User undo:** the most recent snapshot is retained as a single-level
  undo. A keyboard shortcut (Ctrl-Z) or UI button restores it.
  Only the most recent operation can be undone; there is no undo stack.

Each new operation overwrites the previous undo snapshot. Performing
an undo is itself an operation (so undoing an undo restores the
original state).

---

## Wire Routing (possible future)

* Initially: user specifies wire paths manually (click-to-place waypoints)
* Future: automatic orthogonal routing ("good enough," not optimal)
* Wires follow right-angle (Manhattan) paths

---

## Next Steps

We discussed how to write the code: big bang or baby steps. Here's what we settled on.

* On the build approach — baby steps, without question. Not because you're working with a human, but because you're working with an LLM. Here's the thing: if I try to write the whole app in one shot, I'll make design decisions deep in the wire routing code that are inconsistent with assumptions I made in the device placement code 2000 lines earlier. I can't effectively hold the entire state machine in context and get all the edge cases right simultaneously. Nobody can, but I'm particularly prone to plausible-looking-but-subtly-wrong code when the scope is large.
* The other practical issue is debugging. If I write 4000 lines and it doesn't work, figuring out what's wrong is miserable for both of us. If I write 300 lines and it doesn't work, you can usually tell me what you see and I can fix it.
Here's how I'd break it up:

1. Phase 1 — Static canvas with devices. Load/save .ldraw (just devices, no wires yet). The Add button and selection view. Place devices on the canvas, see them rendered. This exercises the geometry/render code you already have, gets the canvas and coordinate system working, and gives you something visual immediately. Include panning.
2. Phase 2 — Device interactions. Move devices (with the output-wire restriction, though there are no wires yet). Right-click context menu for name editing. Delete. The undo snapshot mechanism — get this in early since everything depends on it.
3. Phase 3 — Basic wires. Create a wire from an output pin. Extend/contract the floating end. Connect to an input pin. Yellow for disconnected, black for connected, dots at connections. This is where you first see a circuit take shape.
4. Phase 4 — Wire topology. Turn left/right (waypoints). Branch. Tap. Delete segment. Branch point context menu. This is the hardest phase — the tree data structure and interference checking are where the real complexity lives.
5. Phase 5 — Named nets. The netsource/netsink devices are already renderable. This phase adds the naming logic, cascade rename, orphan detection (red rendering), and the current-net-name state.
6. Phase 6 — Export. .lsim generation from the drawing. .svg export. These are read-only traversals of the data model, so they're relatively straightforward once the model is solid.

On unit tests — you're right that most of the app is hard to test without eyes. But there's a non-trivial core that is testable: interference detection (given two bounding boxes or a segment and a box, do they interfere?), the wire tree data structure (insert branch, delete arm, tap), segment collinear overlap checks, snap-to-grid, and .lsim generation from a known device/wire graph. These are pure functions with no DOM dependency. I'd write tests for those and skip the rendering/interaction layer. The effort-to-value ratio is good for the geometry math, and bad for "did the ghost image follow the cursor."
