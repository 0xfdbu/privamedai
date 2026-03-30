# 🌙 PrivaCred

Privacy-first verifiable credentials dApp on the **Midnight Network**.

Users receive credentials (age, education, health status, etc.) from trusted issuers. They can then prove specific claims to verifiers **without ever revealing the raw data** — only a ZK proof goes on-chain. Data stays 100% private in the user's local storage.

Built for the "Into the Midnight" Hackathon (April 1–10 2026).

---

## 🏗️ Architecture

```
priva-cred/
├── contract/          # Compact smart contract (PrivaCred.compact)
├── api/               # Node.js issuer backend (signs & issues credentials)
└── frontend/          # React 19 + Vite app (3 portals)
```

### Core Midnight Primitives
- **Compact contract** with `Map<Bytes<32>, Credential>` ledger
- **3 circuits**: `issueCredential`, `verifyCredential`, `revokeCredential`
- **Witness functions** for private credential data (never touches chain)
- **midnight.js SDK** for wallet + proof generation
- **Lace Beta wallet** (preprod)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- `compactc` compiler installed (see below)
- Midnight Lace wallet

### 1. Install Compact Compiler

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.30.0
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Compile Contract

```bash
cd contract
export PATH="$HOME/.compact/versions/0.30.0/x86_64-unknown-linux-musl:$PATH"
npm run compact && npm run build
cd ..
```

### 4. Start the Issuer API

```bash
cd api
npm run dev
```

API runs on `http://localhost:3001`.

### 5. Start the Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173`.

---

## 🎭 Three Portals

### 1. Issuer Portal
Connect wallet → Create credential → Send to user's localStorage

### 2. User Portal
View my credentials (local only) → Generate ZK proof for a claim → Share proof

### 3. Verifier Portal
Paste proof → Call contract → See TRUE/FALSE result only

---

## 🔐 ZK Proof Flow

1. User's device runs witness + circuit locally
2. Proof π is generated (data never leaves device)
3. Only proof + public commitment hash is sent to Midnight
4. Verifier queries ledger → gets boolean

---

## 📝 Contract API

### `issueCredential(commitment, issuer, claimHash, expiry)`
Stores a new credential with `VALID` status.

### `verifyCredential(commitment) -> Boolean`
Returns `true` if the credential exists, is valid, and the private claim data matches the on-chain hash.

### `revokeCredential(commitment)`
Marks a credential as `REVOKED` (only the original issuer can call this).

---

## 🎥 Demo Video Script

1. **Issuer** opens Issuer Portal, connects Lace wallet, creates an "Age Over 18" credential for a subject.
2. **User** opens User Portal, sees the credential in local storage, clicks "Generate ZK Proof".
3. **Verifier** opens Verifier Portal, pastes the proof, clicks verify — sees ✅ VALID without seeing the age.

---

## ✅ Hackathon Success Criteria

- [x] Working issue → prove → verify flow
- [x] Zero raw data ever on-chain
- [x] Clean 3-portal UI
- [ ] Deployed on preprod
- [ ] 60-second demo video

---

Built with ❤️ using Midnight MCP & `create-midnight-app`.
