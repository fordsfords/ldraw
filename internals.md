# ldraw Internals

Maintainer reference for the ldraw logic circuit schematic drawing tool.
For end-user documentation, see [README.md](README.md).

---

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
  One upstream segment, two downstream segments. *(Phase 4b.)*
* **Upstream** — the direction toward the driving device's output pin.
* **Downstream** — the direction toward the consuming device's input pins.
* **Fine grid** (`PIN_SPACE = 10`) — the snap granularity. All positions
  snap to this pitch. Canvas coordinates map 1:1 to CSS pixels at the
  default transform.
* **Pin pitch** (`PIN_PITCH = 20`) — minimum spacing between pins on a
  device (2 fine-grid steps).
* **Interfere** — overlap or touch between objects in a disallowed way.
  Current interference rules (most were removed in Phase 4a):
  - Two wire segments from different wires cannot share any portion of a
    collinear run.
  - All other overlap (device-device, device-wire, etc.) is the user's
    responsibility.
* **Oops** — an error message in the log panel, prefixed with "Oops!"
  and accompanied by an audible beep.

---

## Implementation Environment

A single self-contained `.html` file, opened directly in Chrome from the
local file system. No server, no build step, no installed dependencies.
External JS libraries may be loaded from CDNs.

### File I/O

Uses the browser's File System Access API (Chrome):

* **Read**: user selects a file via picker or drags and drops onto canvas.
* **Write**: user selects destination via picker on first save; subsequent
  saves reuse the writable handle obtained from the save picker (read-only
  handles from the open picker are not reused for writing, as `file://`
  does not permit it).

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
* Error messages in the log panel prefixed with "Oops! ". Informational
  messages appear without beep.
* Debug output goes to `console.log`.

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

*(Phase 6 — not yet implemented.)*

See `circuit-language-docs.md` for the full format. The drawing tool will
generate only structural commands: `d` (define device) and `c` (connect).

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
* `branchPoints[]` — flat array of `{id, x, y}` objects (Phase 4b).

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
Placeable as normal devices. When generating `.lsim` output (Phase 6),
like-named net pairs are treated as direct wire connections (`c` commands)
rather than devices. Net devices share names (enforced by
`isNameAvailable`). Cascade rename, orphan detection, and colour
rendering are implemented in Phase 5.

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

Singleton devices are greyed out in the selection view once one exists.
`gnd` and `vcc` do not display their instance name.

Per-device pin assignments and geometry notes are documented in block
comments above each geometry function in `ldraw.html`.

### Extensibility

New box-style device types need only:
1. A geometry function following existing conventions.
2. Entries in `SYMBOL_FACTORIES`, `CANVAS_RENDERERS`, `SVG_RENDERERS`.
3. An entry in `DEVICE_DEFS` (label, defaultParams, orientations, paramSpecs).

No other code changes required.

---

## Design Decisions

**Interference checking (simplified in Phase 4a).** Most interference
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
dirty indicator, and hash; right side shows pan coordinates.
Painted in screen space after resetting the canvas transform — no effect
on the drawing coordinate system or hit testing.

**Action-only context menus.** Context menus contain only action items
(no inline edit fields). Editing operations (rename, drawing name) open
separate durable modal dialogs with OK/Cancel. This avoids mixed-mode
problems (e.g. editing a name then clicking "delete" in the same menu).

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
implemented. Losing detail forces the user to dig through git history,
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
devices share names (Phase 5). For `downstream.dev` lookups, verifying
the pin exists in `device.geo.pins` suffices (cross-type disambiguation).
For `srcDev` lookups, same-type devices (e.g. two netsinks) also need
position matching via `wireSrcMatchesDev`. New code that resolves a
device from wire references must follow this pattern — see the Phase 5
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

### Phase 4b — Branch Points ✓

Branch points enable fan-out: one output driving multiple inputs via a
binary tree of segments. A branch point has one upstream segment and two
downstream segments.

**Terminology note:** The original requirements used "break point" in
places. The correct term is "branch point" throughout.

**Status:** Complete. File version incremented to 3 (reads 2 and 3).

#### Append Branch Point

Right-click on the floating end of a leaf segment. Context menu includes
"Branch point ▸". Hovering shows four T-junction orientations graphically.
The orientation that does not connect to the upstream segment is greyed out.
Selecting one inserts the branch point and appends two 1-grid-unit segments
in the chosen directions.

The previously-floating segment turns black. Both new segments are yellow.

Remember to do the appropriate escape and undo processing.

#### Delete Branch Point

Right-click on a branch point → "Delete branch point". Deletes the branch
point and all downstream elements (segments, waypoints, branch points).
May result in disconnections from device inputs. The upstream segment
becomes floating (yellow).

#### Branch Point Insertion (mid-segment)

Right-click on a wire segment (not at its ends) → "Branch point ▸".
Shows 4 T-orientations; the two that don't connect to the existing
segments are greyed out. Selecting one splits the segment into two
at the click point and creates a new 1-grid-unit segment in the chosen
direction.

This requires a new hit-test for clicking on wire segment bodies
(not just endpoints).

#### Branch Point Save/Restore

Branch point data must be saved/restored in `.ldraw` files. The wire's
`branchPoints` array (currently always empty) will be populated.
If data model changes are needed, increment the version number.

#### Implementation notes for 4b

The `collectDownstream` function (added in 4a) was rewritten to walk the
binary tree structure recursively. It now takes `(wire, nodeType, nodeId)`
where `nodeType` is `'waypoint'` or `'branchpoint'`, and returns
`{wpIds, bpIds, segIds}`.

Key new functions: `addBranchPointAtEnd`, `addBranchPointMidSegment`,
`deleteBranchPoint`, `hitTestBranchPoint`, `hitTestSegmentBody`,
`findSegsByUpstreamBp`, `findSegByDownstreamBp`.

T-junction orientations are defined in `T_JUNCTIONS` with four keys:
`tr` (├), `tl` (┤), `tu` (┴), `td` (┬). Each maps to three directions.
Menu items show only the box-drawing glyph; direction arrows were removed
to reduce clutter.

The `checkSegmentInterference` function only checks collinear overlap
with other wires' segments. This remains unchanged for branch points.

---

### Phase 4c — Misc ✓

**Status:** Complete. File version incremented to 4 (reads 2–4).

#### Drawing Name

A drawing has a name stored in `state.drawingName`, initialized to
"unnamed". Right-clicking on the empty pane of normal view includes a
menu item "Rename drawing…" that opens a durable modal dialog with
OK/Cancel. The name is saved in the `.ldraw` file and restored on load
(defaults to "unnamed" for older files). Drawing name changes are
included in undo snapshots.

#### Drawing Hash

A djb2 hash of the serialized drawing state, stored in
`state.drawingHash`. Recalculated every time `setDirty()` or
`clearDirty()` fires. Displayed as 8-digit uppercase hex in the status
line.

#### Status Line

The normal view has a white status bar at the top of the canvas
displaying: drawing name, dirty indicator (`*`), hash, and mode ("normal")
left-justified; pan coordinates right-justified. The selection view
header is unchanged.

#### Explicit Commit Model

All popups and dialogs use OK/Cancel buttons, are durable (not dismissed
by clicking outside), and treat Escape as Cancel.

Context menus are action-only — no inline edit fields. The device context
menu has a "Rename device…" action that opens a separate modal dialog.
The selection-view parameter editor has OK/Cancel buttons; values are
committed on OK (fixes the typed-name-without-Enter issue from the
previous auto-apply-on-change design).

#### Save Improvements

The save picker suggests the drawing name plus `.ldraw` as the default
filename when no prior save name exists (e.g. a drawing named "sr-latch"
suggests "sr-latch.ldraw"). The last saved filename is persisted to
`localStorage` so it survives page reloads.

#### Bug Fix

The branch point submenu (`ctx-pin-bp-row`) was a sibling of the pin
context menu div (`ctxPin`) instead of a child, causing it to appear
in all context menus (e.g. the device context menu). Moved inside
`ctxPin`.

---

### Phase 5 — Named Nets ✓

Cascade rename, orphan detection, red/yellow rendering for net device
status. No file version increment (runtime behaviour only).

**Status:** Complete.

#### Concept

`netsource` and `netsink` are pseudo devices with a single pin each.
A netsource has an input pin (`i0`) — it receives a signal (e.g. from
vcc, gnd, clk) and forwards it to the "named net". A netsink has an
output pin (`o0`) — it delivers the net's signal to a destination
device's input. Conceptually, a named net is like a branch point with
any number of downstream legs.

When generating `.lsim` output (Phase 6), like-named net pairs are
treated as direct wire connections (`c` commands) rather than devices.

#### Name Sharing and Collision Rules

Unlike other device types, net devices are designed to share names:
all devices belonging to the same net share one name.

`isNameAvailable(name, forType)` enforces type-specific rules:

* **netsource**: name must not collide with any non-net device or any
  other netsource. May match netsinks (that is the intended usage).
* **netsink**: name must not collide with any non-net device. May match
  netsources and other netsinks.
* **all other types**: name must not collide with any device at all
  (original behaviour unchanged).

A net can have at most one netsource. This falls out of the collision
rule: a second netsource with the same name is rejected.

#### Auto-naming UX

When creating a **netsource**, the name is auto-generated in the
standard way (`netsource1`, `netsource2`, …). The user typically
renames it (e.g. `clk_net`) via the parameter editor before or after
placement.

When creating a **netsink**, the name defaults to `state.lastNetName`
— the name of the most recently placed or renamed net device (source
or sink). This means placing one netsource and then several netsinks
gives them all the same name without manual renaming. The user can
override the name in the parameter editor at any time; subsequent
netsink placements then default to the overridden name.

`lastNetName` is a transient UI hint — not saved in the file or in
undo snapshots.

#### Cascade Rename

Renaming a **netsource** cascades to all netsinks that currently share
the old name. The collision check uses the netsource's rules (must
clear non-net devices and other netsources). Since the netsink rules
are a subset, cascaded sinks are guaranteed safe. A single `pushUndo`
before the cascade makes the entire operation one undo step.

Renaming a **netsink** applies to that device only (no cascade). The
netsink's color may change depending on whether the new name matches
an existing netsource.

#### Color Rendering

Computed at render time by `netDeviceColor(d)`:

* **netsink** — drawn in **red** (`NET_ORPHAN`) if no netsource shares
  its name. Normal colour otherwise.
* **netsource** — drawn in **yellow** (`NET_NOSRC`) if nothing is
  connected to its `i0` input pin (`findWireAtInput` returns null).
  Normal colour otherwise.

The entire device (body, stubs, name label) takes the computed colour.
Placing/moving ghosts use standard colours.

Deleting a netsource causes all same-named netsinks to turn red
automatically (no special delete handler needed — the render-time
scan handles it).

#### Wire Reference Disambiguation

Wire objects reference source devices by name (`srcDev`) and pin
(`srcPin`). Before Phase 5, device names were unique, so name alone
was sufficient. With net devices sharing names, two levels of
disambiguation are needed:

**Level 1 — pin existence.** Different device types sharing a name
(netsource vs netsink) are resolved by checking that the referenced
pin exists in the device's `geo.pins` dictionary. Since netsource has
only `i0` and netsink has only `o0`, this always resolves cross-type
ambiguity. Used for `downstream.dev` lookups and `disconnectInputWires`.

**Level 2 — source device position.** Same-type devices sharing a name
(two netsinks both named "clk", both with pin `o0`) require position
matching. Wires store `srcDevX`/`srcDevY` — the source device's
position at wire creation time. Since devices with output wires cannot
be moved, these remain valid for the wire's lifetime. The central
helper `wireSrcMatchesDev(wire, device)` checks name + pin + position.
Used by `findWireByOutput`, `getWireOrigin`, `deviceHasOutputWire`,
`renameDevice`, and the context-menu wire-end handler.

**Backward compatibility.** `srcDevX`/`srcDevY` are optional in the
file format (no version bump). Old files have unique device names, so
when these fields are absent, `wireSrcMatchesDev` falls back to
name + pin matching, which is unambiguous for unique names.

---

### Phase 6 — Export

`.lsim` generation and `.svg` export.

#### .lsim

See `circuit-language-docs.md` for
the `.lsim` format. However, please ensure that this file is not
checked into the repo - it belongs to the lsim project.
However, do suggest changes to it that would not burden lsim
but which would assist ldraw.

#### .svg

The SVG viewBox is bounded by the outermost device
and wire bounding boxes plus a 2-unit margin.

#### Misc

1. Make vcc and gnd triangles smaller, maybe half their current size.
And include the device name on the side opposite the wire pin.
Since these devices cannot be re-oriented, the gnd dev name will be below the triangle,
and the vcc dev name will be above it.

2. Make netsource and netsink arrows smaller, maybe half their current sizes.

3. Since "save" will now re-save to the same name without a prompt,
we need an additional menu item for the main canvas context menu:
"Save as...". This should always prompt.

---

### Phase Infinity - Far Future, Probably Never

1. Relax the "you may not move a device if it has an output wire" rule.
Moving a device with connected outputs will disconnect the ends of the output
wires to the devices they connect to, but the output wire remains connected
to the device being moved. The device and output wires move together.
Wire segments, way points, and branch points should all translate as a group.
Ideally the whole sub-drawing would be ghosted (device and output wires),
but it would be acceptable if only the device is ghosted.

2. Draw an irregular selection line around a set of interconnected devices and move them as a group.
Normally, a device with an output wire may not be moved. However, if that output
wire is connected to inputs that are part of the group move, then allow it.
Note that this introduces the concept of a device being "selected".
Clicking empty canvas de-selects. Clicking a selected device allows dragging the group.
Ideally, the whole sub-drawing would be ghosted (all devices and output wires),
but it would be acceptable if only the device grabbed is ghosted.
This feature also raises questions about what constitutes selecting a device.
If I draw an irregular selection line that passes through the middle of a device, does that select it?
Or does it have to be completely within? If my irregular line does not close, how do you determine
the "inside" vs "outside" of the figure? (Maybe draw a straight line from the starting point to the
end point?)
