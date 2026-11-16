"""Export the hemibrain model for the browser: synapse counts (sparse), signs, cell types, EPG angles,
and two parameter sets (fitted cell-type gains; raw counts x one global gain).

The browser rebuilds W[post, pre] = gain[type_post][type_pre] * count * sign[pre] / norm, so ablations
(remove Delta7, shuffle within blocks) are done live on the page.
Also writes a reference trajectory so the JS simulator can be checked against PyTorch.
"""
import json
import math
from pathlib import Path

import numpy as np
import torch

from fit_model import Circuit, load, make_batch, TYPES, D, DATASET

WEB = Path(__file__).resolve().parents[2] / "compass" / "web"
WEB.mkdir(exist_ok=True)

counts, sign, tix, ang, side, meta = load()
ck = torch.load(D / f"fit_{DATASET}.pt")
m = Circuit(counts, sign, tix, ang, side, mode="fit"); m.load_state_dict(ck["state"])
norm = float(counts.sum(1).median())
SOURCES = {
    "hemibrain": "hemibrain v1.2.1 (Scheffer et al. 2020, eLife; CC-BY 4.0) via neuPrint",
    "flywire": "FlyWire v783 (Dorkenwald et al. 2024, Schlegel et al. 2024, Nature); E-PG ring positions inferred from connectivity",
}

post, pre = np.nonzero(counts.numpy())
cnt = counts.numpy()[post, pre].astype(int)


def params(model):
    return {
        "gain": torch.exp(model.log_gain).detach().numpy().round(5).tolist(),
        "bias": model.bias.detach().numpy().round(5).tolist(),
        "tau": (0.02 + torch.exp(model.log_tau)).detach().numpy().round(5).tolist(),
        "kv": round(float(torch.exp(model.log_kv)), 5),
    }


raw = Circuit(counts, sign, tix, ang, side, mode="raw", g0=ck["raw_best"][0])
out = {
    "dataset": DATASET,
    "source": SOURCES[DATASET],
    "types": TYPES,
    "neurons": [{"type": mm["type"], "glom": mm["glom"], "bodyId": mm["bodyId"],
                 "angle": None if math.isnan(float(a)) else round(float(a), 6), "side": float(s)}
                for mm, a, s in zip(meta, ang, side)],
    "sign": sign.numpy().astype(int).tolist(),
    "norm": norm,
    "edges": np.stack([post, pre, cnt], 1).tolist(),
    "dt": 0.01,
    "cueGain": 3.0,
    "params": {"fitted": params(m), "raw": params(raw)},
    "eval": {"fitted": ck["eval"], "raw": ck["raw_best"][1]},
}
(WEB / f"model_{DATASET}.json").write_text(json.dumps(out, separators=(",", ":")))

# reference run for the JS port: 300 steps, cue for 40 steps at 1 rad, then constant turning
with torch.no_grad():
    v = torch.zeros(1, 300); v[:, 40:] = 1.0
    r, dec = m.run(v, torch.tensor([1.0]), 40)
(D / ("reference_run.json" if DATASET == "hemibrain" else f"reference_run_{DATASET}.json")).write_text(json.dumps({"vel": v[0].tolist(), "cueAngle": 1.0, "cueSteps": 40,
                                                   "decoded": dec[0].numpy().round(6).tolist()}))
print("edges", len(cnt), "bytes", (WEB / f"model_{DATASET}.json").stat().st_size)
