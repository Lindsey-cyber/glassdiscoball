# Lindsey Ma · Mirror Play

The existing homepage is preserved. `/play/` contains a physically rotating and
breakable silver mirror ball, rendered with Three.js 0.186.1 and simulated with
Rapier 3D 0.19.3. No runtime graphics CDN or image-based ball is used.

## Run and build

Node 22+:

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Deploy the contents of `dist/` to the existing static host. The build preserves
original homepage CSS, JS, images, documents and project pages. The homepage's
only HTML change is the relative Play link. No automatic production deployment
is configured. The old `/play/glass-orb.html` URL redirects to `/play/`.

## Construction and physics

`geometry.js`, `physics.js`, `fracture.js`, `boundaries.js` and `interaction.js`
preserve the original convex-fragment simulation: velocity-driven torque,
mass/inertia, 120 Hz fixed steps, CCD, varied impulses, collisions, restitution,
friction, rolling, supported sleep and viewport resize boundaries.

`tiles.js` adds 4,590 actual mirror tiles on desktop and 3,722 on mobile, roughly
2,295 / 1,861 facing the viewer. Every tile has a silver backing and a separate
bevelled glass cap. Narrow seams, modest size variation and small installation
angle errors make a manufactured mosaic. Tiles are clipped against the existing collider-cell boundaries, so fracture
edges cut cleanly across the tiny mirrors instead of producing stair-step patches; there are still only 150–340 dynamic bodies. The rendering
cluster and convex collider are intentionally separate representations.

`sculpture.js` batches all tiles into one rigid bone palette and two material
groups. Each vertex has exactly one unit skin weight. No tile deforms, and no
rotation is animated separately from its Rapier rigid body. Thousands of tiles
do not become thousands of draw calls or colliders.

`material.js` models neutral, opaque silver beneath thin refractive glass:
metallic reflection, low nonzero roughness, IOR 1.52, actual thickness, bevels,
Fresnel and minimal dispersion. There is no rainbow coating or preset tint.

## Lighting

`environment.js` builds a real 3D room with window panes, mullions, neutral
surfaces, negative fill and luminous strips. PMREM is generated from this scene
at runtime when the preset changes. Reflection lookup and PBR shading respond
to current tile normals on every frame, including after fracture. Direct lamps
and the reflected room use corresponding positions and colors.

- **Default:** broad divided daylight windows and quiet neutral room contrast.
- **Warm Sunset:** low golden light, cooler fill and elongated sources.
- **Night Spotlight:** low ambience, a small intense white source and narrow rim.
- **Neon Mix:** spatially separate cyan, magenta and neutral-white sources.

`ground-light.js` computes single-bounce specular transport from each lamp via
actual tile positions/normals to a faint tilted receiving surface. Intersection,
incidence, distance falloff, finite-source spread, receiver angle and footprint
area determine each deposit. The field has no clock, random sparkle, static
projection texture or canned motion. Light is added without accumulating opaque
coverage over the white webpage.

This is a raster PBR experiment, not a full path tracer: screen-space glass
transmission does not recursively refract every overlapping shard. The receiving
field approximates finite-area-source transport and omits inter-shard occlusion
and multiple bounces. Collider clusters approximate groups of small glass tiles.

## Layout, lifecycle and quality

The original `.site-shell / .intro / .intro-photo / .portrait-button` controls
position and size. Hidden intro copy preserves the homepage header's exact
metrics. Update both intro copies together if homepage text changes. A short
caption and four small lighting buttons are the only added visible content.

`renderer.js` uses WebGPU with automatic WebGL2 fallback. A transparent canvas
keeps the page white without exposing the background to tone mapping. Both
backends use the same geometry and PBR models. Pixel ratio adapts to frame time;
tile density stays intact. Reduced motion stops idle rotation and spin gestures,
while an explicit tap still fractures with a much smaller impulse. Page hiding,
resize and repeated visits clean up/rebuild their resources.

## Validation and reproducibility

`/play/?debug&seed=42&renderer=webgl` forces WebGL2 and exposes `window.__glass`.
Omit `seed` for fresh geometry/fracture randomness on each visit. The debug-only
`paused` query starts without frame submission for deterministic screenshot
capture on software GPUs. `advance(seconds)` still integrates the real Rapier
world and renders the actual resulting poses. Normal navigation never pauses.

Browser tests need a running preview and Chromium:

```sh
npx playwright install --with-deps chromium
npm run test:browser
# Linux software-GPU canvas capture also requires Xvfb/Mesa:
xvfb-run -a -s '-screen 0 1440x900x24' npm run test:browser
```

GitHub Actions separately checks physics and WebGPU/WebGL2, automatic fallback,
mobile touch and reduced motion. It records intact, rotated, all presets,
fracture, tumbling, settled and resize screenshots, then checks repeated visits.
See `VALIDATION.md` for measured results and the review status. Software GPU
screenshots do not establish 60 FPS or mobile-device thermal performance.
