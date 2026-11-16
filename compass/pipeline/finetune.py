"""Continue training a fitted model at a lower learning rate; keep the result only if evaluation improves.
Usage: COMPASS_DATA=flywire python finetune.py [--steps 400] [--lr 0.01] [--T 300]"""
import argparse
import torch
from fit_model import Circuit, load, train, evaluate, D, DATASET

ap = argparse.ArgumentParser(); ap.add_argument("--steps", type=int, default=400); ap.add_argument("--lr", type=float, default=0.01); ap.add_argument("--T", type=int, default=300)
a = ap.parse_args()
torch.manual_seed(3)
counts, sign, tix, ang, side, meta = load()
ck = torch.load(D / f"fit_{DATASET}.pt")
m = Circuit(counts, sign, tix, ang, side, mode="fit"); m.load_state_dict(ck["state"])
print("before:", ck["eval"])
train(m, a.steps, T=a.T, lr=a.lr)
ev = evaluate(m); print("after:", ev)
if ev["rmse_deg"] < ck["eval"]["rmse_deg"]:
    ck.update(state=m.state_dict(), eval=ev); torch.save(ck, D / f"fit_{DATASET}.pt"); print("saved")
