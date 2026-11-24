// random.js — deterministic seeded RNG for Porto Verde (mulberry32).
// Every procedural choice in the city, traffic and pedestrians flows from
// one seed so the same seed always builds the same Porto Verde.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class RNG {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.nextFloat = mulberry32(this.seed);
  }

  // Float in [0, 1).
  float() {
    return this.nextFloat();
  }

  // Float in [min, max).
  range(min, max) {
    return min + this.nextFloat() * (max - min);
  }

  // Integer in [min, max] inclusive.
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // True with probability p (0..1).
  chance(p) {
    return this.nextFloat() < p;
  }

  pick(arr) {
    return arr[Math.floor(this.nextFloat() * arr.length)];
  }

  // Pick one entry from [value, weight] pairs, weighted by weight.
  weightedPick(pairs) {
    let total = 0;
    for (const [, w] of pairs) total += w;
    let roll = this.nextFloat() * total;
    for (const [v, w] of pairs) {
      roll -= w;
      if (roll <= 0) return v;
    }
    return pairs[pairs.length - 1][0];
  }

  // Fisher-Yates shuffle, returns a new array.
  shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.nextFloat() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  // Fork a child RNG with its own independent stream.
  fork(salt) {
    return new RNG((this.seed ^ hashString(String(salt))) >>> 0);
  }
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
