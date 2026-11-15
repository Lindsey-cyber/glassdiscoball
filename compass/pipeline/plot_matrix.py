"""Heatmap of the signed hemibrain head-direction connectivity (rows = post, cols = pre)."""
import json
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import TwoSlopeNorm

D = Path(__file__).resolve().parent.parent / "data"
z = np.load(D / "hemibrain_hd.npz")
meta = json.loads((D / "hemibrain_hd_neurons.json").read_text())
counts, sign = z["counts"], z["sign"]
W = counts * sign[None, :]            # sign of the presynaptic neuron
V = np.sign(W) * np.log1p(np.abs(W))  # log scale for display

types = [m["type"] for m in meta]
bounds, labels, start = [], [], 0
for i in range(1, len(types) + 1):
    if i == len(types) or types[i] != types[i - 1]:
        bounds.append(i); labels.append((types[i - 1], (start + i) / 2)); start = i

fig, ax = plt.subplots(figsize=(9, 8.4), dpi=150)
lim = np.abs(V).max()
im = ax.imshow(V, cmap="RdBu_r", norm=TwoSlopeNorm(0, -lim, lim), interpolation="nearest")
for b in bounds[:-1]:
    ax.axhline(b - .5, color="k", lw=.6); ax.axvline(b - .5, color="k", lw=.6)
ax.set_xticks([p for _, p in labels]); ax.set_xticklabels([t for t, _ in labels])
ax.set_yticks([p for _, p in labels]); ax.set_yticklabels([t for t, _ in labels])
ax.set_xlabel("presynaptic (sorted by type, then bridge glomerulus L→R)")
ax.set_ylabel("postsynaptic")
ax.set_title("Hemibrain v1.2.1 head-direction circuit · 152 neurons · signed log(1+synapses)", fontsize=10)
cb = fig.colorbar(im, ax=ax, shrink=.75); cb.set_label("excitatory (+)  /  inhibitory (−, Δ7)")
fig.tight_layout()
fig.savefig(D / "hemibrain_hd_matrix.png")
print("saved")
