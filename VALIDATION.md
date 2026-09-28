# Mirror Play validation — 2026-09-28

Review: https://github.com/Lindsey-cyber/glassdiscoball/pull/1
Not merged or deployed. Original homepage base: `cd5eb224009259e388c835409dc2ba72a0318c9b`.

## Executed checks

`npm run build` succeeds. `npm test` passes all five tests: closed physical
solids, torque/inertia and three fracture/container workloads, and dense mirror
construction. The mirror test checks 4,590 tiles, closed positive-volume glass
and silver solids, physical-cell ownership and conservation of clipped tile
area (relative tolerance 0.000001).

The visual pass leaves `geometry.js`, `physics.js`, `fracture.js`,
`boundaries.js` and `interaction.js` unchanged from the working physics checkpoint
`75b5132d8e36055862dc1b98489fa419bb1316f3`.

| Fixed-step physics workload | Result |
| --- | --- |
| 210 shards: torque, bounce, containment, sleep, viewport shrink | Pass; 207 asleep after 35 simulated seconds |
| 340 shards, seed 8127 | Pass; 334 asleep after 40 seconds |
| Mobile-size container, 150 shards, seed 98172 | Pass; 146 asleep after 40 seconds |

Cloud Chromium run [36363345622](https://github.com/Lindsey-cyber/glassdiscoball/actions/runs/36363345622)
passed physics plus all five browser configurations: WebGPU, forced WebGL2,
automatic WebGL2 fallback with WebGPU absent, mobile touch and reduced motion.

Browser assertions cover exact homepage portrait bounds (under 0.6 CSS px),
visible rendered pixels, white background, drag torque without accidental
fracture, click/tap fracture, containment, settling, resize and three repeated
visits with one canvas and reset state. WebGPU also exercises the normal animation
frame loop after a drag. No captured JavaScript or renderer errors occurred.
Desktop WebGPU used DPR 2; mobile used a DPR-2 viewport with renderer ratio 1.7.
In this browser run, 230/230 desktop shards and 137/150 mobile shards slept after
40 simulated seconds. Sleeping thresholds were not relaxed for the visual pass.

## Visual loop actually completed

Screenshots were rendered by the application, downloaded and inspected against
the supplied board. The inspected states include Default intact and rotated,
all four lighting presets, fracture, tumbling in Default/Night/Neon, settled
shards, resized viewport, and mobile intact/fracture/tumbling/settled.

Iterations corrected:

1. Additive receiver alpha that initially made an opaque dark patch.
2. Flat grey reflection regions and overly dark Night/Neon rooms: added real
   neutral room louvers, negative fill, ceiling beams and more balanced sources.
3. Stair-step fracture outlines: clipped the tiny mirrors along the existing
   convex physical cells, retaining their independent rigid motion.
4. Tiny cell-junction coverage gaps: use exact bisector/rectangle candidate
   selection and verify area conservation.

Final inspected Default is silver/grey with narrow seams and dark mirror details.
Rotation changes the reflected room pattern. Sunset retains a silver base with
low golden highlights; Night has dark neutral reflections and crisp white peaks;
Neon catches separate cyan, magenta and white sources. Shards retain the same
silver/glass materials while tumbling and remain on the viewport floor.

## Scope and limits

These tests use Chromium's software GPU in GitHub Actions. They validate actual
WebGPU/WebGL2 output and interactions, not 60 FPS on physical desktop/mobile
hardware or Safari. Deterministic screenshot capture pauses frame submission and
advances the same Rapier world at 120 Hz; production runs continuously. Runtime
frame time adapts pixel ratio without deleting tiles.

Tile rendering is batched into a rigid bone palette with two material groups.
A rendered settled frame reports 5–7 draw calls, depending on ground deposits;
environment capture incurs extra draws only on preset changes. Resource cleanup
covers geometry, materials, skeleton, environment targets, lights, renderer,
Rapier world, observers and event handlers. Re-entry is tested; long-duration
hardware GPU-memory profiling is not claimed.

The receiver uses real tile-normal/lamp/plane intersections with an approximate
finite-source footprint. It does not trace inter-shard occlusion or multiple
light bounces. Glass uses raster transmission rather than recursive path tracing.

Homepage stylesheet and script are untouched; only its Play link changes.
The existing image/document/project assets are copied into the static build.
