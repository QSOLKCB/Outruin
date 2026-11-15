# Wasteland Radio

The radio now has five original mixes, each with eight two-bar phrases: intro,
drive, reply, fill, breakdown, build, drive and turnaround. They use four lanes
for melody, bass, noise percussion and a descending kick. Existing mod-pack
notes, tempo, waveform and gain still control the composition.

| Mix | Role | Default duration |
| --- | --- | ---: |
| Rust / Dead Air | First road region | 32 seconds |
| Salt / White Noise | Second road region | 32 seconds |
| Glass / Last Light | Third road region | 32 seconds |
| Outpost / Static Shelter | Sparse, slower scavenging arrangement | 40 seconds |
| War Rig / Redline | Faster combat arrangement with heavier bass | 27.47 seconds |

Additional modded regions cycle through the three road treatments. The outpost
and boss mixes retain the pack's musical material. The seed selects percussion
noise samples; it does not consume the gameplay RNG or randomise the authored melody.

## Effects and the machine

VANILLAJS `audio2d` now renders the effects as integer PCM too. Forward, side,
on-foot and enemy guns have different layered transients and bodies. Armour hits
combine metal tones and noise; explosions have a longer low tail. Fuel, ammo,
repairs, scrap, relay arrivals, outposts and boss warnings use distinct cues.
Walking adds footsteps. Eight one-second engine loops follow road speed, with
separate boost and tyre-scrub layers. Band changes crossfade in Web Audio.

One-shot variant selection is a pure function of seed, event tick and kind. The
event stores its listener position before a catch-up frame advances further;
this keeps side-gun and enemy-shot panning consistent with the tick that emitted
the cue. Late effects seek into their clip or skip it if it has already expired.

**CONTROLS → Audio levels** saves music, effects and engine/tyre volume separately.
Zero mutes that layer. **SOUND** is the master switch. **WORKSHOP → Wasteland radio
& effects** auditions the editor's selected mix or effect and exports a complete
WAV. Auditions use a fixed preview level through the master switch, independently
of the in-game mixer; effects use the garage seed and tick zero. Editing the pack,
changing the selection, stopping, closing, or losing focus cancels the audition,
including an audio-unlock request that has not completed yet.

## What is deterministic

`js/radio.js` (`outruin.radio.v2`) and `js/sfx.js` (`outruin.sfx.v1`) produce recipes
for byte-identical, locally vendored VANILLAJS modules at
`987c8d9be0af418307ea7cda05cbf56b5f130c71`. Provenance and upstream hashes are
unchanged. The same effective inputs produce the same reference 48 kHz mono
PCM16LE samples and WAV bytes. Arbitrary chunk renders equal whole renders.
Every radio phrase boundary is an integer 60 Hz simulation tick.

Web Audio is the presentation layer: phrase scheduling, stereo panning, gain
ramps, a compressor, resampling and device output are not covered by that byte
identity. The game does not export a fully mixed session recording. A pause
stops voices; resuming selects the music phrase and offset from the current
simulation tick. Muting does not stop the simulation or rewrite a saved preference.
Playback failures are contained, and another user gesture retries the device.

## Bounds and compatibility

- Five compiled radio scores per pack/seed; at most eight PCM phrase buffers for
  the currently playing score. A new run pack/seed clears the score cache.
- An LRU cache holds at most 64 effect/engine buffers; each is at most one second.
- At most 12 one-shot voices, three engine-related loops and six retiring loops.
  There is at most one Workshop preview, lasting at most 48 seconds for a valid pack.
- Pause, mute, focus loss and page lifecycle transitions release owned voices.
  Failure during voice allocation also releases nodes created before the failure.
- The existing `outruin.mod.v1` format and `0.2.0` gameplay/replay version remain.
  Added sound-event metadata and footsteps do not change simulation snapshots,
  inputs, command order or gameplay RNG. Effect recipes are editable in source;
  no new JSON effect schema or visual music sequencer is claimed.

The original `compileScore` / `createScoreCache` reference paths and parity tests
remain available. Their historical microbenchmark does not measure this audio
upgrade; no performance speedup is claimed.

## Reproduce the checks

```sh
node --test tests/*.test.js
node scripts/audio-evidence.mjs
uv run --no-project python scripts/check.py
uv run --no-project python scripts/build.py
TEST_ROOT=dist node tests/browser.mjs
```

The PCM receipt records complete WAV SHA-256 hashes and peak/clipping statistics
for all five default scores, 64 effect variants and eight engine bands. Browser
downloads are compared with Node reference bytes, including seed zero, the boss
mix and an explosion. See [validation](VALIDATION.md) and the retained
[audio evidence](evidence/audio-upgrade/).
