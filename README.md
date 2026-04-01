# ldraw — logic circuit schematic drawing

A GUI tool for drawing logic circuit schematics. Companion to the
[lsim](https://github.com/fordsfords/lsim) hardware simulator.

WARNING: This was [vibe coded](https://en.wikipedia.org/wiki/Vibe_coding)
by me and Claude.ai, using the web interface, not Claude code.
I am not familiar enough with HTML-based javascript to properly review the code,
so it is here as-written and self-reviewed by Claude.
Fortunatley, it executes in a browser sandbox,
so even if it is buggy, it shouldn't be able to damage anything.

<!-- mdtoc-start -->
&bull; [ldraw — logic circuit schematic drawing](#ldraw--logic-circuit-schematic-drawing)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Quick Start](#quick-start)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Devices](#devices)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Wires](#wires)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Files](#files)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Log messages](#log-messages)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Status](#status)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [Internals](#internals)  
&nbsp;&nbsp;&nbsp;&nbsp;&bull; [License](#license)  
<!-- TOC created by '../mdtoc/mdtoc.pl README.md' (see https://github.com/fordsfords/mdtoc) -->
<!-- mdtoc-end -->

## Quick Start

Grab a copy of "lsim.html". Store it on your local file system (no server needed). Point Chrome browser at it.

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

The `netsource` and `netsink` are pseudo-devices that
implment "named nets" (basically invisible wires).
They do not correspond to devices in `lsim`.

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
- **`.svg`** — visual export for printing. *(Not yet implemented — Phase 6c.)*
- **`.lsim`** — circuit export for the lsim simulator. Export via context menu.

## Log messages

All user-visible messages are written to the log panel at the bottom of the
window. Each message is prefixed according to its severity:

| Prefix | Meaning |
|--------|---------|
| `Yep. ` | Operation succeeded |
| `Um. `  | Warning — operation succeeded but might not be what you want |
| `Yo! `  | Attention — operation succeeded but you need to see this (accompanied by a beep) |
| `Oops! ` | Error — operation failed (accompanied by a beep) |

## Status

Phases 1–6b are complete (device placement, editing, wiring with waypoints
and branch points, named net behaviour, `.lsim` export). Phase 6c (`.svg`
export) is not yet implemented. See [internals.md](internals.md) for
development details and future work.

## Internals

See [internals](internals.md).

## License

I want there to be NO barriers to using this code, so I am releasing it to the public domain.
But "public domain" does not have an internationally agreed upon definition, so I use CC0:

This work is dedicated to the public domain under CC0 1.0 Universal:
http://creativecommons.org/publicdomain/zero/1.0/

To the extent possible under law, Steven Ford has waived all copyright
and related or neighboring rights to this work. In other words, you can 
use this code for any purpose without any restrictions.
This work is published from: United States.
Project home: https://github.com/fordsfords/ldraw
