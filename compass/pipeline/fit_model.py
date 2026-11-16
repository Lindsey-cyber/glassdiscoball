"""Phase 1: a connectome-constrained rate model of the fly head-direction circuit (hemibrain).

  tau_type * dr/dt = -r + sigmoid(W r + b_type + I)        (rates bounded in [0, 1], as in Duan et al. 2025)
  W[post, pre] = gain[type_post, type_pre] * counts[post, pre] * sign[pre] / NORM

Only cell-type-level parameters are trained (36 gains, 6 biases, 6 time constants, 1 velocity gain); the
wiring itself (152 x 152 synapse counts) comes from the hemibrain and is never changed.

Task (path integration in darkness): a brief visual cue places the bump at a random heading, then the cue is
removed and an angular-velocity signal drives the left/right PEN neurons. The heading decoded from the EPG
population vector must track the integrated heading.

Baseline: the same network with one global gain on the raw synapse counts (gain sweep).

Usage: python fit_model.py [--steps 600]
"""
import argparse
import json
import math
import os
from pathlib import Path

import numpy as np
import torch

torch.set_num_threads(4)
D = Path(__file__).resolve().parent.parent / "data"
TYPES = ["EPG", "EPGt", "PEN1", "PEN2", "PEG", "D7"]
DT = 0.01  # s
DATASET = os.environ.get("COMPASS_DATA", "hemibrain")   # "hemibrain" or "flywire"


def load(name=None):
    name = name or DATASET
    z = np.load(D / f"{name}_hd.npz")
    meta = json.loads((D / f"{name}_hd_neurons.json").read_text())
    counts = torch.tensor(z["counts"], dtype=torch.float32)
    sign = torch.tensor(z["sign"], dtype=torch.float32)
    tix = torch.tensor([TYPES.index(m["type"]) for m in meta])
    gl = [m["glom"] for m in meta]
    ang = torch.full((len(meta),), float("nan"))
    for i, m in enumerate(meta):
        if m["type"] != "EPG": continue
        if "angle" in m:            # FlyWire: inferred from connectivity (ring_order.py)
            ang[i] = m["angle"]; continue
        # hemibrain: 16 EB wedges, right glomeruli on even wedges, left on odd ones (from EPG<->EPG pairing)
        s, k = gl[i][0], int(gl[i][1])
        idx = 2 * (k - 1) if s == "R" else 2 * (8 - k) + 1
        ang[i] = idx * 2 * math.pi / 16
    # PEN side: left-bridge PENs get +velocity, right-bridge PENs get -velocity
    side = torch.tensor([(1.0 if (m.get("side") or g)[0] == "L" else -1.0) if m["type"] in ("PEN1", "PEN2") else 0.0
                         for g, m in zip(gl, meta)])
    return counts, sign, tix, ang, side, meta


class Circuit(torch.nn.Module):
    def __init__(self, counts, sign, tix, ang, side, mode="fit", g0=1.0):
        super().__init__()
        # normalise so the median neuron receives ~1 unit of total |input| at full activity
        self.register_buffer("C", counts * sign[None, :] / counts.sum(1).median())
        self.register_buffer("tix", tix)
        self.register_buffer("side", side)
        epg = ~torch.isnan(ang)
        self.register_buffer("epg", epg)
        self.register_buffer("cosA", torch.where(epg, torch.cos(ang), torch.zeros_like(ang)))
        self.register_buffer("sinA", torch.where(epg, torch.sin(ang), torch.zeros_like(ang)))
        self.mode = mode
        n_t = len(TYPES)
        if mode == "fit":
            self.log_gain = torch.nn.Parameter(torch.full((n_t, n_t), math.log(g0)) + 0.1 * torch.randn(n_t, n_t))
            self.bias = torch.nn.Parameter(torch.full((n_t,), -2.0))
            self.log_tau = torch.nn.Parameter(torch.full((n_t,), math.log(0.05)))
            self.log_kv = torch.nn.Parameter(torch.tensor(0.0))
        else:  # raw: one global gain, fixed bias/tau
            self.register_buffer("log_gain", torch.full((n_t, n_t), math.log(g0)))
            self.register_buffer("bias", torch.full((n_t,), -2.0))
            self.register_buffer("log_tau", torch.full((n_t,), math.log(0.05)))
            self.register_buffer("log_kv", torch.tensor(0.0))

    def W(self):
        G = torch.exp(self.log_gain)[self.tix][:, self.tix]
        return G * self.C

    def run(self, vel, cue_ang, cue_steps, r0=None, cue_gain=3.0):
        """vel: (B, T) rad/s; cue_ang: (B,). Returns EPG rates (B, T, N) and decoded heading (B, T)."""
        B, T = vel.shape
        N = self.C.shape[0]
        W = self.W()
        b = self.bias[self.tix]
        tau = (0.02 + torch.exp(self.log_tau))[self.tix]
        kv = torch.exp(self.log_kv)
        r = torch.zeros(B, N) if r0 is None else r0
        cue = cue_gain * (torch.cos(cue_ang)[:, None] * self.cosA + torch.sin(cue_ang)[:, None] * self.sinA).clamp(min=0)
        out, dec = [], []
        for t in range(T):
            I = kv * vel[:, t:t + 1] * self.side
            if t < cue_steps: I = I + cue
            r = r + DT / tau * (-r + torch.sigmoid(r @ W.T + b + I))
            out.append(r)
            x = (r * self.cosA).sum(1); y = (r * self.sinA).sum(1)
            dec.append(torch.atan2(y, x))
        return torch.stack(out, 1), torch.stack(dec, 1)


def make_batch(B, T, seed=None):
    g = torch.Generator().manual_seed(seed) if seed is not None else None
    # Ornstein-Uhlenbeck angular velocity, sd ~ 1.5 rad/s
    v = torch.zeros(B, T)
    x = torch.zeros(B)
    for t in range(T):
        x = x + DT * (-x / 0.3) + math.sqrt(2 * DT / 0.3) * 1.5 * torch.randn(B, generator=g)
        v[:, t] = x
    a0 = torch.rand(B, generator=g) * 2 * math.pi
    return v, a0


def heading(v, a0, cue_steps):
    v = v.clone(); v[:, :cue_steps] = 0
    return a0[:, None] + torch.cumsum(v, 1) * DT


def evaluate(model, B=32, T=400, cue_steps=50, seed=123):
    with torch.no_grad():
        v, a0 = make_batch(B, T, seed)
        v[:, :cue_steps] = 0
        r, dec = model.run(v, a0, cue_steps)
        true = heading(v, a0, cue_steps)
        err = torch.atan2(torch.sin(dec - true), torch.cos(dec - true))[:, cue_steps:]
        epg = r[:, cue_steps:, :][..., model.epg]
        amp = torch.sqrt((r * model.cosA).sum(-1) ** 2 + (r * model.sinA).sum(-1) ** 2)[:, cue_steps:] / epg.sum(-1).clamp(min=1e-6)
        return {
            "rmse_deg": float(torch.sqrt((err ** 2).mean()) * 180 / math.pi),
            "final_err_deg": float(err[:, -1].abs().mean() * 180 / math.pi),
            "bump_contrast": float(amp.mean()),
            "mean_rate": float(epg.mean()),
        }


def train(model, steps, B=24, T=200, cue_steps=40, lr=0.03):
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    for s in range(steps):
        v, a0 = make_batch(B, T)
        v[:, :cue_steps] = 0
        r, dec = model.run(v, a0, cue_steps)
        true = heading(v, a0, cue_steps)
        loss_track = (1 - torch.cos(dec - true))[:, cue_steps // 2:].mean()
        epg = r[..., model.epg]
        amp = torch.sqrt((r * model.cosA).sum(-1) ** 2 + (r * model.sinA).sum(-1) ** 2) / epg.sum(-1).clamp(min=1e-6)
        loss_bump = torch.relu(0.4 - amp).mean()            # a single, clear bump
        loss_rate = torch.relu(epg.mean() - 0.6) + torch.relu(0.05 - epg.mean())  # sensible activity range
        loss = loss_track + loss_bump + 0.1 * loss_rate
        opt.zero_grad(); loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        if s % 25 == 0 or s == steps - 1:
            print(f"step {s:4d}  loss {loss.item():.4f}  track {loss_track.item():.4f}  bump {loss_bump.item():.4f}", flush=True)
    return model


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=600)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    torch.manual_seed(a.seed)
    counts, sign, tix, ang, side, meta = load()

    print("== baseline: raw synapse counts x one global gain ==")
    best = None
    for g0 in [1, 2, 4, 8, 16, 32, 64]:
        m = Circuit(counts, sign, tix, ang, side, mode="raw", g0=g0)
        ev = evaluate(m); print(f"g0={g0:<5} {ev}")
        if best is None or ev["rmse_deg"] < best[1]["rmse_deg"]: best = (g0, ev)
    print("best raw:", best)

    print("== fitted: cell-type gains ==")
    model = Circuit(counts, sign, tix, ang, side, mode="fit", g0=4.0)
    train(model, a.steps)
    ev = evaluate(model); print("fitted:", ev)
    torch.save({"state": model.state_dict(), "eval": ev, "raw_best": best}, D / f"fit_{DATASET}.pt")


if __name__ == "__main__":
    main()
