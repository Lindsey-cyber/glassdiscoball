# lindseyma.com

Every page is a single, self-contained HTML file: double-click it to open locally, no build step.
Pages that use WebGL libraries (`liuguang.html`) load them from a CDN, so they need a network connection.

| Page | What it is |
| --- | --- |
| `index.html` | Home page (正面). The ↑ in the top-right corner leads to the shelf. |
| `play.html` | 多宝格 — a curio shelf; each compartment is one small project. |
| `liuguang.html` | 流光 — a mirror ball on a chain, simulated with Rapier (rigid-body physics) and rendered with Three.js. |
| `qinglv.html`, `fenqiang.html`, `tianqing.html`, `yubi.html` | 四面 — four rooms in traditional Chinese colours. |

## Adding a project to the shelf

1. Make the project its own HTML file at the top level (e.g. `topology.html`).
2. In `play.html`, add an `<a class="cell" href="topology.html" style="grid-area:NAME">` with an SVG object and a `.tag`.
3. Give `NAME` a place in `grid-template-areas` (desktop and the mobile block) — the empty compartments
   `empty1` / `empty2` are there to be taken over.
