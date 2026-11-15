# Validation scope

## Display modes — executed 15 November 2026 (Adelaide)

Starting from merged source `ec30415b5d48e613f3452ad61330315d3ca0670f`:

- 64 Node tests passed; display work does not change simulation/replay rules.
- 28 packaged Chromium checks passed, including native fullscreen entry/exit,
  restoring the previous windowed mode, held-input cleanup, paused ticks,
  denied-fullscreen fallback, persisted preferences, and the Controls shortcut.
- The full canvas, HUD, toolbar and mission text fit inside 1836×890, 1366×650
  and 1280×600 viewports. Touch layouts also fit at 320×844, 390×844 and 844×390;
  resize preserves the composition. Tests check element bounds, no document
  overflow and `object-fit: contain`. Short fullscreen menus remain reachable
  by scrolling inside the overlay.
- Source/provenance checks and the allowlisted build passed (28 runtime files
  plus the generated service worker). Desktop and touch captures were visually
  inspected. Source-bound receipts are in [`evidence/display-upgrade/`](evidence/display-upgrade/).

The browser run uses Chromium 141.0.7390.37 and Playwright 1.62.1. Native exits
are exercised through `exitFullscreen()` and its real `fullscreenchange` event;
the physical browser Esc shortcut, mobile fullscreen hardware, Firefox and
WebKit are not covered by this run. Existing audio evidence remains unchanged.

## Wasteland Radio — executed 15 November 2026

Starting from merged source `ce9ac790fa8274c60268195918c3d32e09f68312`:

- **64 Node tests passed**: five distinct eight-phrase scores, arbitrary PCM
  chunk equivalence, all 64 effect variants, eight engine bands, seed/tick event
  identity across frame batches, bounded voices/caches, mixer mute, preview
  cancellation and device initialization/allocation failures. Existing driving,
  campaign, replay, mod, input and OPT parity checks remain green.
- **23 packaged Chromium checks passed**, using Chromium 141.0.7390.37 and
  Playwright 1.62.1. New coverage includes real Web Audio engine/boost loops,
  pause cleanup, mix/effect auditions, closing/editing/focus cancellation,
  separate persisted mixer levels, narrow-screen dialogs, and downloaded road,
  boss and effect WAVs matching the Node reference bytes.
- PCM identities and statistics cover five complete default scores, all 64
  effect variants and eight engine loops. All have zero clipped PCM samples.
  This does not measure the final mix at the audio device.
- Four complete campaign input/command journals produce equal snapshots under
  the baseline and upgraded simulation: default Drifter and Survivor, Heavy
  Metal and Night Courier. Gameplay remains at replay version 0.2.0.
- Source integrity and packaging passed: 27 allowlisted files plus the generated
  service worker. Vendored source identities are unchanged. Desktop Workshop,
  mixer and 320 px Workshop screenshots were visually inspected.

Receipts, WAV hashes, runtime/test source hashes and UI captures are retained in
[`evidence/audio-upgrade/`](evidence/audio-upgrade/). The first browser run caught
a preview surviving briefly after the close button: the browser's `close` event
is asynchronous. The button and Escape cancellation now stop the preview before
closing; the original failure is preserved. The editing check now makes a real
JSON text change instead of filling the textarea with the same value. An initial
baseline-comparison harness call used an invalid Node subprocess option; its
failed log is retained separately from the successful compatibility receipt.

No physical-speaker listening test, mobile audio hardware, Firefox or WebKit
run is claimed. PCM byte identity and browser lifecycle are the executed scopes.

## Road Reborn / 0.2 — executed 15 November 2026

Starting from merged source `5384a57b2061d1bd763d89b849fb5aae2cfb2454`:

- **49 Node tests passed**, including complete default and example-pack Drifter
  campaigns, Survivor completion and exact current-version replay snapshots.
- **18 packaged Chromium checks passed** with Chromium 141.0.7390.37 and the
  installed Playwright 1.62.1. Coverage includes stationary steering, real keyboard
  driving, interpolation without state mutation, road scanline integrity, all
  three biome captures, audio-failure recovery, complete seed-zero WAV export,
  remapping, mobile layout/touch, pause/focus and offline reload.
- Source checks and the allowlisted build passed: 25 runtime files plus the
  generated service worker, including byte-identical VANILLAJS soundtrack/player
  modules at `987c8d9be0af418307ea7cda05cbf56b5f130c71`.
- Road screenshots were visually inspected. Camera/shoulder alignment, brighter
  target warnings, travel traces and removal of horizontal road seams are shown
  in [`evidence/road-upgrade/`](evidence/road-upgrade/).

The receipts and runtime/test SHA-256 manifest bind these local observations.
The earlier failures are retained: missing default Chromium executable, a legacy
steering-distance assertion based on immediate low-speed movement, a road-surface
fixture that accidentally sampled the starting instruction text, and a remapping
fixture whose fixed 40 ms wait could miss the neutral poll. The revised tests
exercise the new steering timing, sample unobstructed road, and await actual pad
readiness. No physical-device or other-browser coverage is implied.

## Initial milestone — executed locally 15 November 2026

- Node v24.22.1: simulation, complete campaign input traces, replay, mod rejection, controller mapping, PCM chunk equivalence and cache parity tests.
- Headless Chromium 141.0.7390.37, driven by the environment's Playwright 1.62.1: garage/start, steering/throttle, Space after clicking SOUND, pause, cached/reference pixel identity for all three biomes and foot views, keyboard scavenging/return, shop/route/victory UI, invalid-pack rejection, custom vehicle application/export, simulated SNES remapping, disconnect/focus lifecycle, 320/390/768 px layouts, simultaneous pointer controls and offline reload with bundled mods.
- Source identity and packaging checks: upstream Git blob + SHA-256 matching, native-module import closure, JavaScript syntax, no ambient clock/randomness in simulation, allowlisted runtime and complete service-worker identity.
- The browser suite initializes a RUNNING receipt and persists FAIL/PASS on completion; failed observations are not treated as successful evidence.

Real phones, physical SNES/Xbox hardware, Firefox and WebKit were **not executed**. Synthetic gamepads and resized Chromium viewports do not establish physical device coverage. CI uses its own explicitly pinned Playwright 1.56.1 environment and archives that run's receipts/screenshots.

## Failures found and corrected

The first browser pass lost a short E tap during scavenging: the browser key-down/key-up both arrived before the next simulation tick. Input now latches press events until at least one tick consumes them. The same path handles rapid keyboard and touch actions. Later checks retained the assertion and passed.

A source-level lifecycle review also found that returning from a final-sector scavenging stop could clear the live boss while retaining its spawned flag. Returning now permits the undefeated boss to spawn again; a dedicated regression protects final-campaign completion.

The first local Chromium launch hit an environment AF_UNIX socket restriction. The already-installed headless-shell executable successfully ran the suite. No assertion or browser feature check was weakened to work around it.

## Reproduce

```sh
node --test tests/*.test.js
python3 scripts/check.py
python3 scripts/build.py
TEST_ROOT=dist node tests/browser.mjs
node scripts/benchmark.mjs
```

If Playwright is already installed outside this repository, set `PLAYWRIGHT_MODULES` to the directory containing its package. The suite can also use the managed runtime's installed dependency. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if a particular installed Chromium executable is required. CI installs browser tooling in a temporary directory, never in the deployed game.

`evidence/browser.json` records scope, individual check results, failures and browser version. Screenshots and logs are generated under `evidence/`; CI uploads that directory even if the browser step fails. They are not part of the public runtime.

## OPT measurement boundary

Five rounds of 500 score-compilation requests on this task's AMD EPYC 7763 host:

| Round | Compile each request (ms) | Reuse compiled score (ms) |
| --- | ---: | ---: |
| 1 | 13.610 | 0.057 |
| 2 | 6.065 | 0.281 |
| 3 | 5.595 | 0.022 |
| 4 | 6.278 | 0.022 |
| 5 | 5.725 | 0.075 |

These measurements cover **score construction requests only**. PCM rendering, startup, frame rendering, speaker output and the rest of the game are excluded. Small warm-cache measurements are noisy. There is no claim of a corresponding whole-game speedup. Correctness is established separately by exact PCM comparison of reference/cached results and exact pixel comparison of reference/cached sky rendering. The script writes fresh raw rounds to `evidence/opt-score.json`.

The initial executed run is preserved under [`docs/evidence/initial/`](evidence/initial/): 36 passing Node tests, 12 passing packaged-browser checks, the earlier failed browser receipt, raw OPT rounds, and SHA-256 identities of all tested runtime files. Those source hashes bind the local observations independently of the later GitHub commit identifier.
