# ldraw — logic circuit schematic drawing

A GUI tool for drawing logic circuit schematics. Companion to the
[lsim](https://github.com/fordsfords/lsim) hardware simulator.

Open `ldraw.html` in Chrome. No server, no build step, no dependencies.

## Quick Start

Right-click on empty canvas to access drawing commands: add devices, load/save
files, pan to coordinates, undo.

Right-click on a device for rename and delete. Right-click on an output pin
for wire operations. Right-click on a wire's floating end or waypoint for
wire routing operations.

Drag and drop a `.ldraw` file onto the canvas to load it.

Ctrl+Z (Cmd+Z on Mac) to undo. Escape to cancel any in-progress operation.

An asterisk in the browser tab title indicates unsaved changes.

## Devices

| Type | Label | Orientations | Singleton | Configurable |
|------|-------|-------------|-----------|--------------|
| `nand` | NAND | all 4 | — | number of inputs (1–16) |
| `led` | LED | all 4 | — | — |
| `swtch` | Switch | all 4 | — | — |
| `gnd` | GND | fixed | yes | — |
| `vcc` | VCC | fixed | yes | — |
| `clk` | Clock | right/left | yes | — |
| `mem` | Memory | right/left | — | address bits, data bits |
| `srlatch` | SR Latch | right/left | — | — |
| `dflipflop` | D Flip-Flop | right/left | — | — |
| `reg` | Register | right/left | — | bit width |
| `panel` | Panel | right/left | — | bit width |
| `addbit` | 1-bit Adder | right/left | — | — |
| `addword` | N-bit Adder | right/left | — | bit width |
| `netsource` | Net Source | all 4 | — | — |
| `netsink` | Net Sink | all 4 | — | — |

Singleton devices can only appear once on the canvas.

## Wires

Wires connect a device output pin to one or more device input pins.
A wire is a binary tree of segments joined by waypoints (turns) and
branch points (fan-out). Floating (unconnected) segment ends are drawn
in yellow; connected segments are black.

A wire is created from an output pin's context menu and routed by extending
segments and adding waypoints or branch points. Wire segments are
axis-locked (horizontal or vertical only). While dragging a segment end,
a faint crosshair shows its current position for alignment.

## Files

- **`.ldraw`** — the master drawing format (JSON). Load and save via context menu.
- **`.svg`** — visual export for printing. *(Not yet implemented.)*
- **`.lsim`** — circuit export for the lsim simulator. *(Not yet implemented.)*

## Status

Phases 1–5 are complete (device placement, editing, wiring with waypoints
and branch points, named net behaviour). See [internals.md](internals.md) for development details.
