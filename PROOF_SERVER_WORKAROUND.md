# Proof Server Version Mismatch - Solutions

## Issue
The PrivaMedAI contract was compiled with **Compact 0.30.0**, which requires a compatible proof server. Local proof servers may have incompatible versions.

## ✅ Solution 1: Use Public Proof Server (Recommended)

Midnight Network provides a **public proof server** for preprod:

```
https://lace-proof-pub.preprod.midnight.network
```

### Configure Lace Wallet:
1. Open your **Lace wallet** extension
2. Go to **Settings → Midnight**
3. Set **Proof Server** to: `https://lace-proof-pub.preprod.midnight.network`
4. Click **Save**
5. Refresh the PrivaMedAI frontend and reconnect

### Frontend Configuration:
The frontend has been updated to use the public proof server by default:
```typescript
// frontend/src/hooks/WalletContext.tsx
proofServerUri: 'https://lace-proof-pub.preprod.midnight.network'
```

## ✅ Solution 2: Use CLI for Credential Operations

The CLI works because it uses the wallet's internal proving. Use the CLI to issue credentials:

```bash
cd /home/user/Desktop/midnight/repo
npm run cli:privamedai
```

Select option **6** to issue a credential.

## ✅ Solution 3: Build Compatible Proof Server (Advanced)

If you have access to the Midnight source code, build proof-server version matching Compact 0.30.0:

```bash
# This requires access to Midnight internal repositories
git clone https://github.com/midnight-ntwrk/proof-server.git
cd proof-server
git checkout v0.30.0  # Or compatible version
cargo build --release
./target/release/proof-server --port 6300
```

## Public Proof Server Endpoints

Per [Midnight SDK documentation](https://github.com/midnightntwrk/midnight-sdk/blob/main/COMPATIBILITY.md):

| Service | Preview | Preprod | Mainnet |
|---------|---------|---------|---------|
| Node RPC | rpc.preview.midnight.network | rpc.preprod.midnight.network | TBD |
| Indexer GraphQL | indexer.preview.midnight.network | indexer.preprod.midnight.network | TBD |
| **Proof Server** | **lace-proof-pub.preview.midnight.network** | **lace-proof-pub.preprod.midnight.network** | TBD |
| Faucet | faucet.preview.midnight.network | faucet.preprod.midnight.network | — |

## Current Status

- ✅ **Contract deployed** and initialized on preprod
- ✅ **Issuer registered** and activated
- ✅ **CLI working** for all operations
- ✅ **Public proof server configured** in frontend
- ⚠️ **Version compatibility** - Public server may still have version mismatch; use CLI if issues persist

## Frontend Capabilities

Even with potential proof server issues, the frontend can:
- View stored credentials (from localStorage)
- Verify credentials (read-only operations)
- Display contract state
- Show issuer information
- Issue credentials (if proof server version matches)

## Issuing Credentials

### Via CLI:
1. Generate a credential commitment and claim hash:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. Run the CLI:
```bash
npm run cli:privamedai
```

3. Select option **6** and enter:
   - Commitment: (64 hex chars)
   - Issuer Public Key: `2184034e2bc70671b6e4b1c0318de573b8ed1da4f66b14cec537c3965c4037ce`
   - Claim Hash: (64 hex chars)
   - Expiry Days: 365

4. The credential will be issued on-chain and can be viewed in the frontend.

### Via Browser (with public proof server):
1. Configure Lace wallet with public proof server URL
2. Connect to frontend
3. Use "Issue Credential" form
4. If version mismatch error appears, use CLI instead

## Contract Information

- **Address:** `650292271129bfbaf34029e48d71eab23086caebfbb561f3b8d6db956264f43d`
- **Network:** Midnight Preprod
- **Admin:** `mn_addr_preprod143cxjsszpmnwtnfa7un52pz3v0ksxqg59wpcrvvnc8gmwtyg4lhq9saweu`
- **Registered Issuer:** `2184034e2bc70671b6e4b1c0318de573b8ed1da4f66b14cec537c3965c4037ce` (ACTIVE)

## Dependencies

```json
{
  "@midnight-ntwrk/midnight-js": "4.0.2",
  "@midnight-ntwrk/compact-runtime": "0.15.0",
  "@midnight-ntwrk/ledger-v8": "8.0.3",
  "@midnight-ntwrk/compact-js": "2.5.0"
}
```

Compiled with Compact 0.30.0
