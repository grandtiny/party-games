function xmur3(value: string): () => number {
  let hash = 1779033703 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const result = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + result) | 0;
    return (result >>> 0) / 4294967296;
  };
}

export class SeededRandom {
  readonly #next: () => number;

  constructor(seed: string) {
    const createSeed = xmur3(seed);
    this.#next = sfc32(createSeed(), createSeed(), createSeed(), createSeed());
  }

  float(): number {
    return this.#next();
  }

  integer(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error("maxExclusive must be a positive integer");
    }
    return Math.floor(this.float() * maxExclusive);
  }

  pick<T>(items: readonly T[]): T {
    const value = items[this.integer(items.length)];
    if (value === undefined) {
      throw new Error("Cannot pick from an empty collection");
    }
    return value;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = this.integer(index + 1);
      const current = result[index];
      result[index] = result[swapIndex] as T;
      result[swapIndex] = current as T;
    }
    return result;
  }
}
