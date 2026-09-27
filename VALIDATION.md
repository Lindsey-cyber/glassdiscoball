# Validation checkpoint — 2026-09-27

**Draft, not accepted or deployed.** Base: `cd5eb224009259e388c835409dc2ba72a0318c9b`.

## Actually executed

- `npm run build`: succeeds with Vite 7.3.1. The main JS bundle is about 3.15 MB
  uncompressed / 1.09 MB gzip (Three.js + inlined Rapier WASM). A bundle-size
  advisory is emitted. No external runtime CDN is required.
- `npm test`: **2 pass, 2 fail**. The failures are deliberately retained as
  acceptance gates; their assertions have not been relaxed.

| Test | Observed result |
| --- | --- |
| Closed Voronoi solids, winding, irregular areas, deterministic geometry | Pass |
| Torque inertia, 210 shards, floor bounce, containment, sleep, viewport shrink | Pass; 204/210 asleep after 35 simulated seconds |
| 340 shards, seed 8127 | Contained for 40 seconds; sleep gate fails, 217/340 asleep |
| Mobile-size container, 150 shards, seed 98172 | Contained for 40 seconds; sleep gate fails, 109/150 asleep |

Remaining physics work: remove long-lived contact chatter across multiple seeds
and shard budgets while preserving bounce, rolling, inter-shard collision and
wake-on-impact. The current contact-supported rest-pose heuristic improves the
210-shard case but does not solve every configuration. Rapier 0.21 was also
trialled and produced penetrations in this thin-shell test; the draft pins
0.19.3, which passed containment in the recorded scenarios.

## Browser checks are prepared, not passed

`tests/browser.mjs` and `.github/workflows/play.yml` cover actual portrait bounds,
WebGPU, forced WebGL2, pointer torque, click fracture, mobile, reduced motion,
resize, screenshots, re-entry and single-canvas lifecycle. They have **not run
successfully** in a browser. No visual-quality, 60 FPS, real GPU, shader compile,
mobile hardware, or browser memory stability claim can be made yet.

Local Chromium startup terminated with SIGTRAP in the execution sandbox.
The cloud browser cannot reach the local server, and its policy rejected local
file URLs. No browser security restriction was bypassed.

GitHub reads worked. Creating `codex/physical-glass-play` was rejected by GitHub:
`403 Resource not accessible by integration`. HTTPS push also lacked credentials.
No branch, PR, workflow run, or deployment exists on GitHub from this task.
A GitHub connection with repository branch/workflow write access is needed to
continue with the prepared remote validation route. Do not share tokens in chat.

## Apply the checkpoint

From a clean checkout at the base commit:

```sh
git switch -c review/physical-glass-play
git apply /path/to/glass-play-draft.patch
npm ci
npm run dev
npm test
npm run build
```

The homepage stylesheet and script are untouched. Its only HTML change is a
relative Play link. `/play/index.html` preserves the existing layout slots and
copies the original intro text invisibly to preserve its height. The supplied
repository lacks the images referenced by the homepage; preserve the existing
host's image assets when deploying a future approved build.
