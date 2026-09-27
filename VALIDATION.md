# Validation checkpoint — 2026-09-27

**Draft, not deployed.** Base: `cd5eb224009259e388c835409dc2ba72a0318c9b`.
Review: https://github.com/Lindsey-cyber/glassdiscoball/pull/1

## Actually executed

- `npm run build`: succeeds with Vite 7.3.1. The main JS bundle is about 3.15 MB
  uncompressed / 1.09 MB gzip (Three.js + inlined Rapier WASM). A bundle-size
  advisory is emitted. No external runtime CDN is required.
- `npm test`: **4 pass, 0 fail**. Containment is checked at every 120 Hz step;
  sleep assertions have not been relaxed.

| Test | Observed result |
| --- | --- |
| Closed Voronoi solids, winding, irregular areas, deterministic geometry | Pass |
| Torque inertia, 210 shards, floor bounce, containment, sleep, viewport shrink | Pass; 207/210 asleep after 35 simulated seconds |
| 340 shards, seed 8127 | Pass; 334/340 asleep after 40 seconds |
| Mobile-size container, 150 shards, seed 98172 | Pass; 146/150 asleep after 40 seconds |

Persistent contact jitter is handled by a supported, low-energy, sustained
subpixel-rest condition; sleeping bodies preserve this history when a contact
island wakes. Real motion resets the condition, and a new impact can wake bodies.
No positions are pinned and no fracture trajectories are animated. Rapier 0.19.3
is pinned after comparison with 0.21 in this thin-shell workload.

## Browser validation in progress

`tests/browser.mjs` and `.github/workflows/play.yml` cover actual portrait bounds,
WebGPU, forced WebGL2, pointer torque, click fracture, mobile, reduced motion,
resize, screenshots, re-entry and single-canvas lifecycle. Local Chromium cannot
start in the execution sandbox; GitHub Actions provides the browser environment.
The first cloud run initialized Play and passed the desktop portrait alignment
assertion, but timed out capturing its continuously rendered software-GPU canvas.
The next run pauses frame submission while capturing a static frame.

No visual-quality, 60 FPS, real GPU, mobile hardware, or browser memory-stability
claim can be made before those checks complete. Software rasterization timing
cannot establish a hardware frame-rate target.

The homepage stylesheet and script are untouched. Its only HTML change is a
relative Play link. `/play/index.html` preserves the existing layout slots and
copies the original intro text invisibly to preserve its height. The build copies
the repository's existing image and document assets into `dist/`.
