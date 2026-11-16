"""Recover each E-PG neuron's position on the heading ring from connectivity alone.

FlyWire does not label protocerebral-bridge glomeruli, so we infer them: E-PG neurons in the same wedge share
partners, so their connectivity profiles are similar. A spectral embedding (Laplacian eigenmaps) of that
similarity places them on a circle; the angle along the circle is the wedge.

Validated on the hemibrain, where glomeruli are known (see __main__).
"""
import math

import numpy as np


def spectral_angles(counts, idx, k=8):
    """counts[post, pre] for the whole circuit; idx: indices of the neurons to place on the ring."""
    F = np.concatenate([counts[idx, :], counts[:, idx].T], 1).astype(float)   # inputs and outputs
    F = np.log1p(F)
    F /= np.linalg.norm(F, axis=1, keepdims=True) + 1e-9
    S = F @ F.T
    np.fill_diagonal(S, 0)
    # symmetric kNN graph keeps only local neighbours, so the embedding is a ring, not a blob
    A = np.zeros_like(S)
    nn = np.argsort(-S, 1)[:, :k]
    for i, row in enumerate(nn): A[i, row] = S[i, row]
    A = np.maximum(A, A.T)
    d = A.sum(1)
    L = np.eye(len(A)) - A / np.sqrt(np.outer(d, d))
    w, v = np.linalg.eigh(L)
    x, y = v[:, 1] / np.sqrt(d), v[:, 2] / np.sqrt(d)
    ang = np.arctan2(y, x)
    # spread to uniform spacing along the ring (rank order is what the embedding gets right)
    order = np.argsort(ang)
    out = np.empty(len(idx))
    out[order] = np.arange(len(idx)) * 2 * math.pi / len(idx)
    return out, w[:4]


def snap16(ang):
    return np.round(ang / (2 * math.pi / 16)) % 16 * (2 * math.pi / 16)


def align(est, ref):
    """Best rotation and reflection of est onto ref (for validation only)."""
    best = None
    for s in (1, -1):
        e = s * est
        rot = np.angle(np.mean(np.exp(1j * (ref - e))))
        err = np.angle(np.exp(1j * (e + rot - ref)))
        rms = math.degrees(np.sqrt(np.mean(err ** 2)))
        if best is None or rms < best[0]: best = (rms, s, rot, err)
    return best


if __name__ == "__main__":
    from fit_model import load
    counts, sign, tix, ang, side, meta = load("hemibrain")
    C = counts.numpy(); A = ang.numpy()
    epg = np.where(~np.isnan(A))[0]
    for k in (4, 6, 8, 12):
        est, w = spectral_angles(C, epg, k)
        rms, s, rot, err = align(est, A[epg])
        e16 = align(snap16(np.mod(s * est + rot, 2 * math.pi)), A[epg])
        print(f"k={k}: rms error {rms:.1f} deg, snapped to 16 wedges: {e16[0]:.1f} deg, exact wedge {np.mean(np.abs(e16[3]) < 1e-6):.0%}, eig {np.round(w,3)}")
