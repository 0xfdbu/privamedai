# PrivaMedAI - Zero-Knowledge Medical Credentials on Midnight Network**

[![Midnight](https://img.shields.io/badge/Midnight-Preprod-blue)](https://midnight.network)
[![Compact](https://img.shields.io/badge/Compact-0.30.0-green)](https://docs.midnight.network)
[![Tests](https://img.shields.io/badge/Tests-95%20Passing-brightgreen)](TEST_REPORT.md)
[![License](https://img.shields.io/badge/License-Apache%202.0-yellow)](LICENSE)

**PrivaMedAI** is a privacy-preserving medical credential platform on the Midnight blockchain. Healthcare providers issue verifiable credentials; patients prove specific claims (age, prescriptions, conditions) using **real zero-knowledge proofs** and **selective disclosure** — without revealing sensitive health data.

## 🎯 Hackathon Demo Scope
**Functional hackathon demo** using **real ZK proofs** and **real on-chain transactions** on Midnight Preprod.

### ✅ What's Working (Production-Grade)
| Feature                  | Status     | Details |
|--------------------------|------------|---------|
| Real ZK Proof Generation | ✅ Production | Local proof server (`:6300`) |
| Real On-Chain Verification | ✅ Production | Submitted to preprod validators |
| Selective Disclosure     | ✅ Working  | Same credential reveals different fields per verifier |
| 3 Verifier Circuits      | ✅ Working  | Clinic (age), Pharmacy (prescription), Hospital (age+condition) |
| Health Claim Privacy     | ✅ Working  | Private data never appears on-chain |
| Two-Step Verification    | ✅ Working  | Local SNARK → on-chain |
| Mobile Responsive UI     | ✅ Working  | All devices |

### 📝 Demo Simplifications
| Aspect            | Demo Behavior                  | Production Note |
|-------------------|--------------------------------|-----------------|
| Expiry            | Stored but not enforced        | Uncomment check in contract |
| Proof Replay      | Same proof reusable            | Add nullifier in prod |
| Credential Binding| Any party with the credential file can generate/verify a proof| Add wallet binding |
| Verifier Selection| AI natural-language detection  | Add explicit UI |
| Issuer Registration| Public, anyone can become an issuer  | Whitelist admin |
| Claim hash security | `persistentHash` used (no randomness) | Use `persistentCommit` with random nonce to prevent enumeration attacks |
| Admin initialization | `initialize()` is unprotected — anyone can call it | Derive and verify admin identity from `local_secret_key()` inside the circuit |
| Caller identity | Caller public key passed as parameter, not ZK-proven | Derive public key from `local_secret_key()` witness inside the circuit to cryptographically prove ownership |

## 🔒 Privacy Properties

**Private (never stored in public ledger):**
- Actual age, condition codes, prescription codes
- Full health claim data (only used as witness input in ZK proofs)

**Hashed before going on-chain (not a full commitment):** `claimHash` is stored as a `persistentHash` — a plain hash without randomness. This means an attacker who can enumerate possible health claim values (age, condition, prescription combinations) could verify a match by recomputing the hash. A production system should use `persistentCommit` with a random nonce to prevent this. [hashes and commitments](https://docs.midnight.network/concepts/how-midnight-works/keeping-data-private#hashes-and-commitments)

**Public (on-chain):**
- Transaction hash & block inclusion
- `totalVerificationsPerformed` and `totalCredentialsIssued` counters
- Which verifier circuit was called (clinic / pharmacy / hospital)
- Issuer public keys and name hashes (stored in `issuerRegistry`)
- Credential commitments, `claimHash`, expiry, issuer address, and status (stored in `credentials`)
- Caller public keys passed to issuer/revocation circuits

Per Midnight's model, anything passed as an argument to a ledger operation is publicly visible on-chain. [keeping data private](https://docs.midnight.network/concepts/how-midnight-works/keeping-data-private)

## 🌟 Core Features
- Zero-knowledge medical credentials on-chain
- Selective disclosure for clinics, pharmacies, hospitals
- AI-powered natural language proof generation
- Real on-chain verification via Midnight

## 🚀 Quick Start
**Prerequisites:**
- Node.js 22+
- Lace Wallet (browser extension)
- tDUST from [Preprod Faucet](https://faucet.preprod.midnight.network/)

```bash
# Clone & install
cd /path/to/repo
npm install

# Build contract
cd contract && npm run build && cd ..

# Start proof server
sudo docker start midnight-proof-server

# Start frontend (new terminal)
cd frontend && npm run dev
```

App runs at `http://localhost:5173`

## 📋 Deployed Contract
- **Network:** Midnight Preprod
- **Contract Address:** `18610af33928fa54fd2393c54413a1724e781922b0277c630bb1658475249a31`
- **Deployment Tx:** `007c1086b4e1fcb2412e07fc4c9bf5498ec49d254c468972270d543bec3dd69269`
- **Block Height:** 204246

## 🏗️ Architecture
```
Frontend (React) ↔ Midnight Preprod Node ↔ Smart Contract 
                  ↕
             Proof Server (local) + Indexer
```

**Frontend includes:**
- AI chat for natural-language proofs
- Issuer flow (register + issue credentials)
- Patient flow (import credential + generate proofs + Submit Proof Onchain)

## 📝 Usage (3 Simple Steps)
1. **Issuer** → Register & issue credential (patient gets JSON file)
2. **Patient** → Import credential → Use AI chat ("prove I'm over 18 for clinic") → Generate ZK proof
3. **Verification** → Upload proof → Patient submits on-chain → Check result on [Midnight Explorer](https://preprod.midnightexplorer.com)

**Important:** Patient submits the verification transaction themselves (privacy-preserving design). Verifier only sees the tx hash and success on explorer — never the private health data.

## 🔑 Key Technologies
- Midnight blockchain (ZK-native L1)
- Compact language (smart contracts)
- Midnight.js SDK + Lace Wallet
- Local SNARK proof server

## 📚 Resources
- [Midnight Docs](https://docs.midnight.network)
- [Preprod Explorer](https://preprod.midnightexplorer.com)
- [Faucet](https://faucet.preprod.midnight.network/)

**Note:** Hackathon demo on testnet. Not for real medical data.
