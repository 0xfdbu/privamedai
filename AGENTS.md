# AGENTS.md — PrivaMedAI (Midnight ZK Medical Credentials)

## Project Overview
Hackathon demo on **Midnight Preprod** — real ZK SNARK proofs + real on-chain verification. Compact smart contract (12 circuits) + React/Vite frontend + proof server.

## Monorepo Structure (npm workspaces)
| Workspace | Path | Purpose |
|-----------|------|---------|
| contract | `contract/` | Compact smart contract + TypeScript bindings |
| frontend | `frontend/` | React/Vite UI (port 5173) |
| api | `api/` | API layer |
| boilerplate/contract-cli | `boilerplate/contract-cli/` | Auto-generated CLI |
| boilerplate/scripts | `boilerplate/scripts/` | Auto-generator + wallet/faucet scripts |

**Frontend depends on `@midnight-ntwrk/contract` via `file:../contract`** — contract must be built before frontend can compile.

## Critical Commands

### Setup & Dev (run from root)
```bash
npm install                              # install all workspace deps
npm run dev                              # CRITICAL: sets compactc PATH, cleans managed/, compiles contract, generates CLI
cd frontend && npm run dev               # start Vite dev server (localhost:5173)
```

**`npm run dev` at root is the only correct way to compile the contract for dev.** It does:
1. Adds `~/.compact/versions/0.30.0/x86_64-unknown-linux-musl` to PATH
2. Removes `contract/src/managed/*`
3. Runs `boilerplate/scripts/auto-generator.js` (syncs .compact, compiles, builds, generates CLI)

### Contract-only (from `contract/`)
```bash
npm run compact   # compile .compact → managed/
npm run build     # tsc + copy managed/ to dist/
npm run dev       # compact + build combined
npm run typecheck # tsc --noEmit
```

### Frontend (from `frontend/`)
```bash
npm run dev       # Vite dev server
npx tsc --noEmit  # type check
npm run build     # production build
```

### Tests
```bash
npx vitest run                                    # all tests (root)
npx vitest run tests/contract-tests.ts            # contract logic (41 tests, ~500ms)
npx vitest run tests/proof-verification.test.ts   # ZK proof artifacts (54 tests)
npx vitest run tests/integration-tests.ts         # E2E (14 tests, SKIPPED — need network)
```
- Vitest timeouts: 300s test, 180s hook — ZK operations are slow
- Integration tests are skipped by default; require proof server + preprod indexer + funded wallet
- Contract tests use `PrivaMedAISimulator` — no network needed

### Deploy & CLI (from root)
```bash
npm run deploy:privamedai    # npx tsx scripts/deploy-privamedai.ts
npm run cli:privamedai       # npx tsx scripts/cli-privamedai.ts
npm run wallet               # generate keypair
npm run faucet               # request tDUST from faucet
npm run balance              # check balance
```

## External Dependencies
- **Proof server** must run on `localhost:6300` for ZK proof generation. Without it, proof tests and frontend proof features fail.
- **Lace Wallet** browser extension for transaction signing
- **compactc** compiler (installed via Midnight tools at `~/.compact/versions/0.30.0/`)
- **Midnight Preprod indexer** for on-chain state queries

## Environment
- Root `.env` contains `WALLET_SEED` and `WALLET_ADDRESS` (copied from `.env.example`)
- Frontend uses `VITE_CONTRACT_ADDRESS`, `VITE_NETWORK_ID`, `VITE_PROOF_SERVER_URL`
- Wallet state files (`.wallet-state.json`, `.wallet-state-setup.json`) are gitignored

## Key Architecture Facts
- Single contract file: `contract/src/PrivaMedAI.compact`
- Contract entry: `contract/src/index.ts` dynamically loads the .compact file and re-exports from `witnesses-privamedai.ts`
- ZK artifacts (prover keys ~2.8MB, verifier keys ~2KB, ZKIR files) live in `contract/src/managed/PrivaMedAI/`
- 3 selective disclosure circuits: `verifyForFreeHealthClinic`, `verifyForPharmacy`, `verifyForHospital`
- Contract is deployed at `18610af...9a31` on preprod (hackathon deployment)

## Demo Simplifications (do NOT treat as production-ready)
- Expiry stored but **not enforced** in circuits
- No nullifier tracking — **proof replay is possible**
- Credential is data-based commitment, **not cryptographically bound to subject's wallet**

## Style & Config
- ESM (`"type": "module"` in all packages)
- TypeScript 5.8, ESLint 9 + Prettier
- No CI workflows or pre-commit hooks configured
