# Lindsey Ma · Glass Play

The academic homepage is preserved. `/play/` is a real-time glass sculpture
built with Three.js 0.186.1 and Rapier 3D 0.19.3, with no remote runtime CDN.

## Run / publish

Node 22+:

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
# One-time browser installation for the end-to-end checks:
npx playwright install chromium
npm run test:browser
```

Upload **the contents of `dist/`** to the existing static host. A build is now
required; uploading the source folder directly will not resolve npm imports.
The build copies the original homepage, scripts, CSS, projects, and any existing
`images/` assets. The supplied repository does not contain its referenced image
files: preserve those assets on the existing host. `play/glass-orb.html` redirects
to `/play/`, preserving query parameters. No production deployment is automatic.

## Architecture

- `renderer.js`: WebGPURenderer, automatic WebGL2 backend, orthographic viewport.
- `geometry.js`: spherical Voronoi dual of jittered Delaunay vertices; closed,
  irregular polygonal prisms, genuine bevels, per-facet optical attributes.
- `material.js`: MeshPhysicalNodeMaterial + TSL attributes; transmission, IOR,
  absorption, thin-film iridescence, dispersion and silver-coated facets.
- `environment.js`: HDR studio softboxes, PMREM convolution and direct lights.
- `sculpture.js`: one GPU bone transform per rigid solid. All vertices have exactly
  one unit skin weight, so this is rigid transformation, never elastic skinning.
  One shared geometry/material avoids hundreds of separate draw submissions.
- `physics.js`: fixed 120 Hz Rapier simulation, mass/inertia, torque impulses,
  interpolated rendering, damping, CCD, contact-supported, sustained subpixel-rest sleep.
- `fracture.js`: off-center pressure pulse, log-normal impulse mixture, sparse
  energetic tail, near-drop population, mass/area and inherited-spin effects.
- `boundaries.js`: six invisible physical walls; viewport bottom is the floor.
- `interaction.js`: pointer capture, velocity-to-torque, tap/drag separation,
  keyboard activation, cancellation and cleanup.
- `performance.js`: device-dependent topology budget (150–340 fragments),
  measured frame-time pixel-ratio adaptation. Fragments are never deleted to
  regain FPS. A static studio needs only one environment convolution; reflection
  directions and all PBR shading are evaluated every rendered frame.
- `main.js`: shared portrait layout measurement, lifecycle, visibility suspension,
  resize, reduced motion, resource cleanup and back/forward restoration.

The invisible intro copy deliberately matches the homepage header's content and
metrics; `.site-shell / .intro / .intro-photo / .portrait-button` supply layout.
An end-to-end assertion compares their actual bounding rectangles on desktop and
mobile. Update both intro copies together if homepage copy changes.

## Debug / validation

`/play/?debug&seed=42&renderer=webgl` forces WebGL2 and exposes `window.__glass`.
Omit `renderer=webgl` to exercise WebGPU with automatic WebGL2 fallback. Omit
`seed` for a fresh crypto seed on each visit. There is intentionally no reset UI;
return home and enter Play again for a new fracture.

Reduced motion disables idle rotation and spin gestures and reduces the
user-triggered fracture impulse to 10%; gravity and real collision remain.
There is no continuous background rendering after every body sleeps.

`npm test` checks closed hulls, winding, irregularity, reproducibility, torque
inertia, floor rebound, containment, sleep and viewport resizing. The PR workflow
also builds and runs Chromium checks on WebGPU/WebGL2, mobile, reduced motion,
layout alignment, re-entry, and screenshots. Software GPU test timing is not a
claim of 60 FPS on hardware; profile on target devices before publishing.

## Rendering limits

This is raster PBR, not a path tracer: transmission uses Three.js's screen-space
scene buffer and cannot refract DOM text or recursively refract every overlapping
shard. Actual solid geometry, refractive index, thickness, absorption, Fresnel,
film interference and specular environment lighting remain active after fracture.
Bloom is intentionally omitted to preserve small high-contrast reflections.

## Current review status

Implementation is a draft pending browser validation. Local physics/build checks
are recorded in `VALIDATION.md`. The connected GitHub integration rejected
branch creation (403), so no remote branch, PR, workflow run, or deployment has
been created. Do not treat the browser test script as evidence it has passed.
