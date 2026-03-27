# updates.md — README delta notes

## Phase 1 changes that might require README updates.

### addword pin ID fix
The original addword geometry used `o${i}` for sum output pins and `o0_carry`
for carry out. The lsim spec defines sum outputs as `s0`-`sn` and carry out
as `o0`. Updated pin IDs to match the spec:
- Right-side outputs: `o${i}` → `s${i}`
- Carry out: `o0_carry` → `o0`
- Pin labels changed from `i`/`c` to `ci`/`co` for clarity.

### Pin-to-grid alignment (known issue)
The geometry functions use STUB=18 for pin stub lengths. With ox/oy snapped
to grid (multiples of 20), pin tips generally do NOT land exactly on grid
points. This is acceptable for Phase 1 (no wires) but will need to be
resolved before Phase 3 (wire connections). Options:
1. Change STUB to a value that makes pins land on grid (requires reworking
   several geometry functions, especially those with bubbles where the
   effective stub is STUB + 2*BUBBLE).
2. Snap placement based on a reference pin rather than ox/oy.
3. Accept off-grid pins and have wire endpoints snap to pin positions
   rather than grid positions.

### .ldraw JSON schema (Phase 1, devices only)
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
Position (x, y) is the (ox, oy) parameter passed to the geometry function.
Name counters are reconstructed on load by scanning existing device names.

### Selection view
Added device selection view (Add function). Shows all 15 device types in a
dynamic grid. Left-click grabs for placement, right-click opens parameter
editor (orientation + size params). Parameters are remembered per type
within a session. Clock device is greyed out if one already exists.

### Phase 1 scope delivered
- Canvas with grid dots and major grid lines, origin crosshair
- Pan via left-click drag on empty canvas
- Open canvas context menu with "add, load, save, pan, redraw". Pan prompts for numeric x,y input.
- Add function → selection view → grab device → ghost follows cursor → drop to place
- Snap to grid (ox/oy to nearest PIN_SPACE multiple)
- Interference detection with pin buffer zones (2-unit buffer on edges with pins)
- Auto-naming (type + incrementing counter)
- Save/Load .ldraw (File System Access API + drag-and-drop)
- URL parameter hint display
- Escape to cancel placement or exit selection view
- Text box across bottom logging for placement errors

## Next Steps

1. There is a status line at the top. Right now it says "Ready. Right-click canvas to add devices or load a file".
   I think it is not required, but I'm willing to be convinced otherwise.
2. The "new device" grid is good. But it extends past the bottom of the visible canvas and cannot be panned or scrolled.
   In this case, scroll bars would be the most natural way to select them.
3. The grid spacing is too large. For example, the inputs on a 2-input NAND are too far apart.
   Is there a single constant/variable that controls it?
   Is it something that could be changed at runtime via the canvas context menu?
   Or does a change require code mods?
4. Vcc and gnd devices do not need their names included.
5. New requirement: vcc and gnd are singletons, like clk.
   Grey them from new device grid if there's already one defined.
6. Netsource appears as diamond. Should be an arrow with shaft as stub.
7. Move clk R input to bottom.
8. Make 1-input NAND the same size as 2-input NAND. I.e. 2-input NAND is the floor size.
