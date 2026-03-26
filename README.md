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
them. A circuit will be defined with this language in a text file with
the suffix ".lsim".

To date, creation of the `.lsim` file was fully manual by text editor.
The intent has always been to have a GUI tool for graphically designing
the circuit. The lsim tool fulfills that intention.

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

* Device - a circuit component, like a NAND gate, an LED, or e register. These correspond to created by a "d" command in a `.lsim` file.
* Named Net - a special type of pseudo device. See (Named Net)[#named_net].
* Wire - an object created by ldraw. See (Data Model)[#data_model] below.
* Segment - an object created by ldraw. See (Data Model)[#data_model] below.
* Branch point - an object created by ldraw. See (Data Model)[#data_model] below.
* Upstream - the end of a segment that is graphically closer to the driving device's output.
* Downstream - the end of a segment that is graphically closer to the consuming device' inputs.
* Interfere - when placing a wire segment or a device, interference is when any part of the object being
  placed overlaps with an existing object. Some forms of interference are allowed. For example,
  two wire segments can cross each other. But unless otherwise stated, interferences are not alloed.
  A wire segment cannot occupy the same space as a device or a way point or a branch point or a device pin.

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

* `type` — device type string (e.g. `nand`, `dflipflop`, `reg`, `namednet`).
* `name` — unique instance name. Duplicate names are not allowed (except for named nets).
* `params` — type-specific parameters (e.g. numInputs, numBits, numAddr, numData).
* `position` — {x, y} on canvas.
* `orientation` — 'right'|'left'|'up'|'down' (default 'right').
* `geo` — cached geometry object, recomputed when position or orientation changes.

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
branch point. A branch point is created by splitting an existing segment
at its downstream end, producing two new segments.

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
* upstream (toward the driving device's output).
* downstream A.
* downstream B.

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

A "named net" is a special kind of pseudo device.
It two params:
* Name
* type ("input" or "output")

It is drawn as an arrow head pointing at a name.

For most purposes, it can be treated as any other device.
It can be created, moved, oriented, and connected to wires.
It has a single pin, which is an input for input-typed named nets
and an output for output-typed named nets.
They can be wired to other devices like any other kind of device.

The special properties are:
* Multiple named net devices can share the same name. In fact, that's the point.
* A group of like-named net devices must have exactly one "input" typed member,
and zero or more "output" typed members.
* When generating a `.lsim` output file, named net devices are not treated as
devices, but rather like wires. All named net devices with a given name are
considered to be wired directly together. So there is no "d" lsim command
for the named net. Rather it will generate "c" lsim commands defining the
connections.

A common use for a named net would be to create a vcc device and a
named net device of type input named "vcc". A wire segment will be drawn between
these two. Then, everywhere that a device input needs vcc, another
named net device of type output will be created named "vcc" and
connected to the device input that needs vcc.
Visually there is no line connecting the vcc device and the input pin.

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
* Box devices (`clk`, `mem`, `srlatch`, `dflipflop`, `reg`, `panel`, `addword`, `addbit`) support mirror orientation.
* `gnd` and `vcc` are fixed orientation.
* Edge-triggered clock inputs use a `clockTriangle` shape instead of a pin label.

---

## Extensibility

New composite device types (all will be boxes) need only:
1. A geometry function (or reuse a generic box geometry helper — TBD)
2. Entries in `SYMBOL_FACTORIES`, `CANVAS_RENDERERS`, `SVG_RENDERERS`

No other code changes required.

---

## Open Design Questions

These items were identified during review and need resolution.

### Wire-to-pin attachment

Each pin's geometry includes a connection point (the tip of its stub line,
stored in `pins[id] = {x, y}`). Wires attach at this point. The first
run of a wire leaving an output pin must travel in the direction the stub
points (away from the device body). Same constraint applies to the
last run arriving at an input pin.

### Grid and snapping

Clean Manhattan routing, a snap-to-grid system is
almost certainly needed. Define a grid pitch (e.g. 10 px) and
snap all device positions, waypoints, and branch points to grid
intersections. It is the pins that must be exactly on grid;
the device shape does not have to be.

### Z-order / draw order

Wires drawn first, devices on top.
Wire crossings shown as a plain cross (no gaps, no "hop" arcs).

### `.ldraw` save format

Must store at minimum: device positions and orientations, wire trees
(segment waypoints, branch point locations, pin attachments).

Format is pretty-printed JSON. Schema not yet defined.

### SVG export scope

Export only placed devices and their attached wires (complete or incomplete).

### Device Repositioning

**Resolved:** Yes, placed devices can be moved (left-click drag).
Attached segments remain in place but become floating (disconnected
from the moved device's pins). No rubber-banding — reconnection is
manual.

---

## User Interface

### Application Launch

Single self-contained HTML file opened in Chrome. URL parameters provide
hints for which files to load:

    ldraw.html?lsim=seq1.lsim&ldraw=seq1.ldraw

These hints are displayed to the user but cannot auto-open files (browser
security). The user confirms each file load via a picker dialog.

### File Loading

Zero or one load operation at startup via File System Access API pickers:

* **Load `.ldraw`** (optional) — restores previous drawing state.

Drag-and-drop is also supported: user can drop the `.ldraw` file into
the canvas area.

### Saving

Three independent save operations, each triggered separately:

* **Save `.ldraw`** — serializes drawing state (device positions,
  orientations, wire trees, named-net assignments). Format is
  pretty-printed JSON for human readability and diff-friendliness.
* **Export `.svg`** — exports current canvas as SVG.
* **Export `.lsim`** — exports current circuit as lsim definition file.

These are deliberately not bundled. The user may save `.ldraw` frequently
while working and only export `.svg` occasionally, or vice versa.

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
showing all supported devices rendered with their symbols and names.
Mouse pointer stays in same place on screen.

The user moves mouse to desired device and clicks down on a device in this view. The mousedown:
* Grabs the device.
* Immediately repaints the canvas to the normal drawing view.
* The device appears as a ghost image attached to the cursor at
  the current mouse position (no spatial discontinuity — pointer
  stays in the same screen position across the repaint).
* Device is in default 'right' orientation during placement.
  Orientation is not changeable during the drag.
* User moves the ghost to the desired position and releases.
  The device is now placed.
* The device name defaults to a globally unique name consisting of the device type and a number that is incremented
  each time a device of that type is created. Thus the first NAND gate will be named nand1.
  Other device attribute default to reasonable values (two inputs for NAND, two bits for mem data and address, etc.).

This interaction is deliberately consistent with the move interaction
(see below).

If a device is released at a position that interferes with another device or wire segment, an error message
is printed and it is automatically deleted (or just not created to begin with). This lack of user friendliness is acceptable.

**Special size warning** - Devices are given a 2-unit extra size buffer along any edge that has pins.
This is to allow a 1-unit wire segment to be connected to the pin without interfering with anything.

### Device Context Menu (Right-Click)

Right-clicking a placed device opens a context menu with:

* **Change device parameters** - submenu for device name, number of inputs, outputs, address bits, etc.
  The parameters required by the lsim language.
  Changing some parameters will result in the pins moving.
  If a pin attached to a wire segment moves, the wire segment is detached from the pin and becomes floating.
  The wire segment remains stationary. No attempt will be made to rubber-band the segment.
  If the attribute change would expand the size of the device and causes it to interfere with something else,
  the change is un-done and an error is printed.
* **Orientation** — submenu with right / left / up / down. Options
  that are not supported by the device type are greyed out.
  The wire segment remains stationary. No attempt will be made to rubber-band the segment.
  If a pin attached to a wire segment moves, the wire segment is detached from the pin and becomes floating.
* **Delete** - the devices is deleted from the drawing. Any wire segments attached to pins will be deteched and become floating.
* **Wire** - brings up submenu of each output pin that is currently floating. When selected, initiates wire creation.
* **Net** - brings up submenu of each output pin that is currently floating. When selected, initiates "named net" creation.

### Wire Creation

* Right-click on a device to bring up its context menu.
* The "wire" submenu lists the floating output pins.
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
a connection is established and the end is no longer floating (it's color should change to black).
A dot should be drawn to indicate the connection.

Right-click the wire segment brings up wire context menu.

* **Turn right** - inserts a way point and extends one unit past that way point in the direction 90 degrees counter-clockwise.
  If that extension interferes with something, the operation is un-done and an error is printed.
* **Turn left** - inserts a way point and extends one unit past that way point in the direction 90 degrees clockwise.
  If that extension interferes with something, the operation is un-done and an error is printed.
* **Branch** - brings up a sub-menu of the different "T" shapes appropriate for this segment.
  For example, if the floating end is pointing right, then the choices should be right-up-left, right-down-left,
  or right-up-down. The "left-up-down" is greyed out.
  On selection, a branch point is inserted and two new line segments are created, pointing in the desired directions.
  Those two creations act the same as a normal segment creation - if either one interferes, the whole operation is
  rolled back and an error is printed. However, in the specific case where the newly created segment ends on a device
  input pin, it is immediately connected.
  
### Named Net Creation

A named net is created via the context menu of 

### Device Movement

Left-click and hold on a placed device picks it up as a ghost image.
Drag to new position, release to place. Same visual feedback as initial
placement.

**Wire breakage on move:** If the device has segments attached to
its pins, those segments remain in place but their endpoints become
floating (disconnected from the pin). The wire topology is otherwise
preserved — only the attachment points to the moved device are
broken. Even if the device is moved back to its original position,
segments remain disconnected and must be manually reconnected.

If a device being moved is released at a position that interferes with another device or wire segment, an error message
is printed and it is automatically snaps back to its original location. This lack of user friendliness is acceptable.

### Disconnected Segment Visual

A segment that is not connected to a device pin or branch point on
both ends is drawn in yellow (vs. the normal wire color). This provides
a clear visual indicator of "broken" wires that need attention.

### Click Interpretation

Left-click meaning depends on application state:

* **New Device view:** mousedown on a device grabs it for placement
  and changes to normal drawing view.
* **Normal drawing view, neutral mode:** left-click on a
  device picks it up for movement.
* **Wire routing mode:** left-click places waypoints or attaches
  to pins.

Care must be taken as wire routing is designed to ensure click targets
are unambiguous — clicking on a device vs. clicking on empty canvas
vs. clicking on a wire must be clearly distinguishable by context/state.

---

## Wire Routing (possible future)

* Initially: user specifies wire paths manually (click-to-place waypoints)
* Future: automatic orthogonal routing ("good enough," not optimal)
* Wires follow right-angle (Manhattan) paths
