# PrivaMedAI Frontend Integration

## Contract Details

- **Contract Address**: `8b5e6beaece98e9af39b323aea15dda68881e95483effe29950dfc92add6800d`
- **Network**: Midnight Preprod
- **Proof Server**: http://localhost:6300

## Features Integrated

### 1. Issuer Portal (`IssuerPortal` component)
- ✅ **Issue Credential** - Create new healthcare credentials
- ✅ **Revoke Credential** - Revoke issued credentials
- ✅ **Manage Credentials** - View issued credentials list

### 2. User Portal (`UserPortal` component)  
- ✅ **Credential Wallet** - Secure local storage for credentials
- ✅ **AI Claim Composer** - Natural language claim generation
- ✅ **Zero-Knowledge Proofs** - Privacy-preserving verification

### 3. Verifier Portal (`VerifierPortal` component)
- ✅ **Verify Credentials** - Check credential validity on-chain
- ✅ **Privacy-Preserving** - No access to private data

## Contract Functions Available

```typescript
// Admin Functions
initialize(adminPublicKey: string): Promise<string>
registerIssuer(issuerPubKey: string, nameHash: string): Promise<string>
updateIssuerStatus(issuerPubKey: string, newStatus: IssuerStatus): Promise<string>

// Issuer Functions  
issueCredential(commitment: string, claimHash: string, expiryDays: number): Promise<string>
revokeCredential(commitment: string): Promise<string>
batchIssueCredentials(commitments: string[], claimHashes: string[], expiryDays: number): Promise<string>

// Verification Functions
verifyCredential(commitment: string, credentialData: string): Promise<boolean>
verifyAgeRange(commitment: string, minAge: number, maxAge: number): Promise<boolean>
verifyDiabetesTrialEligibility(commitment: string): Promise<boolean>
verifyInsuranceWellnessDiscount(commitment: string): Promise<boolean>
verifyHealthcareWorkerClearance(commitment: string): Promise<boolean>
```

## Quick Start

```bash
# 1. Start proof server
docker run -p 6300:6300 midnightnetwork/proof-server:latest

# 2. Install dependencies
npm install

# 3. Build contract (if needed)
cd ../contract && npm run build

# 4. Start frontend
cd ../frontend && npm run dev
```

## Environment Setup

The frontend connects to:
- **Lace Wallet** - Browser extension wallet
- **Proof Server** - Local ZK proof generation
- **Midnight Network** - Preprod testnet

## Tested Transactions

| Feature | Status | TX Example |
|---------|--------|------------|
| Initialize | ✅ | `000c890b...` |
| Batch Issue 3 | ✅ | `00656c5f...`, `0048c7a5...` |
| Update Issuer | ✅ | `00e11c08...` |
| Revoke | ✅ | `006b0ffc...` |

## Architecture

```
frontend/src/
├── hooks/
│   ├── usePrivaMedAIContract.ts    # Main contract hook
│   ├── useLaceWallet.ts            # Lace wallet integration
│   ├── useBrowserWallet.ts         # In-browser wallet
│   └── WalletContext.tsx           # Wallet state management
├── contract/
│   └── credentialApi.ts            # Contract API interface
├── components/
│   ├── AIClaimComposer.tsx         # AI claim generation
│   └── CliInstructions.tsx         # Setup instructions
├── utils/
│   ├── credentialWallet.ts         # Local credential storage
│   └── proofSharing.ts             # Proof sharing utilities
└── ai/
    └── claimParser.ts              # AI claim parsing
```

## Integration Complete! ✅

The PrivaMedAI contract is fully integrated into the frontend with:
- Wallet connection (Lace + Browser)
- Credential issuance and management
- Zero-knowledge verification
- AI-powered claim composer
- Secure local credential wallet
