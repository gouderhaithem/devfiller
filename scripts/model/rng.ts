// A seeded generator (mulberry32): the same seed gives the same splits, variants and model.
export interface Rng { next(): number; int(n: number): number; shuffle<T>(list: T[]): T[] }
export function rng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const shuffle = <T>(list: T[]) => { for (let i = list.length - 1; i > 0; i--) { const j = int(i + 1); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  return { next, int, shuffle };
}
