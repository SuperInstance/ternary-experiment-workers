// Cloudflare Worker: Ternary Arena Evolver
// Runs arena evolution tournaments on the edge
// Uses Vectorize for storing strategy embeddings and results

interface Agent {
  id: number;
  strategy: number[]; // -1, 0, +1 array
  fitness: number;
  wins: number;
  losses: number;
  draws: number;
}

interface MatchResult {
  agentA: number;
  agentB: number;
  scoreA: number;
  scoreB: number;
}

// Ternary RPS: +1 beats -1, -1 beats 0, 0 beats +1
function trps(a: number, b: number): [number, number] {
  if (a === b) return [1, 1]; // draw
  if ((a === 1 && b === -1) || (a === -1 && b === 0) || (a === 0 && b === 1)) return [3, 0];
  return [0, 3];
}

function playMatch(a: Agent, b: Agent, rounds: number): MatchResult {
  let scoreA = 0, scoreB = 0;
  for (let i = 0; i < rounds; i++) {
    const [sa, sb] = trps(a.strategy[i % a.strategy.length], b.strategy[i % b.strategy.length]);
    scoreA += sa;
    scoreB += sb;
  }
  return { agentA: a.id, agentB: b.id, scoreA, scoreB };
}

function mutate(strategy: number[], rate: number): number[] {
  return strategy.map(s => {
    if (Math.random() < rate) {
      const r = Math.random();
      return r < 0.33 ? -1 : r < 0.67 ? 0 : 1;
    }
    return s;
  });
}

function entropy(strategy: number[]): number {
  const counts = [-1, 0, 1].map(v => strategy.filter(s => s === v).length);
  const total = strategy.length;
  return -counts.reduce((sum, c) => {
    if (c === 0) return sum;
    const p = c / total;
    return sum - p * Math.log2(p);
  }, 0);
}

function runTournament(
  numAgents: number,
  generations: number,
  strategyLength: number
): {
  champion: number[];
  generations_run: number;
  final_diversity: number;
  history: { gen: number; diversity: number; top_fitness: number }[];
} {
  let agents: Agent[] = Array.from({ length: numAgents }, (_, i) => ({
    id: i,
    strategy: Array.from({ length: strategyLength }, () =>
      Math.random() < 0.33 ? -1 : Math.random() < 0.67 ? 0 : 1
    ),
    fitness: 0, wins: 0, losses: 0, draws: 0,
  }));

  const history: { gen: number; diversity: number; top_fitness: number }[] = [];

  for (let gen = 0; gen < generations; gen++) {
    // Round-robin
    agents.forEach(a => { a.fitness = 0; a.wins = 0; a.losses = 0; a.draws = 0; });
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const result = playMatch(agents[i], agents[j], 24);
        agents[i].fitness += result.scoreA;
        agents[j].fitness += result.scoreB;
        if (result.scoreA > result.scoreB) { agents[i].wins++; agents[j].losses++; }
        else if (result.scoreB > result.scoreA) { agents[j].wins++; agents[i].losses++; }
        else { agents[i].draws++; agents[j].draws++; }
      }
    }

    agents.sort((a, b) => b.fitness - a.fitness);

    const uniqueStrategies = new Set(agents.map(a => a.strategy.join(','))).size;
    history.push({ gen, diversity: uniqueStrategies, top_fitness: agents[0].fitness });

    // Selection + reproduction
    const survivors = agents.slice(0, Math.max(4, Math.floor(numAgents / 4)));
    const offspring: Agent[] = [];
    let nextId = numAgents;
    while (survivors.length + offspring.length < numAgents) {
      const parent = survivors[Math.floor(Math.random() * survivors.length)];
      offspring.push({
        id: nextId++,
        strategy: mutate(parent.strategy, 0.25),
        fitness: 0, wins: 0, losses: 0, draws: 0,
      });
    }
    agents = [...survivors, ...offspring].map((a, i) => ({ ...a, id: i }));
  }

  agents.sort((a, b) => b.fitness - a.fitness);
  const finalDiversity = new Set(agents.map(a => a.strategy.join(','))).size;

  return {
    champion: agents[0].strategy,
    generations_run: generations,
    final_diversity: finalDiversity,
    history,
  };
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }

    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    if (request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const agents = Math.min(body.agents || 16, 32);
        const generations = Math.min(body.generations || 10, 50);
        const strategyLength = Math.min(body.strategy_length || 8, 16);

        const result = runTournament(agents, generations, strategyLength);

        // Store embedding in Vectorize if available
        if (env.VECTORIZE && body.store_embedding) {
          const embedding = new Array(16).fill(0).map((_, i) =>
            i < result.champion.length ? (result.champion[i] + 1) / 2 : 0
          );
          await env.VECTORIZE.insert([
            { id: `arena-${Date.now()}`, values: embedding, metadata: { diversity: result.final_diversity, top_fitness: result.history[result.history.length - 1]?.top_fitness } }
          ]);
        }

        return new Response(JSON.stringify(result), { headers });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 400, headers });
      }
    }

    return new Response(JSON.stringify({
      name: 'ternary-arena-evolver',
      description: 'Run arena evolution tournaments with ternary RPS dynamics',
      usage: 'POST { agents: 16, generations: 10, strategy_length: 8, store_embedding: false }',
    }), { headers });
  },
};
