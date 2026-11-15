# Outruin engineering rules

- Original game code and assets: Apache-2.0. Preserve all donor licenses and exact source identities in vendor/PROVENANCE.json.
- Native HTML/CSS/ES modules only at runtime. No framework, CDN, package install, cloud service, or build step is required to play.
- Keep simulation independent of DOM, presentation timing and ambient randomness. Tick inputs at 60 Hz; seed all encounters. Never promise cross-browser floating-point identity.
- Clear inputs on pause, focus loss, disconnect and dialog transitions. Bound catch-up and stop ticking immediately on terminal states.
- Run `node --test tests/*.test.js`, `python3 scripts/check.py`, `python3 scripts/build.py`, and `node tests/browser.mjs` for gameplay changes. Use the installed Playwright or an explicitly pinned test-only version.
- Preserve OPT reference paths and exact output parity. Measure target behavior before claiming a speedup.
- Public packaging must use an allowlist. Keep tests, evidence, tools and local settings out of deployment.
- Submit through a pull request. Do not merge or release without Trent's authorization.
