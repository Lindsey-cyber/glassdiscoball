export function seedFromURL() {
  const value = new URLSearchParams(location.search).get('seed');
  return value === null ? crypto.getRandomValues(new Uint32Array(1))[0] : Number(value) >>> 0;
}
export function random(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  next.normal = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, next()))) * Math.cos(2 * Math.PI * next());
  return next;
}
