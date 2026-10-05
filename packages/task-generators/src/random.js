"use strict";

// Deterministic RNG: the same seed always gives the same task, so a variant
// can be re-created from its seed and a student can be shown "variant 1234".
function hashSeed(seed) {
  const text = String(seed);
  let h = 1779033703 ^ text.length;

  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function createRng(seed) {
  let a = hashSeed(seed);

  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng = {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    intExcept(min, max, excluded) {
      const banned = new Set([].concat(excluded));
      let value;
      do {
        value = rng.int(min, max);
      } while (banned.has(value));
      return value;
    },
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    shuffle(items) {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    sign() {
      return next() < 0.5 ? -1 : 1;
    }
  };

  return rng;
}

module.exports = {
  createRng,
  hashSeed
};
