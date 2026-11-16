"""Real data check: is the population activity of mouse head-direction cells a ring, awake and in REM sleep?

Pipeline: HD cells only; spikes binned at 100 ms, square-root, Gaussian smoothing (sigma 200 ms); each moment
divided by total population activity (removes the overall gain); z-score; top 6 PCs (fit on wake); the 80% most
active moments; the densest half (Gardner et al. 2022-style denoising); 400 points evenly spaced in time;
Vietoris-Rips persistent homology (Ripser). Significance: 50 surrogates that circularly shift each cell's time
series independently, sent through the identical pipeline (PCA refit). Also exports a compact web version.

Usage: python mouse_topology.py A3710
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from ripser import ripser
from scipy.ndimage import gaussian_filter1d

D = Path(__file__).resolve().parent.parent / "data"
WEB = Path(__file__).resolve().parents[2] / "compass" / "web"
BIN = 0.1


def load(subj):
    z = np.load(D / f"mouse_hd_{subj}.npz")
    sp = np.split(z["spike_times"], np.cumsum(z["spike_lens"])[:-1])
    return sp, z


def rates(sp, intervals):
    """Smoothed, sqrt, binned rates over a list of [start, stop] intervals (concatenated)."""
    rows, t = [], []
    for a, b in intervals:
        edges = np.arange(a, b, BIN)
        if len(edges) < 20: continue
        R = np.stack([np.histogram(s, edges)[0] for s in sp], 1).astype(float)
        rows.append(gaussian_filter1d(np.sqrt(R), 2, axis=0)); t.append(edges[:-1] + BIN / 2)
    return np.concatenate(rows), np.concatenate(t)


def normalise(X):
    """Divide out the overall firing level at each moment (the population 'gain'), which otherwise dominates PC1."""
    return X / (X.sum(1, keepdims=True) + 1e-9)


def even_idx(n_total, n): return np.linspace(0, n_total - 1, n).round().astype(int)


def embed(X, ref, dims=6, keep_act=0.8, dens=0.5):
    """Gain-normalise, z-score and project onto the top `dims` PCs of `ref`; keep the 80% most active moments,
    then the densest half of those (Gardner et al. 2022-style denoising). Returns points and their time indices."""
    R = normalise(ref); mu, sd = R.mean(0), R.std(0) + 1e-9
    pcs = np.linalg.svd((R - mu) / sd, full_matrices=False)[2][:dims].T
    act = X.sum(1); keep = np.where(act >= np.quantile(act, 1 - keep_act))[0]
    Y = ((normalise(X[keep]) - mu) / sd) @ pcs
    from sklearn.neighbors import NearestNeighbors
    k = NearestNeighbors(n_neighbors=15).fit(Y).kneighbors(Y)[0][:, -1]
    m = k <= np.quantile(k, dens)
    return Y[m], keep[m]


def dgms(Y):
    d = ripser(Y, maxdim=1)["dgms"]
    return d[0], d[1]


def lifetimes(d): return np.sort(d[:, 1] - d[:, 0])[::-1] if len(d) else np.zeros(1)


def shuffle(X, rng): return np.stack([np.roll(X[:, j], rng.integers(len(X))) for j in range(X.shape[1])], 1)


def analyse(X, ref, n=400, k=50, seed=1, ref_is_self=True):
    Y, idx = embed(X, ref); sel = even_idx(len(Y), n); Y, idx = Y[sel], idx[sel]
    h0, h1 = dgms(Y); L = lifetimes(h1)
    rng = np.random.default_rng(seed); nb = []
    for _ in range(k):   # surrogates go through the identical pipeline, PCA refit on the surrogate
        S = shuffle(X, rng); Ys, _ = embed(S, S if ref_is_self else shuffle(ref, rng))
        nb.append(float(lifetimes(dgms(Ys[even_idx(len(Ys), n)])[1])[0]))
    thr = max(nb)
    return {"Y": Y, "idx": idx, "h0": h0, "h1": h1, "res": {"h1_longest": float(L[0]), "h1_second": float(L[1]),
            "threshold": thr, "significant": int((L > thr).sum()), "shuffles": k}}


def main(subj):
    sp, z = load(subj)
    Xw, tw = rates(sp, [z["wake"]]); Xr, tr = rates(sp, z["rem"])
    ok = np.isfinite(z["hd"])   # tracking gaps: interpolate cos/sin over valid samples only
    hdw = np.arctan2(np.interp(tw, z["hd_t"][ok], np.sin(z["hd"][ok])), np.interp(tw, z["hd_t"][ok], np.cos(z["hd"][ok]))) % (2 * np.pi)
    pref = np.angle((np.exp(1j * hdw)[:, None] * Xw).sum(0)) % (2 * np.pi)
    A = {"wake": analyse(Xw, Xw), "rem": analyse(Xr, Xw, ref_is_self=False)}
    for name in A: print(subj, name, A[name]["res"], flush=True)
    return Xw, Xr, hdw, tw, tr, pref, A, z


if __name__ == "__main__":
    import base64
    subj = sys.argv[1]
    Xw, Xr, hdw, tw, tr, pref, A, z = main(subj)
    (D / f"mouse_topology_{subj}.json").write_text(json.dumps({k: v["res"] for k, v in A.items()}, indent=1))
    order = np.argsort(pref)
    rnd = lambda a, d=3: np.round(np.asarray(a, float), d).tolist()
    def dg(d): return [[round(float(b), 4), (round(float(e), 4) if np.isfinite(e) else None)] for b, e in d]
    # replay: per-cell rates normalised to that cell's 99th percentile, sorted by preferred direction, as bytes
    def replay(X):
        P = np.clip(X[:, order] / (np.percentile(Xw[:, order], 99, axis=0) + 1e-9), 0, 1)
        return base64.b64encode(np.round(P * 255).astype(np.uint8).tobytes()).decode()
    turn = np.abs(np.diff(np.unwrap(hdw))); w = 600
    s0 = int(np.argmax(np.convolve(turn, np.ones(w), "valid")))
    rb = z["rem"][np.argmax(z["rem"][:, 1] - z["rem"][:, 0])]; rr = np.where((tr >= rb[0]) & (tr < rb[1]))[0][:w]
    out = {
        "source": str(z["meta"][3]), "subject": subj, "session": str(z["meta"][2]), "cells": int(Xw.shape[1]), "bin": BIN,
        "pref": rnd(pref[order], 4),
        "wake": {"Y": rnd(A["wake"]["Y"]), "hd": rnd(hdw[A["wake"]["idx"]]), "h0": dg(A["wake"]["h0"]), "h1": dg(A["wake"]["h1"]), **A["wake"]["res"]},
        "rem": {"Y": rnd(A["rem"]["Y"]), "h0": dg(A["rem"]["h0"]), "h1": dg(A["rem"]["h1"]), **A["rem"]["res"]},
        "replayWake": {"R": replay(Xw[s0:s0 + w]), "hd": rnd(hdw[s0:s0 + w]), "n": w},
        "replayRem": {"R": replay(Xr[rr]), "n": int(len(rr))},
    }
    (WEB / f"mouse_{subj}.json").write_text(json.dumps(out, separators=(",", ":")))
    print("web bytes", (WEB / f"mouse_{subj}.json").stat().st_size)
