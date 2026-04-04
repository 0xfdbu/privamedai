# PrivaMedAI Contract Tests

Comprehensive test suite for the PrivaMedAI smart contract system.

## Test Coverage

### A. Issuer Management Tests
- **A.1 Initialize Contract with Admin**: Tests contract initialization with admin key
- **A.2 Register Issuer**: Tests issuer registration by admin
- **A.3 Get Issuer Info**: Tests retrieving issuer information
- **A.4 Update Issuer Status**: Tests status updates (ACTIVE, SUSPENDED, REVOKED)
- **A.5 Prevent Unauthorized Issuer Registration**: Tests access control

### B. Credential Lifecycle Tests
- **B.1 Issue Single Credential**: Tests individual credential issuance
- **B.2 Issue 3 Credentials (Bundled)**: Tests batch credential issuance
- **B.3 Check Credential Status**: Tests credential status queries
- **B.4 Revoke Credential (by Issuer)**: Tests issuer-initiated revocation
- **B.5 Admin Revoke Credential**: Tests admin emergency revocation
- **B.6 Prevent Issuing to Invalid Issuer**: Tests validation of issuer status

### C. Selective Disclosure Circuit Tests (CRITICAL)
- **C.1 verifyForFreeHealthClinic**: Tests age verification circuit (age >= threshold)
- **C.2 verifyForPharmacy**: Tests prescription verification circuit
- **C.3 verifyForHospital**: Tests combined age + condition verification
- **C.4 Proof Generation and Verification**: Tests SNARK proof generation and verification
- **C.5 Failure Cases**: Tests failure scenarios (wrong age, wrong condition, revoked credentials)

### D. Integration Tests
- **D.1 Simulator-Based Integration Flow**: Tests complete end-to-end workflows
  - Admin setup → issuer registration → credential issuance → verification
  - Multiple issuers and credentials
  - Batch issuance workflows

### E. Edge Case and Stress Tests
- Maximum age value (255)
- Maximum prescription code (65535)
- Zero values for all fields
- Rapid successive operations

### F. Access Control Tests
- Strict admin-only functions
- Strict issuer-only functions

## Running the Tests

```bash
# Run all tests
npm test

# Run with verbose output
npm run test:verbose

# Run in watch mode
npm run test:watch

# Run specific test file from root
cd .. && npx vitest run tests/contract-tests.ts
```

## Test Structure

Tests use the `PrivaMedAISimulator` which simulates the contract behavior without requiring:
- Docker containers
- Blockchain connection
- Proof servers
- Wallet setup

This allows for fast, deterministic testing of contract logic.

## Adding New Tests

To add new tests:

1. Import the simulator and types:
```typescript
import { PrivaMedAISimulator, computeClaimHash, computePublicKey } from '../contract/src/test/privamedai-simulator.js';
import { CredentialStatus, IssuerStatus } from '../contract/src/managed/PrivaMedAI/contract/index.js';
```

2. Create test data:
```typescript
const adminSk = new Uint8Array(32).fill(1);
const issuerSk = new Uint8Array(32).fill(2);
const issuerPk = computePublicKey(issuerSk);
```

3. Write your test:
```typescript
describe('My New Test', () => {
  it('should do something', () => {
    const sim = new PrivaMedAISimulator({ adminSecretKey: adminSk });
    // ... test logic
  });
});
```

## Integration with CI

These tests can be run in CI environments without additional infrastructure:

```yaml
# Example GitHub Actions
- name: Run Contract Tests
  run: |
    cd tests
    npm test
```

## Test Statistics

- **Total Tests**: 41
- **Test Categories**: 6
- **Average Execution Time**: < 1 second
- **Dependencies**: None (self-contained)
