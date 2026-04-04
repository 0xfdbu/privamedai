# PrivaMedAI - AI Agent Guide

This document provides comprehensive information for AI coding agents working on the PrivaMedAI project.

## Project Overview

**PrivaMedAI** is a privacy-preserving medical credential platform built on the Midnight blockchain. It enables healthcare providers to issue verifiable credentials while allowing patients to prove specific claims without revealing sensitive health data through zero-knowledge proofs and selective disclosure.

### Key Features

- **Zero-Knowledge Credentials**: Medical credentials issued on-chain with cryptographic privacy
- **Selective Disclosure**: Prove specific claims (age, prescriptions, conditions) without revealing full health records
- **Multi-Role Verifiers**: Different verification levels for clinics, pharmacies, and hospitals
- **Verifiable Proofs**: On-chain verification with immutable audit trails
- **AI-Powered Interface**: Natural language proof generation

### Selective Disclosure Verifiers

| Verifier | Discloses | Keeps Private |
|----------|-----------|---------------|
| **Free Health Clinic** | Age ≥ threshold | Actual age, conditions, prescriptions |
| **Pharmacy** | Prescription code match | Age, condition details |
| **Hospital** | Age ≥ threshold + Condition match | Specific values, prescriptions |

## Technology Stack

### Core Technologies

- **Blockchain**: Midnight Network (Preprod testnet)
- **Smart Contract Language**: Compact (version 0.30.0)
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend/Scripts**: Node.js + TypeScript
- **Wallet Integration**: Lace Wallet (browser extension)

### Key Dependencies

```json
{
  "@midnight-ntwrk/compact-js": "^2.5.0",
  "@midnight-ntwrk/compact-runtime": "^0.15.0",
  "@midnight-ntwrk/midnight-js": "^4.0.4",
  "@midnight-ntwrk/midnight-js-contracts": "^4.0.2",
  "@midnight-ntwrk/wallet": "^5.0.0",
  "@midnight-ntwrk/ledger-v8": "^8.0.3"
}
```

## Project Structure

```
repo/
├── PrivaMedAI.compact           # Root copy of the contract
├── package.json                 # Root workspace configuration
├── test-proof-gen.ts           # Standalone ZK proof testing script
│
├── contract/                    # Compact smart contract
│   ├── src/
│   │   ├── PrivaMedAI.compact  # Main contract (12 circuits)
│   │   ├── index.ts            # Contract exports
│   │   ├── witnesses-privamedai.ts  # Witness implementations
│   │   ├── managed/            # Compiled contract artifacts
│   │   └── test/               # Contract tests
│   └── dist/                   # Build outputs
│
├── frontend/                    # React frontend application
│   ├── src/
│   │   ├── App.tsx             # Main app with routing
│   │   ├── components/
│   │   │   ├── user/           # AI Chat, Wallet, QR Share
│   │   │   ├── issuer/         # Issue Credential, Register Issuer
│   │   │   ├── verifier/       # Verify Proof, Network Stats
│   │   │   ├── admin/          # Deploy Contract
│   │   │   ├── layout/         # Header, Footer, WalletButton
│   │   │   └── common/         # UI components
│   │   ├── services/
│   │   │   ├── midnight/       # Contract integration
│   │   │   ├── proofs/         # ZK proof generation
│   │   │   └── verifier/       # Verification logic
│   │   └── types/              # TypeScript type definitions
│   ├── public/managed/         # ZK config files (served)
│   └── dist/                   # Production build
│
├── api/                         # Express API server (minimal)
│   └── src/
│       ├── index.ts
│       └── types.ts
│
├── scripts/                     # Deployment and utility scripts
│   ├── deploy-privamedai.ts    # Main deployment script
│   ├── deploy-preprod.ts       # Alternative deployment
│   ├── cli-privamedai.ts       # CLI interface
│   └── deployment.json         # Deployment metadata
│
├── boilerplate/                 # Generated tooling
│   ├── contract-cli/           # CLI tooling
│   └── scripts/                # Helper scripts
│
└── midnight-level-db/          # Local state storage
```

## Smart Contract Architecture

### Contract: PrivaMedAI.compact

**Location**: `contract/src/PrivaMedAI.compact` (also at root: `PrivaMedAI.compact`)

**Language Version**: `pragma language_version >= 0.22.0 && <= 0.22.0`

### Data Structures

```compact
export enum CredentialStatus { VALID, REVOKED }
export enum IssuerStatus { PENDING, ACTIVE, SUSPENDED, REVOKED }

export struct Credential {
  issuer: Bytes<32>,
  claimHash: Bytes<32>,
  expiry: Uint<64>,
  status: CredentialStatus
}

export struct Issuer {
  publicKey: Bytes<32>,
  status: IssuerStatus,
  nameHash: Bytes<32>,
  credentialCount: Uint<64>
}
```

### Ledgers (On-Chain State)

```compact
export ledger credentials: Map<Bytes<32>, Credential>;
export ledger issuerRegistry: Map<Bytes<32>, Issuer>;
export ledger admin: Map<Bytes<1>, Bytes<32>>;
export ledger roundCounter: Counter;
export ledger totalCredentialsIssued: Counter;
export ledger totalVerificationsPerformed: Counter;
```

### Circuits (Contract Functions)

#### Admin & Issuer Management (4 circuits)
- `initialize(initialAdmin: Bytes<32>): []` - Set contract admin
- `getAdmin(): Bytes<32>` - Query admin address
- `registerIssuer(callerPubKey, issuerPubKey, nameHash): []` - Register issuer (admin only)
- `getIssuerInfo(issuerPubKey): Issuer` - Query issuer details
- `updateIssuerStatus(callerPubKey, issuerPubKey, newStatus): []` - Admin manage issuers

#### Credential Lifecycle (4 circuits)
- `issueCredential(callerPubKey, commitment, issuerPubKey, claimHash, expiry): []` - Issue credential
- `revokeCredential(callerPubKey, commitment): []` - Issuer revocation
- `adminRevokeCredential(callerPubKey, commitment, reasonHash): []` - Admin emergency revocation
- `checkCredentialStatus(commitment): CredentialStatus` - Query credential state

#### Selective Disclosure - ZK Proofs (3 circuits)
- `verifyForFreeHealthClinic` - Prove age ≥ minAge without revealing actual age
- `verifyForPharmacy` - Prove prescription code match
- `verifyForHospital` - Prove age + condition match

#### Batch Operations (3 circuits)
- `batchIssue3Credentials` - Issue 3 credentials in one transaction
- `bundledVerify2Credentials` - Verify 2 credentials together
- `bundledVerify3Credentials` - Verify 3 credentials together

### Witnesses (Private State Access)

```compact
witness local_secret_key(): Bytes<32>;
witness get_credential_data(): Bytes<32>;
witness get_bundled_credential_data(index: Uint<8>): Bytes<32>;
```

**Implementation**: `contract/src/witnesses-privamedai.ts`

## Build Commands

### Root Level Commands

```bash
# Install all dependencies across workspaces
npm install

# Build all workspaces
npm run build

# Run all tests
npm run test

# Development mode - compiles contract and runs auto-generator
npm run dev
```

### Contract Development

```bash
cd contract/

# Compile Compact contract (generates managed/ folder)
npm run compact

# Build TypeScript
npm run build

# Run contract tests
npm run test

# Lint
npm run lint

# Type check
npm run typecheck

# Full dev cycle
npm run dev  # runs compact + build
```

### Frontend Development

```bash
cd frontend/

# Start development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

### API Development

```bash
cd api/

# Run in development mode
npm run dev

# Build
npm run build

# Start production server
npm run start
```

## Deployment Commands

### Deploy Contract

```bash
# Deploy to Preprod (main script)
npm run deploy:privamedai

# Alternative deployment
npm run deploy:preprod

# Deploy with existing wallet
npm run deploy:with-wallet
```

### CLI Operations

```bash
# Interactive CLI for contract operations
npm run cli:privamedai

# Run all feature tests
npm run test:all-features

# Test transactions
npm run test:privamedai:txs
```

### Wallet Utilities

```bash
# Generate new wallet key
npm run wallet

# Request tDUST from faucet
npm run faucet

# Check wallet balance
npm run balance
```

## Testing

### Contract Tests

Located in: `contract/src/test/`

```bash
cd contract/
npm run test
```

Tests cover:
- Admin functions (initialization, getAdmin)
- Issuer registry (register, update status, get info)
- Credential issuance (single and batch)
- Credential verification (single and bundled)
- Revocation (issuer and admin)
- Query functions

### Frontend Type Checking

```bash
cd frontend/
npx tsc --noEmit
```

## Environment Configuration

### Frontend Environment (`frontend/.env`)

```env
VITE_CONTRACT_ADDRESS=18610af33928fa54fd2393c54413a1724e781922b0277c630bb1658475249a31
VITE_NETWORK_ID=preprod
VITE_PROOF_SERVER_URL=http://localhost:6300
```

### Root Environment (`.env`)

```env
WALLET_SEED=<64-char-hex-seed>
WALLET_ADDRESS=<midnight-address>
```

### Network Configuration (from `scripts/deploy-privamedai.ts`)

```typescript
const NETWORK_CONFIG = {
  networkId: 'preprod',
  indexerUri: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWsUri: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  proofServerUri: 'http://localhost:6300',
  relayUri: 'wss://rpc.preprod.midnight.network',
};
```

## Running the Application

### Prerequisites

1. Node.js 22+
2. Lace Wallet browser extension
3. Midnight tDUST tokens (from [faucet](https://faucet.preprod.midnight.network/))
4. Proof Server running locally

### Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Build the contract
cd contract
npm run build
cd ..

# 3. Start the proof server (in separate terminal)
./proof-server

# 4. Start the frontend (in new terminal)
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173`

### Production Build

```bash
# Build contract
cd contract && npm run build && cd ..

# Build frontend
cd frontend && npm run build && cd ..

# Deploy (optional)
npm run deploy:privamedai
```

## Code Style Guidelines

### TypeScript

- Use strict TypeScript configuration
- Prefer `const` and `let` over `var`
- Use explicit return types on public functions
- Use `readonly` for immutable properties

### Compact Language

- Always use `export` for public circuits
- Use `disclose()` for circuit parameters that need to be public
- Use `assert()` with descriptive error messages
- Follow the pattern: validate inputs → perform operation → update ledgers

### File Organization

- One main component per file in `frontend/src/components/`
- Co-locate related components in subdirectories
- Use `index.ts` for clean exports
- Services go in `frontend/src/services/`

## Security Considerations

### Smart Contract Security

1. **Access Control**: All admin functions verify caller is admin
2. **Issuer Validation**: Credentials can only be issued by registered, active issuers
3. **Revocation**: Only issuers can revoke their own credentials; admin can emergency revoke
4. **Duplicate Prevention**: Credentials use unique commitments as keys

### ZK Proof Security

1. **Witness Privacy**: Private credential data never leaves the prover's control
2. **Selective Disclosure**: Verifiers only learn what they need (age threshold match, not actual age)
3. **Hash Verification**: Claim hashes ensure credential data integrity

### Wallet Security

- Never commit `.env` files with real seeds
- Use separate wallets for development and production
- Store mnemonic phrases securely (not in code)

## Common Development Tasks

### Adding a New Circuit

1. Define circuit in `contract/src/PrivaMedAI.compact`
2. Add corresponding witness if needed in `contract/src/witnesses-privamedai.ts`
3. Compile: `cd contract && npm run compact`
4. Add test in `contract/src/test/privamedai.test.ts`
5. Update deployment script if needed
6. Rebuild and redeploy

### Adding a Frontend Component

1. Create component in appropriate subdirectory under `frontend/src/components/`
2. Export from `index.ts` if part of a group
3. Add route in `frontend/src/App.tsx` if needed
4. Add to navigation if user-facing

### Updating Contract Address

After deployment, the address is automatically written to:
- `scripts/deployment.json`
- Root `.env`
- `frontend/.env`

## Troubleshooting

### Proof Server Issues

- Ensure proof server is running on port 6300
- Check logs for ZK circuit compilation errors
- Restart proof server after contract changes

### Wallet Sync Issues

- Wallet may take 1-5 minutes to sync on first start
- Check network connectivity to Preprod
- Verify sufficient tDUST balance

### Build Errors

- Always compile contract before building frontend
- Check that `managed/` folder exists in `contract/src/`
- Ensure all dependencies are installed (`npm install`)

## Deployment Information

### Current Preprod Deployment

| Detail | Value |
|--------|-------|
| **Network** | Midnight Preprod |
| **Contract Address** | `18610af33928fa54fd2393c54413a1724e781922b0277c630bb1658475249a31` |
| **Transaction ID** | `007c1086b4e1fcb2412e07fc4c9bf5498ec49d254c468972270d543bec3dd69269` |
| **Block Height** | 204246 |
| **Circuits** | 12 |

## Resources

- [Midnight Documentation](https://docs.midnight.network)
- [Compact Language Reference](https://docs.midnight.network/develop/reference/compact/lang-ref)
- [Midnight.js Examples](https://github.com/midnightntwrk/midnight-js)
- [Preprod Faucet](https://faucet.preprod.midnight.network/)

---

**Note**: This project runs on Midnight Preprod testnet. Do not use with real medical data or mainnet assets.
