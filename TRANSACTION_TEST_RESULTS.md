# PrivaMedAI Real Transaction Test Results

## Test Environment
- **Network**: Midnight Preprod
- **Contract Address**: `4d77ad64901ce46fba2f0589ab7171180f0e2b4ee2bfca5f43c9dd56ae92e297`
- **Wallet**: `mn_addr_preprod162e0043accv4ym78qyerwpu3hz8tqgrhcyt2retay9lu6p5hf5tqfthey4`
- **Balance**: 1,000,000,000 tNight

## Test Results Summary

| # | Feature | Status | Transaction Hash | Notes |
|---|---------|--------|------------------|-------|
| 1 | **Initialize Contract** | ✅ PASSED | `00f70b6be44b3471526464a81e2014821d8cadc5948e28e12fa202a6a92af27a` | 21.8s proof generation |
| 2 | Register Issuer | ❌ FAILED | - | Authentication key mismatch |
| 3 | Issue Credential | ❌ FAILED | - | Depends on issuer registration |
| 4 | Batch Issue 3 | ❌ FAILED | - | Depends on issuer registration |
| 5 | Verify Credential | ❌ FAILED | - | Depends on issued credentials |
| 6 | Bundled Verify 2 | ❌ FAILED | - | Depends on issued credentials |
| 7 | Revoke Credential | ❌ FAILED | - | Depends on issued credentials |
| 8 | Update Issuer Status | ❌ FAILED | - | Authentication key mismatch |

## Root Cause Analysis

### The Problem
The contract uses `get_public_key(local_secret_key())` for authentication:

```compact
pure circuit get_public_key(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "privamed:pk:"), sk]);
}
```

This derives a public key from the witness secret key using a special hash function (`persistentHash`).

### Why It Fails
1. During `initialize`, we pass `initialAdmin` as the wallet's **coin public key**
2. During `registerIssuer`, the contract derives the caller's key from the **witness secret key**
3. These two keys don't match because:
   - The wallet's coin public key comes from Zswap key derivation
   - The contract's `get_public_key()` uses a custom `persistentHash`
   - The hash algorithm is not SHA-256 (we tested multiple variants)

### What Works
- ✅ Contract deployment
- ✅ Wallet synchronization
- ✅ Transaction submission
- ✅ Proof generation (~20-30s per transaction)
- ✅ `initialize` circuit (takes admin as parameter, no derivation)

### What's Blocked
All circuits that use authentication:
- `registerIssuer` - requires admin key match
- `issueCredential` - requires issuer key match
- `batchIssue3Credentials` - requires issuer key match
- `revokeCredential` - requires issuer key match
- `updateIssuerStatus` - requires admin key match
- `adminRevokeCredential` - requires admin key match

## Potential Solutions

### Option 1: Fix the Contract (Recommended)
Modify the contract to accept `callerPubKey` as a disclosed parameter instead of deriving it:

```compact
export circuit registerIssuer(
  callerPubKey: Bytes<32>,  // Add this parameter
  issuerPubKey: Bytes<32>,
  nameHash: Bytes<32>
): [] {
  const d_callerPubKey = disclose(callerPubKey);
  // ...
  assert(disclose(d_callerPubKey == adminKey), "Only admin can register issuers");
  // Remove: const caller = get_public_key(local_secret_key());
}
```

**Requires**: Compact compiler (`compactc`) to recompile and redeploy.

### Option 2: Use Matching Keys
Find a secret key that, when passed through `get_public_key()`, produces the wallet's coin public key.

**Problem**: Cannot reverse `persistentHash` without knowing the algorithm.

### Option 3: Test with CLI
Use the interactive CLI to manually test each function with proper key management.

## Files Modified
- `PrivaMedAI.compact` - Fixed circuit signatures (callerPubKey parameter)
- `scripts/test-sequential.ts` - Sequential test runner
- `scripts/cli-privamedai.ts` - Interactive CLI tool
- `contract/src/witnesses-privamedai.ts` - Witness implementations

## Next Steps
To complete testing, you need to:
1. Install the Compact compiler (`compactc`)
2. Recompile the contract with the fixed authentication
3. Redeploy to preprod
4. Run the test suite again

## Installation of Compact Compiler
```bash
# Via npm (if available)
npm install -g @midnight-ntwrk/compactc

# Or via Docker
docker pull midnightntwrk/compactc:latest
```
