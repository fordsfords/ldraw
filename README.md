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
Any pin whose id starts with upper-case automatically gets an inversion
bubble in the rendered symbol. Universal rule, no per-device specification.

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

A "wire" is line graph on the drawing that connects an output to one or
more inputs. A wire can be a single segment, which can change
directions by 90 degrees any number of times, or can be a set of
segments joined by branch points. So a wire is a binary tree of segments.
When an output must be connected to more than one input, the path must be
broken into multiple line segments, forming a binary tree of segments connected
at "branch points", represented visually as dots.
Each branch point has one upstream line segment and two downstream line segments.
The root of the tree is the output of a component and the leaves are
the inputs that it connects to.
Note that segments must not overlap. They are allowed to cross without connection (a "+" junction visually).
A branch point is visually a "T" junction that can be in any of the 4 orientations.

A wire is internally represented as:
- A reference to a component output (root of the tree)
- A binary tree of segments. Each node references a branch point.

A branch point contains references to the three segment ends that connect to it:
- upstream (toward the driving component's output).
- downstream A.
- downstream B.

A segment has two ends (upstream and downstream) and a list of waypoints for direction changes.
Each segment end connects to either a component output, a component input, or a branch point.
It also contains a reference to the wire that it's part of.

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

### Style globals

`SYM_FG`, `SYM_MID`, `SYM_BG` — set via `symSetColors(fg, mid, bg)` at
startup. Separate from CSS; used by both canvas and SVG renderers.

### Symbol shapes by type

A shape has a natural orientation. In general, the natural orientation tends to
have its inputs on the left side of the symbol and its outputs on the right side.
There can be some exceptions where inputs and outputs are assigned to the top
and/or bottom of a box-shaped component, but the natural orientation is still
defined. We call this orientation "right", not in the sense of it being correct,
but in the sense of its primary outputs pointing to the right.

Orientation can be "fixed" (right only), "mirror" (right or left), or "all 4".

| Device | Shape | Orientation |
|---|---|---|
| `nand` | IEEE curved body, inversion bubble on output | all 4 |
| `led` | Circle, input stub on left | all 4 |
| `swtch` | Circle, output stub on right | all 4 |
| `gnd` | Downward unfilled triangle, o0 at top | fixed |
| `vcc` | Upward unfilled triangle, o0 at bottom | fixed |
| `clk` | Box | fixed |
| `mem` | Box | fixed |
| `srlatch` | Box | fixed |
| `dflipflop` | Box | fixed |
| `reg` | Box | fixed |
| `panel` | Box | fixed |
| `addbit` | Box (= addword with numBits=1) | fixed |
| `addword` | Box | fixed |

### Pin layouts (box devices)

**clk**: R0 left (co-linear with Q0, bubble), q0 right upper, Q0 right lower (bubble)

**mem**: a0..an top edge, w0 bottom centered, i0..in left, o0..on right.
Box minimum size = 4 pins on each edge.

**srlatch**: S0 left upper (bubble), R0 left lower (bubble), q0 right upper, Q0 right lower (bubble)

**dflipflop**: S0 top centered (bubble), R0 bottom centered (bubble),
d0 left upper, c0 left lower (clock triangle, no label),
q0 right upper (co-linear with d0), Q0 right lower (bubble, co-linear with c0)

**reg**: c0 top centered (downward clock triangle, no label), R0 bottom
centered (bubble), d0..dn left, q0..qn right.
Note: Q outputs omitted by design — higher-level abstraction, use inverter
downstream if inverted output needed.

**panel**: i0..in left (LED inputs), o0..on right (switch outputs). No control pins.

**addword / addbit**: a0..an top, b0..bn left, o0..on right (sum, co-linear
with b), i0 bottom-left (carry in), o0_carry bottom-right (carry out).
addbit is addword with numBits=1. Carry chain flows bottom-to-bottom
when cascading adders left-to-right.

### Clock triangle

Edge-triggered clock inputs use a triangle symbol instead of a label:
- Left edge entry: triangle points right (into box) — `dir:'right'`
- Top edge entry: triangle points down (into box) — `dir:'down'`
Shape type `clockTriangle` is handled by both canvas and SVG shared renderers.

### NAND gate specifics

- Input count drives body height; pins evenly spaced on input edge
- 1-input NAND (inverter) uses same body shape
- Future: threshold (~5 inputs) above which fallback to labeled box with bubble

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

- `gnd` and `vcc` are special cases: each component that connects to them
  gets its own local triangle symbol rather than an arrow pointing to
  a net label.
- Any output can define a named net (e.g. clock's q0 → net "clock-q").
  Any input connecting to it renders as an arrow stub with that label.
- The named-net property belongs on the **wire**, not the device.
- Initially all wires are routed visibly. User can later mark a wire as a
  named net and assign a label string.
- No .lsim syntax for this — it is drawing-layer metadata only.
- The drawing save format must store named-net assignments alongside
  component positions and wire waypoints.

---

## User Interface

TBD

---

## Wire Routing (possible future)

- Initially: user specifies wire paths manually (click-to-place waypoints)
- Future: automatic orthogonal routing ("good enough," not optimal)
- Wires follow right-angle (Manhattan) paths
