"""Export the hemibrain head-direction circuit as a signed, sorted connectivity matrix.

Cell types: EPG, EPGt, PEN_a (PEN1), PEN_b (PEN2), PEG, Delta7 (Hulse et al. 2021, eLife, Table 4).
Neurons are ordered by type, then by protocerebral-bridge glomerulus (L9..L1, R1..R9), the order in which
the bridge maps onto the ellipsoid-body ring.

Signs follow the usual assumption: EPG, PEN and PEG are cholinergic (+); Delta7 is glutamatergic and acts
through GluCl (-). These are assumptions, flagged on the page.

Run (neuPrint token is injected by the network proxy):
    NEUPRINT_APPLICATION_CREDENTIALS=proxy-injected python export_hemibrain.py
Data: hemibrain v1.2.1, CC-BY 4.0 (Scheffer et al. 2020, eLife).
"""
import json
import re
from pathlib import Path

import numpy as np
from neuprint import Client, fetch_neurons, fetch_adjacencies, NeuronCriteria as NC

OUT = Path(__file__).resolve().parent.parent / "data"
OUT.mkdir(exist_ok=True)

TYPES = ["EPG", "EPGt", "PEN_a(PEN1)", "PEN_b(PEN2)", "PEG", "Delta7"]
SHORT = {"EPG": "EPG", "EPGt": "EPGt", "PEN_a(PEN1)": "PEN1", "PEN_b(PEN2)": "PEN2", "PEG": "PEG", "Delta7": "D7"}
SIGN = {"EPG": 1, "EPGt": 1, "PEN1": 1, "PEN2": 1, "PEG": 1, "D7": -1}
TYPE_ORDER = ["EPG", "EPGt", "PEN1", "PEN2", "PEG", "D7"]


def glom_key(instance: str):
    """Return a sort key along the bridge: L9..L1 then R1..R9. Delta7 instances name several glomeruli;
    use the first one listed."""
    m = re.search(r"_([LR])(\d)", instance) or re.search(r"([LR])(\d)", instance.split("(")[-1])
    if not m:
        return (2, 0, instance)
    side, n = m.group(1), int(m.group(2))
    return (0, -n, instance) if side == "L" else (1, n, instance)


def glom_label(instance: str):
    m = re.search(r"_([LR]\d)", instance)
    return m.group(1) if m else instance.split("_")[-1]


def main():
    c = Client("neuprint.janelia.org", dataset="hemibrain:v1.2.1")
    neurons, _ = fetch_neurons(NC(type=TYPES))
    neurons["t"] = neurons["type"].map(SHORT)
    neurons["key"] = neurons["instance"].map(glom_key)
    neurons["tord"] = neurons["t"].map(TYPE_ORDER.index)
    neurons = neurons.sort_values(["tord", "key"]).reset_index(drop=True)
    ids = neurons["bodyId"].tolist()

    _, conn = fetch_adjacencies(ids, ids)  # per-ROI rows
    conn = conn.groupby(["bodyId_pre", "bodyId_post"], as_index=False)["weight"].sum()
    idx = {b: i for i, b in enumerate(ids)}
    n = len(ids)
    counts = np.zeros((n, n), dtype=np.int32)  # counts[post, pre]
    for pre, post, w in conn[["bodyId_pre", "bodyId_post", "weight"]].itertuples(index=False):
        counts[idx[post], idx[pre]] += w

    sign = np.array([SIGN[t] for t in neurons["t"]])
    np.savez_compressed(OUT / "hemibrain_hd.npz", counts=counts, sign=sign, bodyId=np.array(ids))
    meta = [{"bodyId": int(b), "type": t, "instance": inst, "glom": glom_label(inst)}
            for b, t, inst in neurons[["bodyId", "t", "instance"]].itertuples(index=False)]
    (OUT / "hemibrain_hd_neurons.json").write_text(json.dumps(meta, indent=1))

    # summary: synapses between cell types
    print(f"{n} neurons, {int((counts > 0).sum())} connected pairs, {int(counts.sum())} synapses")
    print("type-to-type synapse totals (rows = post, cols = pre):")
    tt = {a: {b: 0 for b in TYPE_ORDER} for a in TYPE_ORDER}
    ts = neurons["t"].tolist()
    for i in range(n):
        for j in range(n):
            tt[ts[i]][ts[j]] += int(counts[i, j])
    print("post\\pre " + " ".join(f"{t:>6}" for t in TYPE_ORDER))
    for a in TYPE_ORDER:
        print(f"{a:>8} " + " ".join(f"{tt[a][b]:>6}" for b in TYPE_ORDER))


if __name__ == "__main__":
    main()
