# PrivaMedAI - Zero-Knowledge Medical Credentials

[![Midnight](https://img.shields.io/badge/Midnight-Preprod-blue)](https://midnight.network)
[![Compact](https://img.shields.io/badge/Compact-0.30.0-green)](https://docs.midnight.network)
[![Tests](https://img.shields.io/badge/Tests-95%20Passing-brightgreen)](TEST_REPORT.md)
[![License](https://img.shields.io/badge/License-Apache%202.0-yellow)](LICENSE)

PrivaMedAI is a privacy-preserving medical credential platform built on the Midnight blockchain. It enables healthcare providers to issue verifiable credentials while allowing patients to prove specific claims without revealing sensitive health data through zero-knowledge proofs and selective disclosure.

## 🎯 Hackathon Demo Scope

This is a **functional hackathon demonstration** of selective disclosure on Midnight. It uses **real ZK proofs** and **real on-chain transactions** on the preprod network.

### ✅ What's Working (Production-Grade)

| Feature | Status | Details |
|---------|--------|---------|
| **Real ZK Proof Generation** | ✅ Production | Uses local proof server (`:6300`) to generate SNARK proofs |
| **Real On-Chain Verification** | ✅ Production | Transactions submitted to Midnight preprod, verified by network validators |
| **Selective Disclosure** | ✅ Working | Same credential reveals different fields based on verifier type |
| **3 Verifier Circuits** | ✅ Working | Free Health Clinic (age), Pharmacy (prescription), Hospital (age+condition) |
| **Health Claim Privacy** | ✅ Working | Private data accessed via witness, never appears on-chain |
| **Two-Step Verification** | ✅ Working | Local SNARK pre-validation → On-chain authoritative verification |
| **Mobile Responsive** | ✅ Working | Fully responsive UI for all devices |

### 📝 Demo Simplifications

The following features are intentionally simplified for hackathon demo purposes:

| Aspect | Demo Behavior | Production Consideration |
|--------|---------------|-------------------------|
| **Expiry** | Stored but not enforced in circuits | Uncomment expiry check in contract for production |
| **Proof Replay** | Same proof can be verified multiple times | Add nullifier tracking to prevent replay attacks |
| **Credential Binding** | Data-based commitment | Cryptographically bind to subject's wallet for stronger security |
| **Verifier Selection** | AI-powered detection from natural language | Explicit verifier selection UI for production reliability |

### 🔒 Privacy Guarantees

**What stays private (ZK-protected, never on-chain):**
- Actual age value (e.g., 35)
- Condition codes (e.g., 100 = diabetes)
- Prescription codes (e.g., 500)
- All health claim data

**What's visible on-chain (public):**
- Transaction hash
- Verification counter increments
- Credential commitment (hash identifier)
- Threshold values checked (e.g., "age ≥ 18", "condition = 100")

## 🌟 Features

### Core Capabilities
- **🔐 Zero-Knowledge Credentials** - Medical credentials issued on-chain with cryptographic privacy
- **🎯 Selective Disclosure** - Prove specific claims (age, prescriptions, conditions) without revealing full health records
- **🏥 Multi-Role Verifiers** - Different verification levels for clinics, pharmacies, and hospitals
- **✅ Verifiable Proofs** - On-chain verification with immutable audit trails
- **🤖 AI-Powered Interface** - Natural language proof generation

### Selective Disclosure Verifiers
| Verifier | Discloses | Keeps Private |
|----------|-----------|---------------|
| **Free Health Clinic** | Age ≥ threshold | Actual age, conditions, prescriptions |
| **Pharmacy** | Prescription code match | Age, condition details |
| **Hospital** | Age ≥ threshold + Condition match | Specific values, prescriptions |

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- Lace Wallet (browser extension)
- Midnight tDUST tokens (from [faucet](https://faucet.preprod.midnight.network/))

### Installation

```bash
# Clone and install dependencies
cd /home/user/Desktop/midnight/repo
npm install

# Build the contract
cd contract
npm run build

# Start the proof server
cd ..
./proof-server

# In a new terminal - start the frontend
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173`

## 📋 Deployed Contract

| Detail | Value |
|--------|-------|
| **Network** | Midnight Preprod |
| **Contract Address** | `18610af33928fa54fd2393c54413a1724e781922b0277c630bb1658475249a31` |
| **Transaction ID** | `007c1086b4e1fcb2412e07fc4c9bf5498ec49d254c468972270d543bec3dd69269` |
| **Block Height** | 204246 |
| **Circuits** | 12 |

### Available Circuits

**Admin & Issuer Management:**
- `initialize` - Set contract admin 🎯
- `getAdmin` - Query admin address
- `registerIssuer` - Open issuer registration 🎯
- `getIssuerInfo` - Query issuer details
- `updateIssuerStatus` - Admin manage issuers

**Credential Lifecycle:**
- `issueCredential` - Issue single credential 🎯
- `revokeCredential` - Issuer revocation 🎯
- `adminRevokeCredential` - Admin emergency revocation 
- `checkCredentialStatus` - Query credential state 🎯

**🎯 Selective Disclosure (ZK Proofs):** 
- `verifyForFreeHealthClinic` - Prove age ≥ minAge 🎯
- `verifyForPharmacy` - Prove prescription match 🎯
- `verifyForHospital` - Prove age + condition match 🎯 

**For this hackathon demo, only Core functionalities/Circuits were Integrated / Tested**

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  Midnight Node   │────▶│  Smart Contract │
│  (React/Vite)   │     │  (Preprod)       │     │  (12 Circuits)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │
        ▼                        ▼
┌─────────────────┐     ┌──────────────────┐
│  Proof Server   │     │  Indexer (v4)    │
│  (localhost)    │     │  (GraphQL/WS)    │
└─────────────────┘     └──────────────────┘
```

## 📁 Project Structure

```
repo/
├── contract/                 # Compact smart contract
│   ├── src/
│   │   └── PrivaMedAI.compact    # Main contract (12 circuits)
│   └── dist/                     # Compiled artifacts
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── user/            # AI Chat, Wallet
│   │   │   ├── issuer/          # Issue Credential, Register Issuer
│   │   │   └── verifier/        # Verify Proof, Network Stats
│   │   └── services/
│   │       ├── midnight/        # Contract integration
│   │       └── proofs/          # ZK proof generation
│   └── public/managed/          # ZK config files
└── scripts/
    └── deploy-privamedai.ts     # Deployment script
```

## 🔧 Configuration

### Environment Variables

**Frontend (`.env`):**
```env
VITE_CONTRACT_ADDRESS=18610af33928fa54fd2393c54413a1724e781922b0277c630bb1658475249a31
VITE_NETWORK_ID=preprod
VITE_PROOF_SERVER_URL=http://localhost:6300
```

**Contract (`scripts/deploy-privamedai.ts`):**
```typescript
const NETWORK_CONFIG = {
  indexerUri: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWsUri: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  proofServerUri: 'http://127.0.0.1:6300',
};
```

## 📝 Usage Guide

### 1. Register as Issuer

1. Connect your Lace wallet
2. Navigate to **Medical Provider → Register**
3. Enter your organization name
4. Submit registration (open registration - no admin approval needed)

### 2. Issue a Credential

1. Go to **Medical Provider → Issue Credentials**
2. Enter patient wallet address
3. Select medical conditions
4. Set selective disclosure codes (age, condition, prescription)
5. Set expiry period (⚠️ stored but not enforced in circuits - see limitations)
6. Submit and download credential JSON

### 3. Generate ZK Proof (Patient)

1. Go to **Patient Portal → AI Composer**
2. Import your credential file
3. Describe what you need to prove (e.g., "prove I'm over 18 for clinic")
4. AI generates selective disclosure proof
5. Download or copy

### 4. Verify Proof (Verifier)

1. Go to **Verifier Portal → Verify Proof**
2. Upload proof file or paste proof data
3. Submit to blockchain for verification
4. View verification result on [Midnight Explorer](https://preprod.midnightexplorer.com)

## 🔐 Selective Disclosure Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Patient   │────▶│   ZK Proof  │────▶│   Verifier  │
│  (Prover)   │     │  Generation │     │  (On-Chain) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                   │
       ▼                    ▼                   ▼
HealthClaim           Witness Data        Boolean Result
(age, condition,      + Private Key       (valid/invalid)
prescription)         + On-Chain State
```

## 🧠 How ZK Proofs Work (Beginner's Guide)

### The Magic: Proving Without Revealing

Think of a ZK proof like showing you know a password without actually telling me the password:

**Traditional Verification:**
```
Doctor: "Show me your medical record"
You:    "Here, I'm 35 with diabetes"
Result: Doctor sees ALL your data
```

**ZK Verification:**
```
Clinic: "Prove you're over 18"
You:    "Here's a proof that I know my age is ≥ 18"
Result: Clinic learns ONLY "age ≥ 18: true"
```

### Key Concepts

| Concept | Simple Explanation | Example |
|---------|-------------------|---------|
| **Claim** | A statement about your data | "My age is 35" |
| **Public Input** | What everyone can see | Threshold: "age ≥ 18" |
| **Private Witness** | Your secret data | Actual age: 35 |
| **Proof** | Cryptographic evidence | "I know a value ≥ 18 that matches the claim hash" |
| **Verification** | Checking the proof | Circuit validates without learning the actual age |

### How It Works in PrivaMedAI

```
1. ISSUANCE (Doctor → Patient)
   ├─ Doctor issues credential with health data
   ├─ Data is hashed: claimHash = hash([age, condition, prescription])
   └─ Stored on-chain: commitment → claimHash

2. PROOF GENERATION (Patient)
   ├─ Patient wants to prove: "I'm over 18 AND have diabetes"
   ├─ Circuit inputs:
   │   ├─ Public: commitment, minAge=18, requiredCondition=100
     │   └─ Private (witness): age=35, conditionCode=100, prescriptionCode=500
   ├─ Circuit checks:
   │   ├─ Does hash([age, condition, prescription]) == claimHash? ✓
   │   ├─ Is age ≥ minAge? ✓ (35 ≥ 18)
   │   └─ Is condition == requiredCondition? ✓ (100 == 100)
   └─ Generates ZK proof: "Valid proof that checks pass"

3. VERIFICATION (Blockchain)
   ├─ Verifier sees: proof + public inputs
   ├─ Verifier checks: Is the proof valid?
   └─ Result: "Proof is valid" (never learns actual values!)
```

### The Math Magic (Simplified)

**Commitment:** Hash of your data
```
claimHash = hash("privamed:claim:" + age + condition + prescription)
```

**Proof:** 
- Proves: "I know values that hash to claimHash AND satisfy the conditions"
- Without revealing: The actual values

**Why It's Secure:**
- One-way hash: Can't reverse-engineer data from claimHash
- ZK circuits: Prove statements without revealing inputs
- On-chain: Only public inputs are visible

### Real-World Analogy

Imagine a **sealed envelope system**:

1. **Issuance:** Doctor puts your health record in an envelope, writes a summary on the outside
2. **Proof:** You open the envelope privately, check the requirements, then give the verifier a signed attestation
3. **Verification:** Verifier checks the signature (proof) knows the attestation is valid without seeing inside the envelope

The difference: In ZK, the "envelope" is mathematics, not paper!

## 🧪 Testing

We maintain comprehensive test coverage with **109 tests** covering contract logic, ZK proof generation, and end-to-end integration. Tests were created using multi-agent swarm validation and Midnight MCP documentation verification.

### Test Report
📊 **[View Full Test Report](TEST_REPORT.md)** - Detailed breakdown of all 109 tests, coverage analysis, and verification results.

### Quick Test Run

```bash
# Run all tests
npx vitest run

# Run specific test suites
npx vitest run tests/contract-tests.ts          # Contract logic (41 tests)
npx vitest run tests/proof-verification.test.ts # ZK proofs (54 tests)
npx vitest run tests/integration-tests.ts       # E2E integration (14 tests)

# Run with coverage
npx vitest run --coverage
```

### Test Coverage Summary

| Suite | Tests | Status | Coverage Area |
|-------|-------|--------|---------------|
| **Contract Tests** | 41 | ✅ All Passing | Issuer mgmt, credentials, circuits |
| **ZK Proof Verification** | 54 | ✅ All Passing | SNARK validation, artifacts, circuits |
| **Integration Tests** | 14 | ⏭️ Network Dependent | E2E flows, network integration |
| **TOTAL** | **109** | **95 Core Passing** | **Full system coverage** |

### What Tests Verify

#### ✅ Real ZK Proofs (Not Mock)
- Prover keys are 2.83 MB (verified binary format: `midnight:prover-key[v7]`)
- SNARK verification via `provingProvider.check()` calls
- Circuit execution with real on-chain state

#### ✅ Real Blockchain Integration
- Official `@midnight-ntwrk/*` SDK packages (23 packages)
- Contract deployed at `18610af...9a31` on preprod
- Real transaction submission via `submitCallTx`

#### ✅ Valid Cryptographic Artifacts
| Artifact | Size | Format |
|----------|------|--------|
| Prover Keys | 2.83 MB | Binary with Midnight header |
| Verifier Keys | ~2.1 KB | Official SDK format |
| ZKIR Files | 8-12 KB | Valid JSON IR |

#### ✅ All 3 Selective Disclosure Circuits
- `verifyForFreeHealthClinic` (age ≥ threshold)
- `verifyForPharmacy` (prescription match)
- `verifyForHospital` (age + condition match)

#### ✅ Security Boundaries
- Admin-only function protection
- Issuer suspension/revocation
- Claim hash validation
- Access control enforcement

### Compile & Type Check

```bash
# Compile contract
cd contract
npm run compact

# Type check frontend
cd ../frontend
npx tsc --noEmit

# Build for production
npm run build
```

## 🔍 System Verification

This system has been thoroughly validated using **swarm agent analysis** and **Midnight MCP documentation verification**:

### Verification Methods Used
1. **Multi-Agent Code Analysis** - 3+ specialized agents inspected codebase
2. **Midnight MCP Documentation** - Official docs and API verification
3. **Cryptographic Artifact Inspection** - Binary analysis of ZK files
4. **Network Integration Testing** - Real preprod connection validation

### Key Findings

| Claim | Evidence | Status |
|-------|----------|--------|
| Real ZK Proofs | 2.83MB prover keys with Midnight header format | ✅ Verified |
| Real Blockchain | Contract at valid preprod address | ✅ Verified |
| Real SDK | 23 official `@midnight-ntwrk/*` packages | ✅ Verified |
| Working Circuits | All 3 selective disclosure circuits functional | ✅ Verified |
| SNARK Verification | `provingProvider.check()` calls real proof server | ✅ Verified |

### Contract Details
- **Network:** Midnight Preprod
- **Address:** `18610af33928fa54fd2393c54413a1724e781922b0277c630bb1658475249a31`
- **Deployment Tx:** `007c1086b4e1fcb2412e07fc4c9bf5498ec49d254c468972270d543bec3dd69269`
- **Block Height:** 204246

## 🛠️ Development

### Contract Development

```bash
cd contract

# Compile with compactc
npm run compact

# Build TypeScript
npm run build
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## 📚 Key Technologies

- **Midnight Blockchain** - Privacy-preserving L1 with ZK primitives
- **Compact Language** - Smart contract DSL with native ZK support
- **Midnight.js** - TypeScript SDK for contract interaction
- **Lace Wallet** - Browser wallet for signing transactions
- **Proof Server** - Local ZK proof generation service

## 🔗 Resources

- [Midnight Documentation](https://docs.midnight.network)
- [Compact Language Reference](https://docs.midnight.network/develop/reference/compact/lang-ref)
- [Midnight.js Examples](https://github.com/midnightntwrk/midnight-js)
- [Preprod Faucet](https://faucet.preprod.midnight.network/)
- [Preprod Explorer](https://preprod.midnightexplorer.com)

## 📄 License

Apache 2.0 - See [LICENSE](LICENSE) for details.

## 🤝 Contributing

This is a hackathon project demonstrating selective disclosure on Midnight. Feel free to fork and extend!

**Areas for contribution:**
- Enable expiry checking in verification circuits
- Add nullifier tracking for replay protection
- Implement cryptographic binding to subject wallet
- Add more verifier types (range proofs, NOT proofs)

---

**Note:** This project runs on Midnight Preprod testnet. Do not use with real medical data or mainnet assets.
