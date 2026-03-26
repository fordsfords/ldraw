# ldraw — Implementation Notes

## Purpose

A schematic drawing tool for logic circuits, primarily used for visual
troubleshooting during CPU design (hobby project — building a simple CPU
entirely from NAND gates in software simulation). The goal is to visually trace
signals through a working or broken circuit, not produce publication-quality
documentation.

## Background

I wrote a digital logic hardware simulator. As part of that, I have a simple circuit
definition language that defines components and the connections between
them. A circuit will be defined with this language in a text file with
the suffix ".lsim".

The ldraw program will:
1. Read a .lsim file and internalize the components and their interconnections.
1. Provide a drawing canvas.
1. Initially all components are "not placed" and all connections are "not made".
1. The tool allows me to select a "not placed" component and, using the mouse, place it on the canvas.
1. When one or more compoonents are placed, I can select a connection and, using the mouse, show the tool how I want the wire routed on the canvas.
1. At any time, the user can request an .svg file, which will match the drawing on the canvas.
1. The tool can also save its internal representation of the drawing to a ".ldraw" file.
Thus, at startup, you might first read a ".lsim" file, then read a ".ldraw" file.
The user then sees the drawing as it previously existed and can modify it and re-save it.
(The .lsim file is never modified or saved by this tool.)

Details of each function will be provided.

---

## Definitions

These terms will be use carefully and unambiguously in this document to mean only what is defined here.

* Component - a device created by a "d" command in a .lsim file.
* Connection - an association between a component output and a component input created by a "c" command in a .lsim file.
* Wire - an object created by ldraw. See (Data Model)[#data_model] below.
* Segment - an object created by ldraw. See (Data Model)[#data_model] below.
* Branch point - an object created by ldraw. See (Data Model)[#data_model] below.
* Upstream - the end of a segment that is graphically closer to the driving component's output.
* Downstream - the end of a segment that is graphically closer to the consuming components' inputs.

## Implementation Environment

A single self-contained `.html` file, opened directly in Chrome from the
local file system. No server, no build step, no installed dependencies.
External JS libraries may be loaded from CDNs.

All rendering, interaction, and application logic is in HTML, CSS, and
JavaScript within this single file.

### File I/O

Uses the browser's **File System Access API** (Chrome):

- **Read**: user selects a file via picker; app reads contents as text
- **Write**: user selects destination; app writes text content directly

### Constraints

- Chrome is the target browser
- No persistent storage between sessions; all state lives in memory
- All file paths chosen interactively via browser file pickers

---

## Input File Format

See `circuit-language-docs.md` for the full .lsim format. The drawing tool
parses only structural commands:

- `d` — Define device (creates a component with typed pins)
- `c` — Connect (single wire between one output pin and one input pin)
- `i` — Include (load and parse another file; must be handled recursively)

All other commands (`p`, `t`, `m`, `l`, `v`, `w`, `q`) are ignored.

Note that there is a `b` command for Bus (multi-bit connection).
For now ldraw will issue an error message if the .lsim file uses it.

Of the devices that can be defined, the `probe` is silently ignored — they are simulator debugging
tools with no schematic representation.

### Pin naming convention

Pin IDs are a letter followed by a number (e.g. `i0`, `q0`, `R0`).
**Upper-case letter = active-low (inverted) signal.**
Any pin whose ID starts with an upper-case letter automatically gets an
inversion bubble in the rendered symbol. This is the only mechanism that
produces bubbles — there is no per-device bubble specification.

---

## Data Model

### Components

Each parsed `d` command creates a component object:
- `type` — device type string (e.g. `nand`, `dflipflop`, `reg`)
- `name` — unique instance name
- `params` — type-specific parameters (e.g. numInputs, numBits, numAddr, numData)
- `position` — {x, y} on canvas (null until placed by user)
- `orientation` — 'right'|'left'|'up'|'down' (default 'right'; fixed-orientation devices ignore this)
- `geo` — cached geometry object, recomputed when position or orientation changes

### Wires

A "wire" is a line graph on the drawing that connects an output to one or
more inputs. A wire can be a single segment or a set of
segments joined by branch points, forming a binary tree of segments.
When an output must be connected to more than one input, the path must be
broken into multiple segments connected at "branch points", represented
visually as dots.
Each branch point has one upstream segment and two downstream segments.
The root of the tree is the output of a component and the leaves are
the inputs that it connects to.

A branch point is visually a "T" junction that can be in any of the 4
orientations. A branch point is created by splitting an existing segment
at a point along its path, producing two segments from the original plus
a new third segment for the branch.

Segments are allowed to cross without connection (a "+" junction visually).

#### Segment non-overlap rule

No two segments may share any portion of a collinear run: two horizontal
segments on the same Y must not share any X range, and two vertical segments
on the same X must not share any Y range. This applies across all wires,
not just within a single wire.

Additionally, every waypoint and branch point must have globally unique
coordinates — no two unconnected segment endpoints or waypoints may occupy
the same (x, y) position.

A wire is internally represented as:
- A reference to a component output (root of the tree)
- A binary tree of segments. Each node references a branch point.

A branch point contains references to the three segment ends that connect to it:
- upstream (toward the driving component's output).
- downstream A.
- downstream B.

A segment is an orthogonal polyline defined by an ordered list of waypoints;
each consecutive pair of waypoints forms one horizontal or vertical run.
A segment has two ends (upstream and downstream).
Each segment end connects to either a component output, a component input, or a branch point.
A segment also contains a reference to the wire that it is part of.

Each component's inputs and outputs contain references to the wire and segment end they connect to.

For this version of the tool, the creation of wires, segments, branch points, and way points are
created by user action, not generated automatically by the tool (no auto routing).

See "Named Nets" below for wires that are drawn differently. The underlying structure is the
same, but the visual representation is different.

During operation, a wire is created at an output pin of a component. It can be in an incomplete state,
meaning that it contains segments with "floating" downstream ends (not yet connected to any thing).
This is a normal state of affairs. A wire is termed complete when it fully represents the set of
connections made to that wire's component output.

### Connections

A connection is defined in the input .lsim file. It is not the same thing as a wire or a segment.
A completed wire will embody one or more connections. Specifically, a wire will embody all connections
made to a specific component output. The wire will be named "wire:<output-component-name>.<output-component-pin>".

### Component State

- **Placed** components: have an x,y position; geo is computed
- **Unplaced** components: parsed but not yet positioned; shown in a pending list

### Connection State

- **Unplaced** connections: are not represented by any wire.
- **Placed** connections: A wire connects to the output,input pair associated with the connection.

ldraw maintains a list of connections and components in the "unplaced" state.
- The user directly places components manually with a mouse.
- The user places connections indirectly by creating wires.
I.e. the user does not select a connection to work on it.
ldraw infers which connections are placed as the user adds segments to a wire and connects segments to inputs.

---

## Symbol Library

Each device type has three
functions: `xxxGeometry()`, `renderXxxCanvas()`, `renderXxxSVG()`.

### Architecture: geometry/render separation

- `xxxGeometry(ox, oy, name, ...params)` — computes all shape coordinates,
  label positions, and pin endpoints in canvas space. Returns a plain data
  structure. Pure function, no side effects.
- `renderXxxCanvas(ctx, geo, fg, mid, bg)` — consumes geometry, issues
  canvas 2D draw calls.
- `renderXxxSVG(geo, fg, mid, bg)` — consumes same geometry, returns SVG
  element strings. Identical visual output to canvas version.

This separation means geometry is computed once and reused for both
interactive canvas rendering and SVG export.

### Dispatch tables
`SYMBOL_FACTORIES`, `CANVAS_RENDERERS`, and `SVG_RENDERERS` are dictionaries
keyed by device type string. Use these for dispatch instead of switch
statements — makes adding new device types trivial.

### Shared helpers

- `_renderShapesCanvas(ctx, shapes, fg, bg)` — renders rect/circle/line/polygon/clockTriangle
- `_renderShapesSVG(shapes, fg, bg)` — same for SVG
- `_renderLabelsCanvas(ctx, labels, fg, mid)` — renders name and pin labels
- `_renderLabelsSVG(labels, fg, mid)` — same for SVG
- `_l2c(pivotX, pivotY, totalW, totalH, cos, sin, lx, ly)` — transforms
  local symbol coordinates to canvas space with rotation
- `_mirrorBoxGeo(geo, axisX)` — flips a geometry object horizontally
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
authoritative source for all component rendering details.

Key conventions enforced across all devices:

- A device's "natural" orientation has primary outputs pointing right.
  "fixed" = right only; "mirror" = right or left; "all 4" = right/left/up/down.
- `nand`, `led`, and `swtch` support all 4 orientations.
- Box devices (`clk`, `mem`, `srlatch`, `dflipflop`, `reg`, `panel`, `addword`, `addbit`) support mirror orientation.
- `gnd` and `vcc` are fixed orientation.
- Edge-triggered clock inputs use a `clockTriangle` shape instead of a pin label.

---

## Extensibility

New composite device types (all will be boxes) need only:
1. A geometry function (or reuse a generic box geometry helper — TBD)
2. Entries in `SYMBOL_FACTORIES`, `CANVAS_RENDERERS`, `SVG_RENDERERS`

No other code changes required.

---

## Named Nets

In standard EDA tools this is called "net labels". Some wires are not drawn
as routed lines but as named stubs — an arrowhead pointing at a label. Any
pin connecting to the same label name is logically wired, without a visible
routed wire.

- Any output can define a named net (e.g. clock's q0 → net "clock-q").
  Any input connecting to it renders as an arrow stub with that label.
- The named-net property belongs on the **wire**, not the device.
- Initially all wires are routed visibly. User can later mark a wire as a
  named net and assign a label string.
- No .lsim syntax for this — it is drawing-layer metadata only.
- The drawing save format must store named-net assignments alongside
  component positions and wire waypoints.

`gnd` and `vcc` receive no special treatment. They are ordinary components
that must be placed and wired like any other device. If their wires are
converted to named nets, consuming inputs render as arrow stubs with the
net label — the same mechanism used for all other named nets.

---

## Open Design Questions

These items were identified during review and need resolution.

### Wire-to-pin attachment

Each pin's geometry includes a connection point (the tip of its stub line,
stored in `pins[id] = {x, y}`). Wires attach at this point. The first
run of a wire leaving an output pin must travel in the direction the stub
points (away from the component body). Same constraint applies to the
last run arriving at an input pin.

### Grid and snapping

Not yet defined. For clean Manhattan routing, a snap-to-grid system is
almost certainly needed. Candidate: define a grid pitch (e.g. 10 px) and
snap all component positions, waypoints, and branch points to grid
intersections.

### Z-order / draw order

Not yet defined. Typical convention: wires drawn first, components on top.
Wire crossings shown with a small gap or bridge on the lower wire (or simply
drawn as a plain cross — TBD).

### .ldraw save format

Must store at minimum: component positions and orientations, wire trees
(segment waypoints, branch point locations, pin attachments), and
named-net assignments.

**Resolved:** Format is pretty-printed JSON. Schema not yet defined.

### SVG export scope

Not yet defined. Likely: export only placed components and their attached
wires (complete or incomplete). Unplaced components excluded.

### Include (`i`) command namespacing

The `i` command loads another .lsim file recursively. If two included files
define a device with the same name, is that an error? Are names prefixed
with the include path? This is an .lsim language question, but ldraw must
handle it correctly during parsing.

### Component repositioning

**Resolved:** Yes, placed components can be moved (left-click drag).
Attached segments remain in place but become floating (disconnected
from the moved component's pins). No rubber-banding — reconnection is
manual. Components can also be returned to the unplaced list via
right-click context menu; same breakage rules apply.

---

## User Interface

### Application Launch

Single self-contained HTML file opened in Chrome. URL parameters provide
hints for which files to load:

    ldraw.html?lsim=seq1.lsim&ldraw=seq1.ldraw

These hints are displayed to the user but cannot auto-open files (browser
security). The user confirms each file load via a picker dialog.

### File Loading

Two load operations at startup, both via File System Access API pickers:

1. **Load .lsim** (required) — parses circuit structure.
2. **Load .ldraw** (optional) — restores previous drawing state. If
   skipped, internal state initializes with all components and connections
   unplaced and no wires.

Drag-and-drop is also supported: user can drop one or both files onto
the canvas area. Files are distinguished by extension.

### Saving

Two independent save operations, each triggered separately:

- **Save .ldraw** — serializes drawing state (component positions,
  orientations, wire trees, named-net assignments). Format is
  pretty-printed JSON for human readability and diff-friendliness.
- **Export .svg** — exports current canvas as SVG.

These are deliberately not bundled. The user may save .ldraw frequently
while working and only export .svg occasionally, or vice versa.

### Typical Workflow

1. Launch tool, load .lsim, optionally load .ldraw.
2. Place components, route wires, edit drawing.
3. Save .ldraw and/or export .svg as desired.
4. Return to step 2 or close.

Relaunch later: load same .lsim + saved .ldraw → resume at step 2.

### Component Placement — Unplaced View

A button labeled "Unplaced" switches the canvas to a dedicated view
showing all unplaced components rendered with their symbols and names.
Components are displayed in the order they appear in the .lsim file
(or alphabetical if parse order isn't preserved). No filtering or
sorting controls in v1 — can be added later if needed.

The user clicks down on a component in this view. The mousedown:
- Grabs the component.
- Immediately repaints the canvas to the normal drawing view.
- The component appears as a ghost image attached to the cursor at
  the current mouse position (no spatial discontinuity — pointer
  stays in the same screen position across the repaint).
- Component is in default 'right' orientation during placement.
  Orientation is not changeable during the drag.
- User moves the ghost to the desired position and releases.
  The component is now placed.

This interaction is deliberately consistent with the move interaction
(see below).

### Component Context Menu (Right-Click)

Right-clicking a placed component opens a context menu with:

- **Orientation** — submenu with right / left / up / down. Options
  that are not supported by the device type are greyed out.
- **Unplace** — returns the component to the unplaced list.

### Component Movement

Left-click and hold on a placed component picks it up as a ghost image.
Drag to new position, release to place. Same visual feedback as initial
placement.

**Wire breakage on move:** If the component has segments attached to
its pins, those segments remain in place but their endpoints become
floating (disconnected from the pin). The wire topology is otherwise
preserved — only the attachment points to the moved component are
broken. Even if the component is moved back to its original position,
segments remain disconnected and must be manually reconnected.

This applies equally to Unplace — any attached segments become floating.

### Disconnected Segment Visual

A segment that is not connected to a component pin or branch point on
both ends is drawn in yellow (vs. the normal wire color). This provides
a clear visual indicator of "broken" wires that need attention.

### Click Interpretation

Left-click meaning depends on application state:

- **Unplaced view:** mousedown on a component grabs it for placement.
- **Normal drawing view, neutral mode:** left-click on a placed
  component picks it up for movement.
- **Wire routing mode (TBD):** left-click places waypoints or attaches
  to pins.

Care must be taken as wire routing is designed to ensure click targets
are unambiguous — clicking on a component vs. clicking on empty canvas
vs. clicking on a wire must be clearly distinguishable by context/state.

---

## Wire Routing (possible future)

- Initially: user specifies wire paths manually (click-to-place waypoints)
- Future: automatic orthogonal routing ("good enough," not optimal)
- Wires follow right-angle (Manhattan) paths
