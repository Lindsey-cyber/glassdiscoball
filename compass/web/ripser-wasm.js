// Run Ripser (Ulrich Bauer, MIT) compiled to WebAssembly/WASI, from a browser Web Worker or Node.
// Input: an array of points (arrays of numbers). Output: { dims: [[ [birth, death], ... ], ...] }.
// The binary is the unmodified Ripser algorithm; only stdin/stdout are wired up here.

export async function loadRipser(url) {
  const bytes = typeof url === "string" ? await (await fetch(url)).arrayBuffer() : url;
  return WebAssembly.compile(bytes);
}

export async function ripser(module, points, { dim = 1, threshold = null } = {}) {
  const input = new TextEncoder().encode(points.map(p => p.join(",")).join("\n") + "\n");
  const args = ["ripser", "--format", "point-cloud", "--dim", String(dim)];
  if (threshold !== null) args.push("--threshold", String(threshold));
  let out = "", err = "", pos = 0, memory;
  const dec = new TextDecoder();
  const view = () => new DataView(memory.buffer);
  class Exit extends Error { constructor(code) { super("exit " + code); this.code = code; } }
  const strs = args.map(a => new TextEncoder().encode(a + "\0"));
  const wasi = {
    args_sizes_get(argc, bufSize) { view().setUint32(argc, strs.length, true); view().setUint32(bufSize, strs.reduce((s, a) => s + a.length, 0), true); return 0; },
    args_get(argv, buf) { const m = new Uint8Array(memory.buffer); let o = buf; strs.forEach((s, i) => { view().setUint32(argv + 4 * i, o, true); m.set(s, o); o += s.length; }); return 0; },
    environ_sizes_get(c, s) { view().setUint32(c, 0, true); view().setUint32(s, 0, true); return 0; },
    environ_get() { return 0; },
    fd_fdstat_get(fd, p) { const v = view(); v.setUint8(p, fd <= 2 ? 2 : 0); v.setUint16(p + 2, 0, true); v.setBigUint64(p + 8, 0n, true); v.setBigUint64(p + 16, 0n, true); return 0; },
    fd_seek() { return 70; },            // ESPIPE: streams are not seekable
    fd_close() { return 0; },
    fd_read(fd, iovs, n, nread) {
      const v = view(), m = new Uint8Array(memory.buffer); let total = 0;
      for (let i = 0; i < n; i++) {
        const ptr = v.getUint32(iovs + 8 * i, true), len = v.getUint32(iovs + 8 * i + 4, true);
        const k = Math.min(len, input.length - pos); m.set(input.subarray(pos, pos + k), ptr); pos += k; total += k;
        if (k < len) break;
      }
      v.setUint32(nread, total, true); return 0;
    },
    fd_write(fd, iovs, n, nwritten) {
      const v = view(); let total = 0;
      for (let i = 0; i < n; i++) {
        const ptr = v.getUint32(iovs + 8 * i, true), len = v.getUint32(iovs + 8 * i + 4, true);
        const s = dec.decode(new Uint8Array(memory.buffer, ptr, len));
        if (fd === 1) out += s; else err += s; total += len;
      }
      v.setUint32(nwritten, total, true); return 0;
    },
    proc_exit(code) { throw new Exit(code); },
  };
  const inst = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: wasi });
  memory = inst.exports.memory;
  try { inst.exports._start(); } catch (e) { if (!(e instanceof Exit) || e.code !== 0) throw new Error("ripser failed: " + (err || e.message)); }
  return parse(out);
}

// Ripser prints "persistence intervals in dim k:" followed by lines " [b,d)" or " [b, )" for infinite bars.
export function parse(text) {
  const dims = [];
  let cur = null;
  for (const line of text.split("\n")) {
    const h = line.match(/persistence intervals in dim (\d+)/);
    if (h) { cur = []; dims[+h[1]] = cur; continue; }
    const m = line.match(/\[([^,]*),\s*([^)]*)\)/);
    if (m && cur) cur.push([parseFloat(m[1]), m[2].trim() === "" ? Infinity : parseFloat(m[2])]);
  }
  return { dims };
}
