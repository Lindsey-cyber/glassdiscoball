"""Long-horizon fine-tuning against drift: 6 s trials, a third of them with the fly standing still, so the
bump must hold its position (a continuous attractor) as well as integrate velocity. Kept only if the
20 s evaluation improves. Usage: COMPASS_DATA=flywire python finetune_long.py [--steps 300] [--lr 0.004]"""
import argparse
import torch
from fit_model import Circuit, load, evaluate, make_batch, heading, D, DATASET

ap = argparse.ArgumentParser(); ap.add_argument("--steps", type=int, default=300); ap.add_argument("--lr", type=float, default=0.004)
ap.add_argument("--T", type=int, default=600); ap.add_argument("--B", type=int, default=12)
a = ap.parse_args()
torch.manual_seed(5)
counts, sign, tix, ang, side, meta = load()
ck = torch.load(D / f"fit_{DATASET}.pt")
m = Circuit(counts, sign, tix, ang, side, mode="fit"); m.load_state_dict(ck["state"])
ev20 = lambda: evaluate(m, B=16, T=2000)
best = ck.get("eval20") or ev20(); print("before 20 s:", best, flush=True)
opt = torch.optim.Adam(m.parameters(), lr=a.lr); cue = 40
for s in range(a.steps):
    v, a0 = make_batch(a.B, a.T); v[:, :cue] = 0; v[: a.B // 3] = 0
    r, dec = m.run(v, a0, cue)
    true = heading(v, a0, cue)
    track = (1 - torch.cos(dec - true))[:, cue:].mean()
    epg = r[..., m.epg]
    amp = torch.sqrt((r * m.cosA).sum(-1) ** 2 + (r * m.sinA).sum(-1) ** 2) / epg.sum(-1).clamp(min=1e-6)
    loss = track + torch.relu(0.4 - amp).mean() + 0.1 * (torch.relu(epg.mean() - 0.6) + torch.relu(0.05 - epg.mean()))
    opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(m.parameters(), 1.0); opt.step()
    if s % 25 == 0 or s == a.steps - 1:
        print(f"step {s} track {track.item():.4f}", flush=True)
    if (s + 1) % 75 == 0:
        e = ev20(); print("  20 s:", round(e["rmse_deg"], 1), flush=True)
        if e["rmse_deg"] < best["rmse_deg"]:
            best = e; ck.update(state={k: v.clone() for k, v in m.state_dict().items()}, eval=evaluate(m), eval20=e)
            torch.save(ck, D / f"fit_{DATASET}.pt"); print("  saved", ck["eval"], flush=True)
print("best 20 s:", best)
