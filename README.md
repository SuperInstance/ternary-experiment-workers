# Ternary Experiment Workers

Three Cloudflare Workers for running ternary experiments on the edge. Designed for the free tier (100K requests/day, 10ms CPU time per invocation).

## Workers

### 1. Arena Evolver (`arena-evolver/`)
Runs mini arena evolution tournaments with ternary RPS rules (Pos>Neg, Neg>Zero, Zero>Pos). Evolves top performers through mutation across generations.

### 2. Seed Stability (`seed-stability/`)
Tests seed mutation stability by measuring Hamming distances across mutations. Compares multi-objective vs single-objective diversity.

### 3. Trust Dynamics (`trust-dynamics/`)
Simulates trust formation between pairs with adjustable forgiveness rates. Tests how different forgiveness rates affect bonding vs hostility.

## Deploy

```bash
# Install wrangler globally if needed
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy each worker
cd arena-evolver && wrangler deploy
cd ../seed-stability && wrangler deploy
cd ../trust-dynamics && wrangler deploy
```

## Usage

All workers accept POST requests with JSON bodies. See each worker's source for parameter details.

### Arena Evolver
```bash
curl -X POST https://ternary-arena-evolver.<your-subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"agents":16,"generations":20,"strategy_length":8}'
```

### Seed Stability
```bash
curl -X POST https://ternary-seed-stability.<your-subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"seed_size":16,"mutation_rate":0.1,"trials":100}'
```

### Trust Dynamics
```bash
curl -X POST https://ternary-trust-dynamics.<your-subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"pairs":10,"rounds":100,"forgiveness_rate":0.3}'
```

## Constraints

- Free tier: 100K requests/day, 10ms CPU, 128MB RAM
- No external dependencies
- Pure math, Web Standards API only
- Small population sizes recommended for arena-evolver to stay within CPU budget
