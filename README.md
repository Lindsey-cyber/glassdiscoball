# lindseyma.com

Every page is a single, self-contained HTML file: double-click it to open locally, no build step.
Pages that use WebGL libraries (`liuguang.html`) load them from a CDN, so they need a network connection.

| Page | What it is |
| --- | --- |
| `index.html` | Home page (正面). The "Claude vibe-coding projects" link in the top-right corner leads to the gallery. |
| `topology.html` | Persistent homology: filtration, birth and death, barcode, persistence diagram. |
| `compass.html` | The fly's compass: connectome-constrained head-direction circuit (hemibrain and FlyWire), persistent homology in the browser (Ripser → WebAssembly), real mouse head-direction cells. Self-contained: `compass/embed.py` bakes `compass/web/` (simulator, data, WebAssembly) into the page, so it also works opened as a plain file; rerun it after changing anything in `compass/web/`. Pipeline in `compass/pipeline/`. |
| `play.html` | Claude vibe-coding projects — a simple gallery of preview cards, one per project. |
| `liuguang.html` | 流光 — a mirror ball on a chain, simulated with Rapier (rigid-body physics) and rendered with Three.js. |
| `qinglv.html`, `fenqiang.html`, `tianqing.html`, `yubi.html` | 四面 — four rooms in traditional Chinese colours. |

## Adding a project to the gallery

1. Make the project its own HTML file at the top level (e.g. `topology.html`).
2. Save a 1200×750 screenshot as `images/play/topology.webp`.
3. In `play.html`, copy one `<a class="card">` block, change the link, image, number, names and one-line description, and remove the "coming soon" line if it is now live.
