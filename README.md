# PrivaMedAI - Zero-Knowledge Medical Credentials

[![Midnight](https://img.shields.io/badge/Midnight-Preprod-blue)](https://midnight.network)
[![Compact](https://img.shields.io/badge/Compact-0.30.0-green)](https://docs.midnight.network)
[![License](https://img.shields.io/badge/License-Apache%202.0-yellow)](LICENSE)

PrivaMedAI is a privacy-preserving medical credential platform built on the Midnight blockchain. It enables healthcare providers to issue verifiable credentials while allowing patients to prove specific claims without revealing sensitive health data through zero-knowledge proofs and selective disclosure.

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
- `initialize` - Set contract admin
- `getAdmin` - Query admin address
- `registerIssuer` - Open issuer registration
- `getIssuerInfo` - Query issuer details
- `updateIssuerStatus` - Admin manage issuers

**Credential Lifecycle:**
- `issueCredential` - Issue single credential
- `revokeCredential` - Issuer revocation
- `adminRevokeCredential` - Admin emergency revocation
- `checkCredentialStatus` - Query credential state

**🎯 Selective Disclosure (ZK Proofs):**
- `verifyForFreeHealthClinic` - Prove age ≥ minAge
- `verifyForPharmacy` - Prove prescription match
- `verifyForHospital` - Prove age + condition match

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
│   │   │   ├── user/            # AI Chat, Wallet, QR Share
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
5. Submit and download credential JSON

### 3. Generate ZK Proof (Patient)

1. Go to **Patient Portal → AI Composer**
2. Import your credential file
3. Describe what you need to prove (e.g., "prove I'm over 18 for clinic")
4. AI generates selective disclosure proof
5. Download or share QR code

### 4. Verify Proof (Verifier)

1. Go to **Verifier Portal → Verify Proof**
2. Upload proof file or paste proof data
3. Submit to blockchain for verification
4. View verification result

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

## 🧪 Testing

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

## 📄 License

Apache 2.0 - See [LICENSE](LICENSE) for details.

## 🤝 Contributing

This is a hackathon project demonstrating selective disclosure on Midnight. Feel free to fork and extend!

---

**Note:** This project runs on Midnight Preprod testnet. Do not use with real medical data or mainnet assets.
