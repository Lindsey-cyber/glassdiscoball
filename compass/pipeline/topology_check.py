"""Phase 1 check: does the simulated E-PG activity lie on a ring?

For each condition (fitted model, raw synapse counts x best global gain, fitted model with Delta7 removed,
fitted model with weights shuffled inside each cell-type block), simulate 60 s of turning in darkness,
take the 46-dimensional E-PG population state, subsample 400 time points, and compute Vietoris-Rips
persistent homology (H0, H1) with Ripser. Significance: 50 shuffles that circularly shift each neuron's
time series independently; the threshold is the longest H1 bar seen in any shuffle (as in Gardner et al. 2022).
"""
import json
import math
from pathlib import Path

import numpy as np
import torch
from ripser import ripser
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from fit_model import Circuit, load, make_batch, heading, TYPES, D

torch.manual_seed(1); np.random.seed(1)
counts, sign, tix, ang, side, meta = load()
ck = torch.load(D / "fit_hemibrain.pt")
T, CUE = 6000, 50  # 60 s


def build(cond):
    if cond == "raw":
        return Circuit(counts, sign, tix, ang, side, mode="raw", g0=ck["raw_best"][0])
    m = Circuit(counts, sign, tix, ang, side, mode="fit")
    m.load_state_dict(ck["state"])
    if cond == "no_delta7":
        d7 = (tix == TYPES.index("D7"))
        m.C[:, d7] = 0; m.C[d7, :] = 0
    if cond == "shuffled":
        C = m.C.clone()
        for a in range(len(TYPES)):
            for b in range(len(TYPES)):
                ia = (tix == a).nonzero().flatten(); ib = (tix == b).nonzero().flatten()
                block = C[ia][:, ib].flatten()
                block = block[torch.randperm(len(block))].reshape(len(ia), len(ib))
                C[ia[:, None], ib[None, :]] = block
        m.C.copy_(C)
    return m


def simulate(m):
    with torch.no_grad():
        v, a0 = make_batch(1, T, seed=7)
        v[:, :CUE] = 0
        r, dec = m.run(v, a0, CUE)
        true = heading(v, a0, CUE)
    X = r[0, CUE:, :][:, m.epg].numpy()
    return X, true[0, CUE:].numpy(), dec[0, CUE:].numpy()


def h1(X, n=400):
    idx = np.linspace(0, len(X) - 1, n).astype(int)
    dg = ripser(X[idx], maxdim=1)["dgms"]
    life = np.sort(dg[1][:, 1] - dg[1][:, 0])[::-1] if len(dg[1]) else np.array([0.0])
    return dg, life


def null_threshold(X, k=50, n=400):
    best = 0.0
    for _ in range(k):
        Xs = np.stack([np.roll(X[:, j], np.random.randint(len(X))) for j in range(X.shape[1])], 1)
        _, life = h1(Xs, n)
        best = max(best, life[0])
    return best


results, panels = {}, []
for cond in ["fitted", "raw", "no_delta7", "shuffled"]:
    m = build(cond)
    X, true, dec = simulate(m)
    err = np.angle(np.exp(1j * (dec - true)))
    dg, life = h1(X)
    thr = null_threshold(X)
    pc = X - X.mean(0)
    U, S, Vt = np.linalg.svd(pc, full_matrices=False)
    var = (S ** 2 / (S ** 2).sum())[:3]
    results[cond] = {
        "h1_longest": float(life[0]), "h1_second": float(life[1]) if len(life) > 1 else 0.0,
        "null_threshold": float(thr), "significant_loops": int((life > thr).sum()),
        "rmse_deg": float(np.sqrt((err ** 2).mean()) * 180 / math.pi),
        "pca_var_top3": [round(float(x), 3) for x in var],
        "mean_rate": float(X.mean()),
    }
    print(cond, results[cond], flush=True)
    panels.append((cond, pc @ Vt[:2].T, true, dg, thr))

(D / "topology_check.json").write_text(json.dumps(results, indent=1))

fig, axs = plt.subplots(2, 4, figsize=(16, 7.5), dpi=130)
for k, (cond, P, true, dg, thr) in enumerate(panels):
    ax = axs[0, k]
    ax.scatter(P[::4, 0], P[::4, 1], c=np.mod(true[::4], 2 * np.pi), cmap="hsv", s=3)
    ax.set_title(f"{cond}: E-PG state, PCA 1–2\n(colour = true heading)", fontsize=9); ax.set_aspect("equal"); ax.set_xticks([]); ax.set_yticks([])
    ax = axs[1, k]
    bars = sorted([(b, d) for b, d in dg[1]], key=lambda x: -(x[1] - x[0]))[:15]
    for i, (b, d) in enumerate(bars):
        ax.plot([0, d - b], [i, i], color="#d9472b", lw=3)
    xmax = max([d - b for b, d in bars] + [thr, 1e-3]) * 1.1
    ax.axvline(thr, color="k", lw=1, ls="--")
    ax.set_xlim(0, xmax); ax.invert_yaxis(); ax.set_yticks([])
    ax.set_title(f"H1 barcode (top 15)\nshuffle threshold (lifetime) = {thr:.3f}", fontsize=9)
    ax.set_xlabel("bar lifetime (death − birth); dashed = shuffle threshold")
fig.tight_layout(); fig.savefig(D / "topology_check.png")
print("saved")
