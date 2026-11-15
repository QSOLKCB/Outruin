# Engineering notes

## Runtime boundaries

`js/mod.js` owns validation and immutable content. `js/sim.js` owns the seeded 60 Hz state machine: road → foot → depot → road, then won/lost. Forward distance and speed use integer quantities. `js/driving.js` uses bounded floating-point curvature and lateral motion, quantising lateral position and velocity to 0.001 road units after each tick. Raider weaving and shot aiming also use floating point. Repeatability is tested in the same runtime; no cross-browser floating-point identity is claimed. A valid run is bounded to 72,000 ticks (twenty simulation minutes).

`js/frame.js` adapts VANILLAJS `FixedClock` to the simulation, collects every tick's events, and aborts catch-up at a mode change. `js/input.js` normalizes keyboard, touch and gamepad state into a bitmask. `js/render.js` draws original procedural pseudo-3D roads and side-view scavenging. `js/radio.js` and `js/sfx.js` compile original music/effects into VANILLAJS PCM; `js/sound.js` owns Web Audio playback. `js/app.js` owns DOM, local preferences, lifecycle and downloads.

The frame adapter retains a previous presentation pose outside simulation state. Render interpolation cannot modify journals, commands or the simulation snapshot. The renderer's road edges and player projection use the same ±1000 road units as the shoulder rule. The player retains 40% of lateral movement on screen while 60% moves the camera. This is an arcade road model, not a rigid-body or tyre simulation.

Enemy shots use a bounded array (48 maximum), fixed tick lifetime, launch-time aim and a swept forward crossing check. Their visible 42-tick warning window is limited by the authored firing interval if that interval is shorter. Player guns remain hitscan with six-tick visual tracers. Outpost/route transitions clear road fire. All these fields are replayed under game version 0.2.0; version 0.1.0 records are rejected explicitly.

The replay owns its complete content pack. Applied mods are parsed, copied and deeply frozen before a new game starts. Scavenging rewards are single-use, successful shop/route choices are ordered at simulation tick boundaries, and UI preferences do not change the gameplay RNG.

`js/display.js` owns the top-bar display selector and native fullscreen lifecycle.
The fitted layout reserves space for the toolbar, telemetry, touch controls and
mission text, then contains the fixed 1280×720 canvas in the remaining area. It
never changes canvas coordinates or simulation state. Mode changes clear inputs
and pause active gameplay. Only the windowed preference is persisted; native
fullscreen is requested from a user gesture, reflects `fullscreenchange`, and
falls back to the fitted layout if unavailable. Menus scroll within the game
region when a short screen cannot contain their contents.

## OPT contract: immutable presentation reuse

| Contract field | Target |
| --- | --- |
| Search space `X` | Rebuild sky/compile score on every request, or reuse exact immutable results |
| Feasible set `F` | Identical output under complete effective-input identity; bounded retained data |
| Objective `f`, direction `d` | Reduce repeat construction/compilation time; minimize |
| Correctness `C` | Cached/reference canvas pixels and PCM samples are equal; gameplay state is untouched |
| Budget `B` | At most eight 1280×720 RGBA sky layers (~28.1 MiB pixels), five eight-phrase score objects, eight active-score PCM buffers, 64 effect/engine buffers |
| Stopping rule `S` | Compare both correct paths on fixed fixtures; report measurements without automatic host tuning |

Sky identity is the immutable pack object and sector index at fixed canvas dimensions. A different pack clears the entire cache. Score identity is the immutable pack object, seed, arrangement and region. New pack/seed clears the cache; there are five playable mixes. VANILLAJS's player caches PCM phrases for the active mix and disposes them on pause or arrangement changes. Effect buffers use kind/variant identity; engine buffers use speed-band identity. These fixed source recipes are independent of the mod pack. Presentation caches never skip simulation/tests.

Variables are categorical, search is local, timing is noisy, evaluation is cheap, there are semantic/resource constraints, execution is sequential, and exactness is required. Reference rendering remains selectable through the renderer's `reference` property; score reference calls `compileScore` directly. A parity failure is a defect, not permission to silently weaken equivalence. There is no inherited Lean proof or end-to-end performance claim.

The initial `compileScore` / `createScoreCache` benchmark remains a reference microbenchmark; it does not measure the new player or effects. `compileSoundtrack` delegates to `composeRadio`: eight tick-aligned audio2d phrases sequenced by the unmodified VANILLAJS `soundtrack` and `api/audio` modules. Playback and full-loop WAV export share that score. Event descriptors contain their simulation tick and listener position, so catch-up batches cannot alter their variant or pan. Device time only schedules playback. Web Audio failures stop presentation without changing persisted enable/mixer preferences. A fresh gesture retries audio, including partial device initialization. See [audio bounds and determinism](AUDIO.md).

## Offline packaging

`scripts/build.py` allowlists runtime HTML/CSS/JS, locally vendored modules, mod examples, icon and license/provenance files. README artwork, tests, screenshots, tooling and evidence are excluded from the site. The generated service worker uses the hash of every effective runtime file in its cache identity, namespaces caches by installation path, and only intercepts its own allowlisted GET paths. It never caches remote or arbitrary user requests.

Installation becomes active only after the full cache succeeds. Source changes make the integrity check fail until the worker is regenerated. Hosting under `/Outruin/` is supported; offline navigation preserves query-independent entry HTML while module URLs remain scope-relative.

## Provenance

VANILLAJS donor files are byte-identical to the recorded Git blobs and SHA-256 identities. `scripts/check.py` checks both. The frame lifecycle adaptation and perspective reference are attributed to STREET-RACER; the actual renderer and world are original. OPT supplies the reuse discipline. See `vendor/PROVENANCE.json` and `NOTICE`.
