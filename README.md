# Ternary Experiment Workers

**Ternary Experiment Workers** is a collection of Cloudflare Worker applications that run live, public-facing ternary computation experiments — including an arena-based strategy evolver, seed stability analysis, and trust dynamics simulation. Each experiment runs as an independent Worker with its own subdomain.

## Why It Matters

Ternary computation research needs reproducible, live experiments that the community can observe in real time — not just static papers describing past results. By deploying experiments as Cloudflare Workers, each experiment gets a public URL where visitors can see live data, interact with parameters, and watch ternary dynamics unfold. The arena evolver runs continuous genetic optimization of ternary strategies; seed stability tests whether the same initial conditions produce the same outcomes; trust dynamics models how {-1, 0, +1} trust scores propagate through agent networks. These experiments are the empirical backbone of the SuperInstance thesis.

## How It Works

### Arena Evolver

The arena evolver runs an ongoing genetic algorithm over ternary strategy spaces:

```
Population → Evaluate → Select → Crossover → Mutate → Repeat
```

Each generation:
1. **Evaluate**: Score each strategy against the fitness landscape (O(P·L), P = pop size, L = strategy length)
2. **Select**: Tournament selection preserves diversity
3. **Crossover**: Single-point crossover of ternary vectors (O(L))
4. **Mutate**: Flip each trit with probability μ (O(L))

The arena publishes live results: best fitness per generation, population diversity, and convergence plots.

### Seed Stability

Given an initial random seed, does the experiment always produce the same outcome?

```
for seed in [42, 42, 42, ...]:
    result = run_experiment(seed)
    assert all_equal(result)  // deterministic?
```

Non-determinism indicates hidden state or floating-point nondeterminism — critical bugs in reproducible research.

### Trust Dynamics

Models how trust scores ∈ {−1, 0, +1} propagate through a network of N agents:

```
trust(i→j, t+1) = f(trust(i→j, t), trust(neighbors→j, t))
```

Key measurements:
- **Convergence time**: ticks until the network reaches a stable trust configuration
- **Trust polarization**: whether the network splits into +1 and −1 factions
- **Zero-propagation**: how the neutral state (0) spreads or contracts

Complexity: O(N²) per tick for dense trust matrices.

## Quick Start

```bash
# Deploy all experiment workers
cd arena-evolver && npx wrangler deploy
cd ../seed-stability && npx wrangler deploy
cd ../trust-dynamics && npx wrangler deploy

# Local development
cd arena-evolver && npx wrangler dev
```

Each Worker serves a live experiment dashboard at its URL.

## API

| Worker | Path | Description |
|--------|------|-------------|
| `arena-evolver` | `/` | Live genetic algorithm arena |
| `arena-evolver` | `/api/status` | Current generation, best fitness |
| `seed-stability` | `/` | Determinism test results |
| `seed-stability` | `/api/run` | Trigger a new seed run |
| `trust-dynamics` | `/` | Trust propagation visualization |
| `trust-dynamics` | `/api/network` | Agent trust network state |

## Architecture Notes

The experiment workers provide the empirical evidence for the γ + η = C framework. The arena evolver tests whether ternary strategies can be evolved (γ — construction via genetic search). Seed stability tests η — the reproducibility of results, ensuring no hidden randomness. Trust dynamics models how γ and η labels propagate through social networks, measuring the competence C that emerges from collective judgment. Each experiment is stateless at the edge — state persists in Durable Objects or KV. See [ARCHITECTURE.md](https://github.com/SuperInstance/SuperInstance/blob/main/ARCHITECTURE.md).

## References

1. Holland, J. H. (1975). *Adaptation in Natural and Artificial Systems*. University of Michigan Press. — Genetic algorithms.
2. Jøsang, A., Ismail, R., & Boyd, C. (2007). "A Survey of Trust and Reputation Systems for Online Service Provision." *Decision Support Systems*, 43(2), 618–644.
3. Cloudflare. (2024). *Durable Objects Documentation*. — Stateful edge compute for experiment persistence.

## License

MIT
