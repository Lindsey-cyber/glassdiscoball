// Web Worker: persistent homology of recorded E-PG states with Ripser (WebAssembly), plus a shuffle null.
//   kind "barcode": X (already subsampled by the page) -> H0, H1 diagrams
//   kind "null":    X (full time series) -> longest H1 lifetime over `shuffles` circular-shift surrogates
//   kind "full":    both, for the side-by-side experiments
import { loadRipser, ripser } from "./ripser-wasm.js";

let modP = null;
const mod = () => (modP ||= loadRipser(new URL("./ripser.wasm", import.meta.url).href));

export function subsample(X, n) {
  if (X.length <= n) return X;
  const out = [];
  for (let k = 0; k < n; k++) out.push(X[Math.round(k * (X.length - 1) / (n - 1))]);
  return out;
}
function lifetimes(dgm) { return dgm.filter(([b, d]) => Number.isFinite(d)).map(([b, d]) => d - b).sort((a, b) => b - a); }

// circularly shift each neuron's time series independently: keeps every neuron's firing statistics,
// destroys the coordination between neurons (Gardner et al. 2022 use the same null)
function shuffled(X, rand) {
  const T = X.length, n = X[0].length, shifts = Array.from({ length: n }, () => Math.floor(rand() * T));
  return X.map((_, t) => Array.from({ length: n }, (_, j) => X[(t + shifts[j]) % T][j]));
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

async function nullThreshold(m, X, n, shuffles, onProgress) {
  const rand = rng(7); let best = 0;
  for (let k = 0; k < shuffles; k++) {
    const r = await ripser(m, subsample(shuffled(X, rand), n), { dim: 1 });
    best = Math.max(best, lifetimes(r.dims[1] || [])[0] || 0);
    onProgress?.(k + 1, best);
  }
  return best;
}

self.onmessage = async ({ data }) => {
  const { id, kind, X, n = 400, shuffles = 20, tag } = data;
  try {
    const m = await mod();
    if (kind === "barcode") {
      const t0 = performance.now();
      const pts = subsample(X, n);
      const r = await ripser(m, pts, { dim: 1 });
      self.postMessage({ id, kind, h0: r.dims[0] || [], h1: r.dims[1] || [], points: pts.length, ms: performance.now() - t0 });
    } else if (kind === "null") {
      const thr = await nullThreshold(m, X, n, shuffles, (done, best) => self.postMessage({ id, kind: "progress", done, total: shuffles, best }));
      self.postMessage({ id, kind, threshold: thr, shuffles });
    } else if (kind === "full") {
      const r = await ripser(m, subsample(X, n), { dim: 1 });
      const thr = await nullThreshold(m, X, n, shuffles, (done) => self.postMessage({ id, kind: "progress", tag, done, total: shuffles }));
      self.postMessage({ id, kind, tag, h0: r.dims[0] || [], h1: r.dims[1] || [], threshold: thr });
    }
  } catch (e) { self.postMessage({ id, kind: "error", tag, message: String(e && e.message || e) }); }
};
