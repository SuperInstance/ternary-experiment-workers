// Cloudflare Worker: Ternary Seed Stability Tester
// Tests seed mutation stability and multi-objective vs single-objective evolution

function generateSeed(size: number): number[] {
  return Array.from({ length: size }, () => Math.random() < 0.33 ? -1 : Math.random() < 0.67 ? 0 : 1);
}

function hamming(a: number[], b: number[]): number {
  return a.reduce((sum, v, i) => sum + (v !== b[i] ? 1 : 0), 0);
}

function mutate(seed: number[], rate: number): number[] {
  return seed.map(s => Math.random() < rate ? (Math.random() < 0.33 ? -1 : Math.random() < 0.67 ? 0 : 1) : s);
}

function entropy(seed: number[]): number {
  const counts = [-1, 0, 1].map(v => seed.filter(s => s === v).length);
  const total = seed.length;
  return -counts.reduce((sum, c) => {
    if (c === 0) return sum;
    const p = c / total;
    return sum - p * Math.log2(p);
  }, 0);
}

function alternation(seed: number[]): number {
  let count = 0;
  for (let i = 1; i < seed.length; i++) {
    if (seed[i] !== seed[i - 1]) count++;
  }
  return count;
}

function sumTrits(seed: number[]): number {
  return seed.reduce((s, v) => s + v, 0);
}

function dominates(a: number[], b: number[]): boolean {
  const objA = [sumTrits(a), entropy(a), alternation(a)];
  const objB = [sumTrits(b), entropy(b), alternation(b)];
  return objA.every((v, i) => v >= objB[i]) && objA.some((v, i) => v > objB[i]);
}

function runStabilityTest(seedSize: number, mutationRate: number, trials: number) {
  const baseSeed = generateSeed(seedSize);
  const hammingDistances: number[] = [];

  for (let t = 0; t < trials; t++) {
    const mutated = mutate(baseSeed, mutationRate);
    hammingDistances.push(hamming(baseSeed, mutated));
  }

  const avgHamming = hammingDistances.reduce((a, b) => a + b, 0) / trials;

  // Multi-objective evolution test (10 generations, 20 agents)
  const popSize = 20;
  let population = Array.from({ length: popSize }, () => generateSeed(seedSize));

  for (let gen = 0; gen < 10; gen++) {
    // Pareto selection
    const paretoFront = population.filter(a =>
      !population.some(b => b !== a && dominates(b, a))
    );

    // Fill remaining with offspring from Pareto front
    while (paretoFront.length < popSize) {
      const parent = paretoFront[Math.floor(Math.random() * paretoFront.length)];
      paretoFront.push(mutate(parent, 0.1));
    }
    population = paretoFront.slice(0, popSize);
  }

  const multiObjDiversity = new Set(population.map(s => s.join(','))).size;

  // Single-objective evolution for comparison
  let singlePop = Array.from({ length: popSize }, () => generateSeed(seedSize));
  for (let gen = 0; gen < 10; gen++) {
    singlePop.sort((a, b) => sumTrits(b) - sumTrits(a));
    const survivors = singlePop.slice(0, 4);
    singlePop = [...survivors];
    while (singlePop.length < popSize) {
      const parent = survivors[Math.floor(Math.random() * survivors.length)];
      singlePop.push(mutate(parent, 0.1));
    }
  }
  const singleObjDiversity = new Set(singlePop.map(s => s.join(','))).size;

  // Linear regression on hamming distances
  const slope = avgHamming / mutationRate; // linear relationship expected

  return {
    avg_hamming_distance: Math.round(avgHamming * 100) / 100,
    linear_regression_slope: Math.round(slope * 100) / 100,
    multi_obj_diversity: multiObjDiversity,
    single_obj_diversity: singleObjDiversity,
    seed_size: seedSize,
    mutation_rate: mutationRate,
    trials: trials,
  };
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' } });
    }

    if (request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const result = runStabilityTest(
          Math.min(body.seed_size || 16, 64),
          Math.min(body.mutation_rate || 0.05, 1.0),
          Math.min(body.trials || 100, 1000),
        );
        return new Response(JSON.stringify(result), { headers });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 400, headers });
      }
    }

    return new Response(JSON.stringify({
      name: 'ternary-seed-stability',
      usage: 'POST { seed_size: 16, mutation_rate: 0.05, trials: 100 }',
    }), { headers });
  },
};
