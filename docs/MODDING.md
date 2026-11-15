# Outruin modding guide

A content pack is a complete JSON document with `kind: "outruin.mod.v1"`. There are no scripts, remote URLs, asset downloads or dynamic imports in a pack. Every field is required; unknown fields are rejected so spelling mistakes do not silently change a campaign.

## Edit and share

1. Open **WORKSHOP**. Choose a bundled example or export the active pack.
2. Change values in the full JSON editor, or use the quick fields and **UPDATE JSON**.
3. Choose **VALIDATE & APPLY**. This returns to the garage. Your next run uses the new immutable pack.
4. **EXPORT PACK** validates and downloads the editor contents. Share that file.
5. Another player chooses **IMPORT PACK**, inspects the editor, then applies it.

The editor's contents are a draft until applied. Loading an example or importing a file does not modify a running game. The last applied pack and input preferences are stored locally when storage is available. **LOAD ORIGINAL**, then **APPLY**, restores the base game. The raw examples are under `mods/`.

## Data map

| Section | Editable content | Units / rules |
| --- | --- | --- |
| `id`, `name`, `author`, `description` | Pack identity and garage text | IDs are lowercase letters/digits/hyphens; text is 1–180 characters |
| `vehicle` | Name, `body`, paint, top speed, acceleration, braking, coasting, steering, grip, offroad drag, armour, fuel, boost | Body: `interceptor`, `hauler`, `buggy`. Paint: six-digit hex |
| `weapons.forward` | Name, damage, interval, range, ammo cost | Range in mm; interval in ticks |
| `weapons.side` | Same for left/right guns | One shared side-gun cooldown; range measured along road |
| `weapons.foot` | Name, damage, interval, projectile lifetime, ammo cost | `range` is projectile lifetime in ticks; projectile speed is a source-level rule |
| `enemies` | Bike, buggy, truck and boss name, paint, health, speed, damage, firing interval, salvage, score | Existing archetypes are fixed by the engine; all supplied values are editable |
| `sectors` | 1–8 region records: IDs, names, lengths, sky/terrain colours, outpost sign | Length 600,000–10,000,000 mm; final sector contains the boss |
| `bends` | Authored signed bend sequence | 8–32 integer values from −7 to 7; each occupies 280 m; sector offset and route affect sampling |
| `difficulties` | Names, descriptions, damage multipliers, spawn spacing, fuel pressure, initial rounds | Keys are `drifter`, `survivor`, `wastelord`; percentages use 100 as baseline |
| `rules` | Fuel consumption factor, collision damage, boss spawn distance, enemy spawn distances, road supplies, stopping speed | Boss must appear before the final sector's finish |
| `foot` | Outpost width, walking speed, jump, enemies, supply positions, reward quantities | Width 800–6,000 pixels; entities must fit inside the outpost; at least one fuel crate |
| `shop` | Repair, fuel, ammo, engine and gun costs and benefits | Engine amount is percent extra top speed; gun amount is added forward damage |
| `music` | Track name, tempo, gain, wave, bass, scale and melody pattern | Four bass notes, eight scale frequencies, sixteen melody indices; integer Hz; 80–160 BPM |

The authoritative bounds and validation errors are in `js/mod.js`. Packs are limited to **64 KiB**, eight regions, sixteen supply crates and twelve foot enemies. Bounds prevent unbounded work and invalid states; they are not a promise that every valid combination is easy or winnable. Very weak weapons, long roads or high fuel burn can make a valid pack punishing.

### Handling units

The simulation ticks at 60 Hz. Road distance uses integer millimetres and speed uses millimetres per tick:

- `km/h = topSpeed × 0.216` — the default 1080 is about 233 km/h.
- `acceleration: 5` adds 5 mm/tick to speed each simulation tick while accelerating.
- `steering` is the target lateral speed in normalized road units per tick. Road edges are at −1000 and +1000.
- `grip` is how quickly lateral velocity approaches the steering target.
- `fuelCapacity: 100000` is 100 displayed fuel units. HUD percentages adapt to capacity.
- `interval: 8` permits a forward shot every eight simulation ticks while held, if ammunition remains.

A car's paint/body/handling live in its pack, so different packs can carry completely different vehicles. The initial garage does not have a separate multi-car inventory or downloadable sprite loader. Those are source extensions, not hidden advertised features.

### Build a new level

Copy a sector object in `sectors`, give it a unique ID, update its name, distance and palette, and choose an outpost sign. Reorder the array to reorder the campaign. Change `bends` for the road rhythm. Place `rules.bossAt` before the end of the final sector. The boss only appears in that final sector, including a one-sector campaign.

Routes are difficulty variants of the next sector: highway uses the normal bend sequence; canyon doubles it and increases patrol frequency. This milestone does not draw a physical fork or create an independent branching map graph.

### Write the radio

`music.scale` contains eight integer frequencies; `music.melody` chooses indices into that scale. `music.bass` contains four low frequencies. Supported melody waveforms are `saw`, `square`, and `triangle`.

The composer adds bass, percussion and kick lanes at absolute sample boundaries. Outpost and boss modes change arrangement and tempo within a bounded range. **EXPORT SOUNDTRACK WAV** renders the editor's road arrangement with the garage seed. The same pack and seed give the same reference PCM. Change the source composer for new instruments, channel counts or song forms.

## New mechanics and custom art

Content is deliberately separate from mechanics. Everything is open source, but JSON is not a programming language.

| Want to add… | Start here |
| --- | --- |
| Another enemy type or AI behaviour | `js/sim.js` spawning, damage and stepping; `js/mod.js` schema; `js/render.js` drawing |
| A new gun or damage rule | `js/sim.js` `roadShot` / `footTick`, input action map, schema and tests |
| Custom vehicle geometry or sprite loading | `js/render.js` `car`; preserve a local allowlisted asset path and add it to `scripts/build.py` |
| New route topology, missions or world interactions | `js/sim.js`, then the renderer and UI state transitions |
| Another soundtrack form or SFX timbre | `js/sound.js`; retain sample-range and cache parity tests |
| More controller actions | `js/config.js`, `js/input.js`, HTML controls, replay format and tests |
| A larger mod contract | Version the schema and update replay compatibility deliberately |

No executable mod plugins are run by the importer. Build a source fork for executable extensions. Preserve Apache-2.0 notices and donor provenance.

## Replays and versioning

A downloaded `outruin.replay.v1` record contains the game version, seed, difficulty, complete resolved pack, per-tick inputs and successful shop/route commands. `replay(record)` in `js/sim.js` reconstructs a run for tests and tools. The first milestone exports records; it does not yet provide an in-game replay viewer.

Reference repeatability is tested within the JavaScript runtime. Rendering, browser audio scheduling and physical devices are separate evidence scopes. Future changes that alter gameplay semantics must version the replay contract or retain the old implementation.
