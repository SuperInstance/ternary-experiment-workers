// Cloudflare Worker: Ternary Trust Dynamics Simulator
// Tests trust formation with adjustable forgiveness rates

interface Pair {
  aId: number;
  bId: number;
  genomeA: number[];
  genomeB: number[];
  trustAtoB: number;
  trustBtoA: number;
}

function genomeCoop(genome: number[]): number {
  return genome.reduce((s, v) => s + v, 0);
}

function chooseAction(coop: number, partnerTrust: number, forgiveness: number): number {
  const trustEffect = partnerTrust > 0 ? 1 : partnerTrust < -10 ? -1 : 0;
  const forgiveEffect = partnerTrust < 0 ? forgiveness * 2 : 0;
  const score = coop + trustEffect + forgiveEffect;
  if (score > 2) return 1;
  if (score < -1) return -1;
  return 0;
}

function runTrustSim(pairs: number, rounds: number, forgivenessRate: number) {
  const state: Pair[] = Array.from({ length: pairs }, (_, i) => ({
    aId: i * 2, bId: i * 2 + 1,
    genomeA: Array.from({ length: 16 }, () => Math.random() < 0.33 ? -1 : Math.random() < 0.67 ? 0 : 1),
    genomeB: Array.from({ length: 16 }, () => Math.random() < 0.33 ? -1 : Math.random() < 0.67 ? 0 : 1),
    trustAtoB: 0, trustBtoA: 0,
  }));

  for (let r = 0; r < rounds; r++) {
    for (const pair of state) {
      const coopA = genomeCoop(pair.genomeA);
      const coopB = genomeCoop(pair.genomeB);
      const actionA = chooseAction(coopA, pair.trustAtoB, forgivenessRate);
      const actionB = chooseAction(coopB, pair.trustBtoA, forgivenessRate);

      // Update trust
      if (actionA === 1 && actionB === 1) { pair.trustAtoB += 2; pair.trustBtoA += 2; }
      else if (actionA === -1 && actionB === -1) { pair.trustAtoB -= 2; pair.trustBtoA -= 2; }
      else if (actionA === 1 && actionB === -1) { pair.trustAtoB -= 1; pair.trustBtoA += 1; }
      else if (actionA === -1 && actionB === 1) { pair.trustAtoB += 1; pair.trustBtoA -= 1; }

      // Apply forgiveness to negative trust
      if (pair.trustAtoB < 0 && actionA !== -1) pair.trustAtoB = Math.round(pair.trustAtoB * (1 - forgivenessRate));
      if (pair.trustBtoA < 0 && actionB !== -1) pair.trustBtoA = Math.round(pair.trustBtoA * (1 - forgivenessRate));
    }
  }

  const results = state.map(p => ({ trust: (p.trustAtoB + p.trustBtoA) / 2 }));
  const bonded = results.filter(r => r.trust > 50).length;
  const hostile = results.filter(r => r.trust < -50).length;
  const neutral = pairs - bonded - hostile;
  const avgTrust = results.reduce((s, r) => s + r.trust, 0) / pairs;

  return { bonded, neutral, hostile, avg_trust: Math.round(avgTrust * 100) / 100, forgiveness_rate: forgivenessRate };
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
        const numPairs = Math.min(body.pairs || 10, 20);
        const rounds = Math.min(body.rounds || 500, 1000);

        // Test multiple forgiveness rates
        const rates = [0, 0.1, 0.3, 0.5, 0.7, 1.0];
        const resultsByRate: Record<string, any> = {};
        let bestRate = 0;
        let bestBonded = -1;

        for (const rate of rates) {
          const result = runTrustSim(numPairs, rounds, rate);
          resultsByRate[rate.toString()] = result;
          if (result.bonded > bestBonded) {
            bestBonded = result.bonded;
            bestRate = rate;
          }
        }

        const overall = resultsByRate['0.5'] || resultsByRate['0.3'];

        // Store in Vectorize for cross-experiment comparison
        if (env.VECTORIZE && body.store_results) {
          const embedding = rates.map(r => resultsByRate[r.toString()]?.bonded || 0);
          await env.VECTORIZE.insert([
            { id: `trust-${Date.now()}`, values: embedding, metadata: { best_rate: bestRate, pairs: numPairs } }
          ]);
        }

        return new Response(JSON.stringify({
          ...overall,
          best_forgiveness_rate: bestRate,
          trust_by_rate: resultsByRate,
        }), { headers });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 400, headers });
      }
    }

    return new Response(JSON.stringify({
      name: 'ternary-trust-dynamics',
      usage: 'POST { pairs: 10, rounds: 500, store_results: false }',
    }), { headers });
  },
};
