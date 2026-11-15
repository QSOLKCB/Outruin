# 0.2 — Road Reborn

The first version could slide sideways while parked, snapped between bend forces,
and drew the road shoulder outside the simulation's actual boundary. Road Reborn
changes the driving rules and rebuilds the chase view around a shared road frame.

## Driving and combat

- Steering now builds with forward speed, eases in and returns after release.
  Stationary steering turns the wheels without moving the vehicle sideways.
- Braking slows the car and improves lateral response. Dirt reduces grip and
  speed. Curves blend continuously between the existing authored bend values.
- The camera follows part of lateral motion while the vehicle visibly moves
  across the screen. Interpolation smooths presentation between 60 Hz ticks.
- Raiders weave into the road, then hold their lane while preparing to fire.
  Orange warnings precede visible rounds; shots aim at the player's launch-time
  position and can be dodged. The warning window is at most 42 active ticks,
  depending on the modded firing interval.
- Green brackets use the forward gun's actual range and alignment rules. Forward
  and side tracers, impact flashes and expanding explosions show shot results.

## Presentation and radio

The road uses perspective depth, continuous bends, reflective edge posts,
asphalt repairs, roadside wrecks, ruins, towers and signs. Vehicles have separate
body shapes, armour, roof guns, animated tyres, braking lights, boost exhaust and
shoulder dust. The HUD includes a 400 m road/traffic preview and speed display.
The active desktop layout gives more space to the game. Reduced-motion preference
suppresses the short camera shake from actual damage.

The original score now has four varied phrases per arrangement, sequenced through
unmodified VANILLAJS `modules/soundtrack` and `api/audio` at
`987c8d9be0af418307ea7cda05cbf56b5f130c71`. The default road loop is 16 seconds.
Pause resumes at the simulation tick, and WAV export includes the entire loop.
Audio failures cannot abort the render loop or overwrite the saved preference.

## Compatibility and limits

Existing `outruin.mod.v1` packs and input bindings still load. The same handling
fields now tune the new model. Gameplay changes require game version **0.2.0**:
old 0.1.0 replay records must use their original source. Current-version records
include the new handling and hostile projectiles and are replay-tested.

This remains a procedural Canvas arcade game. The work does not implement a
rigid-body vehicle simulator, multi-car garage, physical road forks or replay
viewer. Physical controllers and mobile hardware still need owner testing.

## Verification

See [validation](VALIDATION.md) and the source-bound receipts in
[`evidence/road-upgrade/`](evidence/road-upgrade/). The suite covers complete
default and example-pack campaigns, current replay parity, stationary/speed-based
steering, braking, shoulder alignment, attack travel and evasion, bounded storage,
soundtrack export, audio recovery, browser lifecycle, mobile layouts and offline
reload. Cached/reference rendering still matches exactly in all three biomes.
