# PrivaMedAI Deployment Scripts

## Quick Start

### 1. Test Wallet Connection First

Run the test script to verify wallet derivation and network connectivity:

```bash
cd /home/user/Desktop/midnight/repo/boilerplate/contract-cli
node test-wallet.js
```

This will:
- Convert your BIP39 mnemonic to seed
- Derive the wallet keys
- Show your Preprod address
- Try to sync with the network
- Check your balance

**Expected output:**
```
✅ Seed derived: b919d6825ea2a2cc81b9a44ac7e075e1...
✅ Keys derived successfully
Addresses:
  Unshielded: mn_addr_preprod1nn9dpkpyclk6r8uvs6wupn42mg7xxqkddw85m26utaglj4cgac4skh25lh
```

### 2. If Wallet Test Hangs

The Preprod network might be down. Check:
- Is your proof server running on localhost:6300?
- Can you reach https://faucet.preprod.midnight.network/ in your browser?
- Try again in a few minutes

### 3. Fund Your Wallet

Visit https://faucet.preprod.midnight.network/ and fund:
```
mn_addr_preprod1nn9dpkpyclk6r8uvs6wupn42mg7xxqkddw85m26utaglj4cgac4skh25lh
```

### 4. Run Full Deployment

Once wallet is funded:

```bash
./deploy-debug.sh
```

This will:
1. Build the project
2. Deploy the PrivaMedAI contract
3. Register your Lace wallet as an issuer

## Scripts

| Script | Purpose |
|--------|---------|
| `test-wallet.js` | Test wallet derivation and balance |
| `deploy-debug.sh` | Full deployment with debug output |
| `deploy-and-register.sh` | Original deployment script |

## Environment Variables

Set in your shell or `.env` file:

```bash
export WALLET_SEED="jewel fluid image merge dice edit oblige cloud fragile travel canal annual decide album steak stand physical venture earn divide eye announce prison regular"
```

## Troubleshooting

### "Wallet.Sync" errors
The Preprod RPC is having issues. Try:
1. Wait 5-10 minutes and retry
2. Check Midnight Discord for network status
3. Use local standalone network instead

### "No funds" message
Your wallet is working but empty. Fund it via the faucet.

### Build errors
```bash
npm run build
```

### Import errors
The script auto-fixes imports after build. If not:
```bash
cd dist && ./fix-imports.sh
```
