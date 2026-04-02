# PrivaMedAI Frontend

Privacy-first healthcare credentials dApp on Midnight Network.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## 🔗 Contract Integration

The frontend is fully integrated with the PrivaMedAI smart contract:

- **Contract Address**: `8b5e6beaece98e9af39b323aea15dda68881e95483effe29950dfc92add6800d`
- **Network**: Midnight Preprod
- **Status**: ✅ Fully Integrated

### Features

| Portal | Features |
|--------|----------|
| **Issuer** | Issue credentials, Batch issue (3), Revoke, Manage |
| **User** | Credential wallet, AI claim composer, ZK proofs |
| **Verifier** | Verify credentials, Check status |

### Contract Functions Integrated

- ✅ `initialize()` - Set contract admin
- ✅ `registerIssuer()` - Add issuer to registry
- ✅ `issueCredential()` - Issue single credential
- ✅ `batchIssue3Credentials()` - Batch issue 3 credentials
- ✅ `verifyCredential()` - Verify credential with hash
- ✅ `revokeCredential()` - Revoke credential
- ✅ `updateIssuerStatus()` - Manage issuer status
- ✅ Parametric circuits (age, diabetes, insurance, clearance)

## 🏗️ Architecture

```
src/
├── hooks/
│   ├── usePrivaMedAIContract.ts    # Main contract hook
│   ├── useLaceWallet.ts            # Lace wallet
│   └── WalletContext.tsx           # Wallet provider
├── contract/
│   └── credentialApi.ts            # Contract API
├── components/
│   ├── AIClaimComposer.tsx         # AI claim generation
│   └── CliInstructions.tsx         # Setup help
└── utils/
    └── credentialWallet.ts         # Local storage
```

## 📋 Prerequisites

1. **Lace Wallet** - Browser extension for Midnight
2. **Proof Server** - Run locally:
   ```bash
   docker run -p 6300:6300 midnightnetwork/proof-server:latest
   ```

## 🧪 Tested Transactions

All core features tested with real preprod transactions:

| Test | Status | TX |
|------|--------|-----|
| Initialize | ✅ | `000c890b...` |
| Batch Issue 3 | ✅ | `00656c5f...` |
| Update Issuer | ✅ | `00e11c08...` |
| Revoke | ✅ | `006b0ffc...` |

## 📝 Environment

- Vite + React + TypeScript
- Midnight JS SDK v4.0.4
- Compact Runtime v0.15.0

## 🔐 Security

- Credentials stored encrypted (AES-256-GCM)
- Zero-knowledge proofs for verification
- Local-only private data

---

**Integration Status**: ✅ Complete
