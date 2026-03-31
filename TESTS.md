# ldraw Test Plan

Randomized coverage approach: each session, pick a few tests from each
section. Over time this covers everything without requiring a full pass
each release.

---

## 1. Device Placement

Pick a random device type for each test.

- [ ] **Basic place.** Add device → grab → drop on empty canvas. Check log
  confirms placement. Check device renders correctly.
- [ ] **Place with custom name.** Right-click tile → set name → grab → place.
  Verify custom name appears on device and in log.
- [ ] **Place with custom name that has numeric suffix.** E.g. name it "nand5"
  as the first nand. Place it. Then auto-place another nand. Verify the
  auto name doesn't collide (should skip to next available).
- [ ] **Overlap rejection.** Place two devices. Try to place a third
  overlapping one of them. Expect oops, device not placed.
- [ ] **Wire overlap rejection.** Create a wire. Try to place a device on
  top of it. Expect oops.
- [ ] **Buffer zone.** Place device A. Try to place device B so its body is
  one grid unit from A's pin tips. Expect oops (buffer zone interference).
- [ ] **Escape cancels.** Grab a device from selection view, press Escape
  before dropping. Device should not appear. Next auto-name should not
  have a gap.
- [ ] **Singleton enforcement.** Place clk. Try to place another clk.
  Expect oops. Same for vcc, gnd. Verify tiles are greyed out in
  selection view.
- [ ] **Orientation.** Right-click a tile → change orientation → grab →
  place. Verify the device renders in the chosen orientation.
- [ ] **Parameter change.** For nand: change numInputs. For reg/panel/addword:
  change numBits. For mem: change numAddr/numData. Verify the tile
  re-renders and the placed device has the right number of pins.

## 2. Device Move

Pick a random non-singleton device.

- [ ] **Basic move.** Drag device to new empty location. Log says moved.
- [ ] **Move to overlapping position.** Drag onto another device. Expect
  oops, device restored to original position.
- [ ] **Move onto wire.** Drag onto an existing wire segment. Expect oops,
  restored.
- [ ] **Null move.** Pick up device, drop it back at same position. No log
  message, no undo slot consumed. Verify Ctrl+Z doesn't undo a
  non-existent operation.
- [ ] **Escape cancels move.** Pick up device, press Escape. Device returns
  to original position. No undo slot consumed.
- [ ] **Move blocked by output wire.** Create a wire on device's output pin.
  Try to move the device. Expect oops, device stays put.
- [ ] **Move breaks input connections.** Connect wire from device A output
  to device B input. Move device B to a new valid position. Wire segment
  should turn yellow (floating). Log should mention broken connections.
- [ ] **Null move preserves connections.** Same setup as above. Pick up
  device B, drop it in place. Wire should remain connected (black).

## 3. Device Delete

- [ ] **Basic delete.** Right-click device → Delete. Device gone. Log
  confirms.
- [ ] **Delete blocked by output wire.** Create wire on device's output.
  Try to delete. Expect oops.
- [ ] **Delete breaks input connections.** Wire from A to B. Delete B.
  Wire segment should turn yellow. Log mentions broken connections.
- [ ] **Undo restores deleted device.** Delete a device, Ctrl+Z. Device
  reappears in original position.

## 4. Device Rename

- [ ] **Basic rename.** Right-click → type new name → Enter. Name updates
  on canvas. Log confirms.
- [ ] **Rename via OK button.** Same but click OK instead of Enter.
- [ ] **Duplicate name rejected.** Try to rename to an existing device's
  name. Expect oops.
- [ ] **Empty name rejected.** Clear the name field, press Enter. Expect
  oops.
- [ ] **Escape dismisses.** Right-click → start typing → Escape. Name
  unchanged.
- [ ] **Same name is no-op.** Right-click → don't change name → Enter.
  Menu dismisses, no undo slot.
- [ ] **Rename with wires.** Rename a device that has output wires and/or
  input connections. Save, reload. Verify wire connections survive
  (they reference device by name).

## 5. Wire Create

- [ ] **New wire on output pin.** Right-click output pin → New Wire. Small
  yellow segment appears extending one grid unit in pin direction. Dot
  at both ends.
- [ ] **Second wire on same pin rejected.** Create a wire, then right-click
  the same output pin. "New Wire" should not be visible (only "Delete Wire").
- [ ] **Only output pins.** Right-click an input pin. Should not show
  "New Wire". (Should show device context menu or nothing.)

## 6. Wire Extend

- [ ] **Extend floating end.** Left-click floating end of wire, drag to
  extend in its orientation. Release. Wire is longer, still yellow.
- [ ] **Contract wire.** Drag floating end back toward pin. Wire gets
  shorter. Minimum length is 1 grid unit.
- [ ] **Off-axis mouse.** While dragging, move mouse perpendicular to wire
  orientation. Wire should track only the on-axis coordinate.
- [ ] **Drop on device.** Extend wire into a device's buffer zone (not
  connecting to an input pin). Expect oops, wire snaps back.
- [ ] **Drop on another wire.** Extend wire to land on an existing wire
  segment. Expect oops, snaps back.
- [ ] **Escape cancels extend.** Start extending, press Escape. Wire
  returns to original length.

## 7. Wire Connect

- [ ] **Connect to colinear input pin.** Extend wire to an input pin that
  is colinear with the segment. Wire turns black during hover. Release.
  Wire stays black, dot appears at connection. Log confirms.
- [ ] **Non-colinear pin ignored.** Extend wire near an input pin that is
  not colinear. Wire should remain yellow, no connection preview.
- [ ] **Wrong direction ignored.** Wire going right, input pin facing right
  (not opposite). Should not connect.
- [ ] **Already-connected pin.** Try to connect to a pin that already has
  another wire. Should not offer connection.
- [ ] **One grid unit away from pin.** Drop the wire end one grid tick from
  an input pin (in the buffer zone but not on the pin). Expect oops
  (buffer zone interference), not a connection.

## 8. Wire Disconnect

- [ ] **Grab connected input pin.** Left-click on a connected input pin.
  Wire disconnects, enters extend mode. Wire turns yellow. If dropped
  back at same position, reconnects (turns black).
- [ ] **Grab and move elsewhere.** Disconnect by grabbing, extend to a
  different valid position. Drop as floating. Wire stays yellow at new
  position.
- [ ] **Grab, connect to different pin.** Disconnect from pin A, extend to
  pin B (colinear). Drop. Wire now connected to pin B.

## 9. Wire Delete

- [ ] **Delete via output pin menu.** Right-click output pin that has a
  wire → Delete Wire. Wire disappears. Log confirms.
- [ ] **Delete via floating end menu.** Right-click the floating end of a
  wire → Delete Wire.
- [ ] **Undo restores wire.** Delete wire, Ctrl+Z. Wire reappears.

## 10. Undo

- [ ] **Undo each operation type.** Place → undo. Move → undo. Delete →
  undo. Rename → undo. Wire create → undo. Wire extend → undo.
  Wire connect → undo. Wire disconnect → undo. Wire delete → undo.
  Each should fully restore previous state.
- [ ] **Deep undo.** Perform 5+ operations, undo all of them one by one.
  Canvas should return to original state.
- [ ] **Undo with broken connections.** Move a device (breaking input
  connections), then undo. Connections should be restored.
- [ ] **Empty undo stack.** Press Ctrl+Z with nothing to undo. Log says
  "Nothing to undo."
- [ ] **Ctrl+Z blocked during drag.** Start moving or extending, press
  Ctrl+Z. Nothing should happen (mode guard).

## 11. File Save/Load

- [ ] **Save and reload.** Place several devices and wires (some connected,
  some floating). Save. Reload the page. Load the file. Everything
  should appear exactly as saved.
- [ ] **Connected wires survive save/load.** Specifically verify that
  connected wire segments are still black (not yellow) after reload.
- [ ] **Auto-name counters after load.** Load a file with nand1 and nand3.
  Place a new nand. Should auto-name to nand2 or nand4 (not nand1 or
  nand3).
- [ ] **Dirty flag.** Make a change. Tab title should show asterisk. Save.
  Asterisk gone. Make another change. Try to close tab — browser should
  warn.
- [ ] **Load while dirty.** Make changes without saving. Right-click → Load.
  Confirm dialog should appear.
- [ ] **Drag-and-drop load.** Drag a .ldraw file onto the canvas. Should
  load. Try with a .txt file — expect oops.
- [ ] **Drag-and-drop blocked during operation.** Start moving a device,
  drop a file. Expect oops about operation in progress.

## 12. Canvas Navigation

- [ ] **Pan by drag.** Left-click empty canvas, drag. Canvas scrolls.
- [ ] **Pan to coordinates.** Right-click → Pan to x,y. Enter coordinates.
  Verify the origin crosshair moves to expected screen position.
- [ ] **Grid renders correctly.** Fine dots at 10px pitch, major lines at
  100px pitch. Origin crosshair visible.

## 13. Selection View

- [ ] **Enter and exit.** Right-click → Add device. Selection view appears
  with header. Press Escape. Returns to canvas.
- [ ] **Right-click exits.** In selection view, right-click background.
  Returns to canvas.
- [ ] **Scroll.** If enough device types to overflow, mouse wheel scrolls
  the grid.
- [ ] **Parameter persistence.** Configure a device type (e.g. 4-input nand).
  Exit selection view. Re-enter. Tile should still show 4-input nand.

## 14. Edge Cases

- [ ] **Rapid operations.** Place, move, wire, connect, undo rapidly. No
  state corruption, no console errors.
- [ ] **All orientations.** For a 4-orientation device (nand, led, swtch,
  netsource, netsink): place one in each orientation. Verify pins are
  accessible and wires can connect in all directions.
- [ ] **Large nand.** Place a 16-input nand. Verify all input pins are
  reachable and properly spaced.
- [ ] **Net source/sink.** Place netsource (has input pin only) and netsink
  (has output pin only). Verify wire can be created on netsink's output
  and connected to netsource's input.

## 15. Named Nets (Phase 5)

### 15.1 Name Sharing and Collision Rules

- [ ] **Netsink shares netsource name.** Place a netsource, rename it to
  "clk". Place a netsink, rename it to "clk". Should succeed — no
  collision error.
- [ ] **Multiple netsinks share name.** Place netsource "clk". Place three
  netsinks, all named "clk". All should succeed.
- [ ] **Second netsource blocked.** Place netsource "clk". Place another
  netsource, try to rename it to "clk". Should get "already in use" error.
- [ ] **Net name vs non-net collision.** Place a nand named "foo". Place a
  netsource, try to rename it to "foo". Should get "already in use".
  Similarly try a netsink named "foo" — should also be blocked.
- [ ] **Non-net vs net name collision.** Place netsource "bar". Place a
  nand, try to rename it to "bar". Should get "already in use".
- [ ] **Netsource name at placement.** In param editor, set netsource name
  to an existing non-net device name. Grab and place — should get "already
  in use" and block placement.

### 15.2 Auto-naming UX

- [ ] **Netsink defaults to last net name.** Place netsource (auto-named
  "netsource1"). Place netsink — should auto-name "netsource1" (matching
  the last net device placed).
- [ ] **Name tracks across placements.** Sequence: place netsource "A",
  place netsink (defaults to "A"), place netsource "B", place netsink
  (defaults to "B"), place another netsink but override to "A" via param
  editor, place another netsink (defaults to "A"). Verify all names.
- [ ] **Param editor shows last net name.** Place netsource "clk".
  Right-click netsink tile in selection view. Name field should show "clk".
- [ ] **Fresh session has no default.** Before placing any net device, place
  a netsink. Should get standard auto-name ("netsink1"), not a net default.

### 15.3 Cascade Rename

- [ ] **Rename netsource cascades.** Place netsource "X", place two
  netsinks "X". Rename the netsource to "Y". Both netsinks should now
  be named "Y". Log should mention sink count.
- [ ] **Rename netsink does not cascade.** Place netsource "X", place two
  netsinks "X". Rename one netsink to "Z". Only that sink changes. The
  other sink and the netsource keep name "X".
- [ ] **Cascade undo.** After cascade rename, press Ctrl+Z once. All
  devices (netsource + netsinks) should revert to old name in one step.
- [ ] **Cascade updates wires.** Place netsource "X" with a wire on its
  input. Place netsink "X" with a wire on its output. Rename netsource
  to "Y". Save, reload. Verify wires still connected (wire device
  references were updated).

### 15.4 Color Rendering

- [ ] **Orphan netsink is red.** Place a netsink named "clk" with no
  matching netsource on canvas. Entire device (body, stub, label) should
  render red.
- [ ] **Netsink turns black.** Place netsink "clk" (red). Now place
  netsource, rename to "clk". Netsink should turn black.
- [ ] **Unconnected netsource is yellow.** Place a netsource (no wire on
  its input). Entire device should render yellow.
- [ ] **Netsource turns black on connect.** Wire a vcc output to the
  netsource's input. Netsource should turn black.
- [ ] **Netsource turns yellow on disconnect.** Disconnect the wire from
  the netsource's input (grab segment end and pull away, or delete wire).
  Netsource should turn yellow again.
- [ ] **Delete netsource turns sinks red.** Place netsource "clk"
  connected to vcc. Place two netsinks "clk" (both black). Delete the
  netsource. Both netsinks should turn red.
- [ ] **Move netsource turns it yellow.** Place netsource with wire on
  input. Move it (input wire disconnects). Should turn yellow.
- [ ] **Normal devices unaffected.** Verify nand, led, etc. still render
  in standard colour after Phase 5 changes.

### 15.5 Wire Disambiguation (Shared-Name Devices)

- [ ] **Two netsinks, independent wires.** Place netsource "X". Place two
  netsinks "X" at different positions. Add wire to first netsink's output,
  connect to a device. Add wire to second netsink's output, connect to
  another device. Both wires should render correctly from their respective
  netsinks.
- [ ] **Context menu on second netsink.** After the above, right-click the
  second netsink's output pin. Context menu should show "New wire" (not
  "Delete wire" from the first netsink's wire). If the second netsink
  already has a wire, it should show the correct wire's options.
- [ ] **Delete wire on correct netsink.** With two wired netsinks "X",
  delete the first netsink's wire. Second netsink's wire should remain.
- [ ] **Delete netsink with wire.** Delete one netsink that has an output
  wire — should be blocked ("has a connected output"). The other
  same-named netsink should not be affected.
- [ ] **Rename one of two wired netsinks.** Two netsinks "X" with wires.
  Rename one to "Y". Only that netsink's wire reference should update.
  Save, reload. Both wires should still connect to the correct devices.
- [ ] **Save/load round-trip.** Create the two-netsink-with-wires scenario.
  Save. Reload. Both wires should render from the correct netsink
  positions. Right-click each netsink's pin — context menu should show
  the correct wire state.
