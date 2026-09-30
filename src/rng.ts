// Random numbers for generated data. Without a seed they come from crypto; with one they come from
// a small deterministic generator, so the same seed gives the same data on every run.

export type Random = (max: number) => number; // an integer in [0, max), or 0 when max <= 0

export const secureRandom: Random = max => max > 0 ? crypto.getRandomValues(new Uint32Array(1))[0] % max : 0;

// cyrb128 turns the seed text into four 32-bit words; sfc32 turns those into a stream.
function hash(text: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export function seededRandom(seed: string): Random {
  let [a, b, c, d] = hash(seed);
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
  return max => max > 0 ? Math.floor(next() * max) : 0;
}

// A seed of only spaces counts as no seed.
export const randomFor = (seed?: string, scope = ''): Random => seed?.trim() ? seededRandom(`${seed.trim()}|${scope}`) : secureRandom;
export const pickWith = <T>(random: Random, choices: readonly T[]): T => choices[random(choices.length)];
