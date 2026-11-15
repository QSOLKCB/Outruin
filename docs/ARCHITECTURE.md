# Engineering notes

## Runtime boundaries

`js/mod.js` owns validation and immutable content. `js/sim.js` owns the seeded 60 Hz state machine: road → foot → depot → road, then won/lost. Its world positions and updates use integer quantities; presentation never supplies elapsed wall time to gameplay. A valid run is bounded to 72,000 ticks (twenty simulation minutes).

`js/frame.js` adapts VANILLAJS `FixedClock` to the simulation, collects every tick's events, and aborts catch-up at a mode change. `js/input.js` normalizes keyboard, touch and gamepad state into a bitmask. `js/render.js` draws original procedural pseudo-3D roads and side-view scavenging. `js/sound.js` compiles original music into VANILLAJS PCM. `js/app.js` owns DOM, local preferences, lifecycle and downloads.

The replay owns its complete content pack. Applied mods are parsed, copied and deeply frozen before a new game starts. Scavenging rewards are single-use, successful shop/route choices are ordered at simulation tick boundaries, and UI preferences do not change the gameplay RNG.

## OPT contract: immutable presentation reuse

| Contract field | Target |
| --- | --- |
| Search space `X` | Rebuild sky/compile score on every request, or reuse exact immutable results |
| Feasible set `F` | Identical output under complete effective-input identity; bounded retained data |
| Objective `f`, direction `d` | Reduce repeat construction/compilation time; minimize |
| Correctness `C` | Cached/reference canvas pixels and PCM samples are equal; gameplay state is untouched |
| Budget `B` | At most eight 1280×720 RGBA sky layers (~28.1 MiB pixels), three score/browser-audio buffers; 5 timing rounds |
| Stopping rule `S` | Compare both correct paths on fixed fixtures; report measurements without automatic host tuning |

Sky identity is the immutable pack object and sector index at fixed canvas dimensions. A different pack clears the entire cache. Score identity is the immutable pack object, seed and arrangement. New pack/seed clears the cache; arrangement has three possible values. The browser buffer cache follows the same boundary. Presentation caches never persist partially completed work or skip simulation/tests.

Variables are categorical, search is local, timing is noisy, evaluation is cheap, there are semantic/resource constraints, execution is sequential, and exactness is required. Reference rendering remains selectable through the renderer's `reference` property; score reference calls `compileScore` directly. A parity failure is a defect, not permission to silently weaken equivalence. There is no inherited Lean proof or end-to-end performance claim.

## Offline packaging

`scripts/build.py` allowlists runtime HTML/CSS/JS, locally vendored modules, mod examples, icon and license/provenance files. README artwork, tests, screenshots, tooling and evidence are excluded from the site. The generated service worker uses the hash of every effective runtime file in its cache identity, namespaces caches by installation path, and only intercepts its own allowlisted GET paths. It never caches remote or arbitrary user requests.

Installation becomes active only after the full cache succeeds. Source changes make the integrity check fail until the worker is regenerated. Hosting under `/Outruin/` is supported; offline navigation preserves query-independent entry HTML while module URLs remain scope-relative.

## Provenance

VANILLAJS donor files are byte-identical to the recorded Git blobs and SHA-256 identities. `scripts/check.py` checks both. The frame lifecycle adaptation and perspective reference are attributed to STREET-RACER; the actual renderer and world are original. OPT supplies the reuse discipline. See `vendor/PROVENANCE.json` and `NOTICE`.
