// Connectome-constrained rate model of the fly head-direction circuit, ported from compass/pipeline/fit_model.py.
//   tau * dr/dt = -r + sigmoid(W r + b + I)
//   W[post][pre] = gain[type_post][type_pre] * synapses * sign[pre] / norm
// The synapse counts come from the connectome; only the cell-type gains, biases and time constants were fitted.

export const CONDITIONS = {
  fitted: "Connectome + fitted cell-type gains",
  raw: "Raw synapse counts × one gain",
  noD7: "Fitted, Δ7 neurons removed",
  shuffled: "Fitted, wiring shuffled within cell types",
};

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export class Circuit {
  constructor(model, cond = "fitted") {
    this.model = model;
    const n = this.N = model.neurons.length;
    this.tix = Int32Array.from(model.neurons, x => model.types.indexOf(x.type));
    this.side = Float32Array.from(model.neurons, x => x.side);
    this.isEPG = model.neurons.map(x => x.angle !== null);
    this.cosA = Float32Array.from(model.neurons, x => x.angle === null ? 0 : Math.cos(x.angle));
    this.sinA = Float32Array.from(model.neurons, x => x.angle === null ? 0 : Math.sin(x.angle));
    this.epgIdx = model.neurons.map((x, i) => x.angle !== null ? i : -1).filter(i => i >= 0);
    this.r = new Float32Array(n);
    this.u = new Float32Array(n);
    this.setCondition(cond);
  }

  setCondition(cond) {
    const m = this.model, n = this.N, D7 = m.types.indexOf("D7");
    const p = m.params[cond === "raw" ? "raw" : "fitted"];
    this.cond = cond;
    this.kv = p.kv;
    this.b = Float32Array.from(this.tix, t => p.bias[t]);
    this.tau = Float32Array.from(this.tix, t => p.tau[t]);
    const W = this.W = new Float32Array(n * n);
    for (const [post, pre, c] of m.edges) W[post * n + pre] = p.gain[this.tix[post]][this.tix[pre]] * c * m.sign[pre] / m.norm;
    if (cond === "noD7") {
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (this.tix[i] === D7 || this.tix[j] === D7) W[i * n + j] = 0;
    }
    if (cond === "shuffled") {
      const rand = rng(42), T = m.types.length;
      for (let a = 0; a < T; a++) for (let b = 0; b < T; b++) {
        const ia = [], ib = [];
        for (let i = 0; i < n; i++) { if (this.tix[i] === a) ia.push(i); if (this.tix[i] === b) ib.push(i); }
        const vals = []; for (const i of ia) for (const j of ib) vals.push(W[i * n + j]);
        for (let k = vals.length - 1; k > 0; k--) { const s = Math.floor(rand() * (k + 1)); [vals[k], vals[s]] = [vals[s], vals[k]]; }
        let k = 0; for (const i of ia) for (const j of ib) W[i * n + j] = vals[k++];
      }
    }
  }

  reset() { this.r.fill(0); }

  // one Euler step; vel in rad/s; cue = heading angle of a visual landmark (or null in darkness)
  step(vel, cue = null, cueGain = this.model.cueGain) {
    const n = this.N, W = this.W, r = this.r, u = this.u, dt = this.model.dt;
    for (let i = 0; i < n; i++) {
      let s = this.b[i] + this.kv * vel * this.side[i];
      if (cue !== null && this.isEPG[i]) s += cueGain * Math.max(0, this.cosA[i] * Math.cos(cue) + this.sinA[i] * Math.sin(cue));
      const row = i * n;
      for (let j = 0; j < n; j++) s += W[row + j] * r[j];
      u[i] = s;
    }
    for (let i = 0; i < n; i++) r[i] += dt / this.tau[i] * (-r[i] + 1 / (1 + Math.exp(-u[i])));
  }

  decode() {
    let x = 0, y = 0, s = 0;
    for (const i of this.epgIdx) { x += this.r[i] * this.cosA[i]; y += this.r[i] * this.sinA[i]; s += this.r[i]; }
    return { angle: Math.atan2(y, x), contrast: s > 1e-6 ? Math.hypot(x, y) / s : 0, mean: s / this.epgIdx.length };
  }

  epgState() { return Float32Array.from(this.epgIdx, i => this.r[i]); }
}
