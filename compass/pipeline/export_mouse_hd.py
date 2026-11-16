"""Stream head-direction cell spikes and head direction from one DANDI 000939 session (mouse postsubiculum,
Duszkiewicz et al. 2024, Nat Neurosci; CC-BY 4.0) without downloading the ~25 GB raw recording.
HTTP range requests (remfile + h5py) read only the units table, head direction, epochs and sleep states.

Usage: python export_mouse_hd.py <asset_id> [<asset_id> ...]   (prints the HD-cell count per session)
       python export_mouse_hd.py --save <asset_id>
"""
import subprocess
import sys
from pathlib import Path

import h5py
import numpy as np
import remfile

D = Path(__file__).resolve().parent.parent / "data"


def open_asset(aid):
    url = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w", "%{redirect_url}",
                          f"https://api.dandiarchive.org/api/assets/{aid}/download/"], capture_output=True, text=True).stdout
    return h5py.File(remfile.File(url), "r")


def main(args):
    save = args[0] == "--save"
    for aid in [a for a in args if not a.startswith("--")]:
        f = open_asset(aid)
        u = f["units"]
        hd_flag = u["is_head_direction"][:].astype(bool)
        sess = f["general/session_id"][()].decode() if isinstance(f["general/session_id"][()], bytes) else str(f["general/session_id"][()])
        subj = f["general/subject/subject_id"][()]
        subj = subj.decode() if isinstance(subj, bytes) else str(subj)
        print(aid, subj, sess, "units", len(hd_flag), "HD cells", int(hd_flag.sum()), flush=True)
        if not save: continue
        idx = u["spike_times_index"][:]
        st = u["spike_times"][:]
        starts = np.concatenate([[0], idx[:-1]])
        spikes = [st[a:b].astype(np.float64) for a, b, k in zip(starts, idx, hd_flag) if k]
        tags = [t.decode() for t in f["intervals/epochs/tags"][:]]
        ep = dict(zip(tags, zip(f["intervals/epochs/start_time"][:], f["intervals/epochs/stop_time"][:])))  # last wins for repeated tags
        wake = ep["wake_square"]
        ss = f["intervals/sleep_states"]
        state = np.array([s.decode() for s in ss["state"][:]])
        rem = np.stack([ss["start_time"][:], ss["stop_time"][:]], 1)[state == "rem"].astype(np.float64)
        hd = f["processing/behavior/CompassDirection/head-direction"]
        ht, hv = hd["timestamps"][:], hd["data"][:]
        keep = (ht >= wake[0]) & (ht <= wake[1])
        lens = np.array([len(s) for s in spikes])
        np.savez_compressed(D / f"mouse_hd_{subj}.npz", spike_times=np.concatenate(spikes), spike_lens=lens,
                            wake=np.array(wake), rem=rem, hd_t=ht[keep], hd=hv[keep],
                            meta=np.array([aid, subj, sess, "DANDI:000939 (Duszkiewicz et al. 2024, Nat Neurosci, doi:10.1038/s41593-024-01588-5), CC-BY 4.0"]))
        print("saved", D / f"mouse_hd_{subj}.npz", "wake s", round(wake[1] - wake[0]), "REM s", round(float((rem[:, 1] - rem[:, 0]).sum())))


if __name__ == "__main__":
    main(sys.argv[1:])
