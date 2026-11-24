// Seeded random numbers for Porto Verde: every load with the same seed
// builds the same city, the same traffic colours and the same pedestrians.
// Round 2: added gauss()/lerp()/clamp01() helpers for future tuning.
// They only consume RNG when called, so existing sequences are untouched.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  let spare = null; // Box-Muller spare value for gauss().
  return {
    next,
    range(min, max) { return min + next() * (max - min); },
    int(min, max) { return Math.floor(this.range(min, max + 1)); },
    pick(list) { return list[Math.floor(next() * list.length)]; },
    chance(p) { return next() < p; },
    // Approximately normal value in [-1, 1]-ish, mean 0, for jitter.
    gauss() {
      if (spare !== null) { const v = spare; spare = null; return v; }
      let u = 0, v = 0;
      while (u === 0) u = next();
      v = next();
      const r = Math.sqrt(-2 * Math.log(u));
      const t = 2 * Math.PI * v;
      spare = r * Math.sin(t);
      return r * Math.cos(t);
    },
    // Deterministic shuffle (Fisher-Yates) so spawn orders are stable too.
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

export function clamp01(v) { return Math.max(0, Math.min(1, v)); }

export function lerp(a, b, t) { return a + (b - a) * clamp01(t); }

// A tiny string hash, so a named seed ("porto-verde") still maps to a number.
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
