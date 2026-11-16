"""Export the FlyWire (v783) head-direction circuit in the same format as the hemibrain export.

Inputs (public FlyWire release, downloaded separately; not in this repo):
  proofread_connections_783.feather   Zenodo 10.5281/zenodo.10676866  (Dorkenwald et al. 2024, Nature)
  neuron_annotations.tsv               flyconnectome/flywire_annotations, Supplemental_file1 (Schlegel et al. 2024)

FlyWire does not label bridge glomeruli, so E-PG positions on the ring are inferred from connectivity
(ring_order.py, validated on the hemibrain at ~7 deg RMS). The ring's handedness is fixed so that left-bridge
P-EN neurons shift the bump the same way as in the hemibrain.

Usage: python export_flywire.py /path/to/flywire_dir
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import pyarrow.feather as feather
import pyarrow.compute as pc
import pandas as pd

from ring_order import spectral_angles

D = Path(__file__).resolve().parent.parent / "data"
FW = {"EPG": "EPG", "EPGt": "EPGt", "PEN_a(PEN1)": "PEN1", "PEN_b(PEN2)": "PEN2", "PEG": "PEG", "Delta7": "D7"}
TYPES = ["EPG", "EPGt", "PEN1", "PEN2", "PEG", "D7"]
SIGN = {"EPG": 1, "EPGt": 1, "PEN1": 1, "PEN2": 1, "PEG": 1, "D7": -1}


def circmean(ang, w):
    z = (w * np.exp(1j * ang)).sum()
    return float(np.angle(z)) if abs(z) > 0 else float("nan")


def pen_offsets(C, ang, types, sides):
    """For each P-EN: phase of its E-PG outputs minus phase of its E-PG inputs, grouped by bridge side."""
    epg = np.where(types == "EPG")[0]
    out = {"L": [], "R": []}
    for i in np.where(np.isin(types, ["PEN1", "PEN2"]))[0]:
        a_in = circmean(ang[epg], C[i, epg]); a_out = circmean(ang[epg], C[epg, i])
        out[sides[i]].append(math.degrees(np.angle(np.exp(1j * (a_out - a_in)))))
    return {k: (float(np.median(v)), len(v)) for k, v in out.items()}


def main(src):
    src = Path(src)
    ann = pd.read_csv(src / "neuron_annotations.tsv", sep="\t", low_memory=False)
    ann = ann[ann.cell_type.isin(FW)].copy()
    ann["t"] = ann.cell_type.map(FW)
    ann["s"] = ann.side.str[0].str.upper()          # soma side; for P-EN / P-EG / E-PG = bridge side
    ids = ann.root_id.to_numpy()

    tbl = feather.read_table(src / "proofread_connections_783.feather", columns=["pre_pt_root_id", "post_pt_root_id", "syn_count"])
    m = pc.and_(pc.is_in(tbl["pre_pt_root_id"], value_set=pa_ids(ids)), pc.is_in(tbl["post_pt_root_id"], value_set=pa_ids(ids)))
    e = tbl.filter(m).to_pandas().groupby(["post_pt_root_id", "pre_pt_root_id"]).syn_count.sum().reset_index()
    pos = {r: i for i, r in enumerate(ids)}
    n = len(ids)
    C = np.zeros((n, n), dtype=np.int32)
    C[e.post_pt_root_id.map(pos), e.pre_pt_root_id.map(pos)] = e.syn_count.to_numpy()
    types = ann.t.to_numpy(); sides = ann.s.to_numpy()

    # 1) E-PG ring positions from connectivity
    epg = np.where(types == "EPG")[0]
    ang = np.full(n, np.nan)
    ang[epg], _ = spectral_angles(C, epg)

    # 2) handedness: in the hemibrain, left-bridge P-ENs push the bump to larger angles (see printout there)
    off = pen_offsets(C, ang, types, sides)
    print("P-EN output-minus-input phase (deg, median):", off)
    if off["L"][0] < 0:
        ang[epg] = np.mod(-ang[epg], 2 * math.pi)
        off = pen_offsets(C, ang, types, sides)
        print("reflected ->", off)

    # 3) every other neuron gets a ring phase from its E-PG partners -> an approximate bridge glomerulus (display only)
    phase = ang.copy()
    for i in range(n):
        if types[i] != "EPG":
            phase[i] = circmean(ang[epg], C[i, epg] + C[epg, i])
    def glom(i):
        w = int(round(np.mod(phase[i], 2 * math.pi) / (2 * math.pi / 16))) % 16
        s = sides[i]
        # hemibrain mapping: R_k -> wedge 2(k-1), L_k -> wedge 2(8-k)+1; invert to the nearest glomerulus on this side
        k = (w // 2 + 1) if s == "R" else (8 - (w - 1) // 2 if w % 2 else 8 - w // 2)
        return f"{s}{min(9, max(1, k))}"
    gl = [glom(i) for i in range(n)]

    # sort like the hemibrain export: type, then bridge position L9..L1, R1..R9
    key = lambda i: (TYPES.index(types[i]), (0, -int(gl[i][1:])) if gl[i][0] == "L" else (1, int(gl[i][1:])), phase[i])
    order = sorted(range(n), key=key)
    C = C[np.ix_(order, order)]
    sign = np.array([SIGN[types[i]] for i in order])
    np.savez_compressed(D / "flywire_hd.npz", counts=C, sign=sign, bodyId=ids[order])
    meta = [{"bodyId": int(ids[i]), "type": types[i], "glom": gl[i], "side": sides[i],
             "angle": None if np.isnan(ang[i]) else round(float(ang[i]), 6),
             "nt": ann.top_nt.iloc[i]} for i in order]
    (D / "flywire_hd_neurons.json").write_text(json.dumps(meta, indent=0))
    print("neurons", n, {t: int((types == t).sum()) for t in TYPES})
    print("connected pairs", int((C > 0).sum()), "synapses", int(C.sum()))
    print("predicted transmitter by type:", ann.groupby("t").top_nt.agg(lambda s: s.value_counts().to_dict()).to_dict())


def pa_ids(ids):
    import pyarrow as pa
    return pa.array(ids, type=pa.int64())


if __name__ == "__main__":
    main(sys.argv[1])
