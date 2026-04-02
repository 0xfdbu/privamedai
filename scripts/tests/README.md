# PrivaMedAI Individual Tests

Run each test individually to avoid state conflicts.

## Prerequisites
- Proof server running on localhost:6300
- Wallet synced and funded

## Test Files

| Test | Command | Description |
|------|---------|-------------|
| 1 | `npx tsx scripts/tests/01-initialize.ts` | Initialize contract admin |
| 2 | `npx tsx scripts/tests/02-register-issuer.ts` | Register an issuer |
| 3 | `npx tsx scripts/tests/03-issue-credential.ts` | Issue single credential |
| 4 | `npx tsx scripts/tests/04-batch-issue.ts` | Batch issue 3 credentials |
| 5 | `npx tsx scripts/tests/05-verify-credential.ts` | Verify a credential |
| 6 | `npx tsx scripts/tests/06-revoke-credential.ts` | Revoke a credential |
| 7 | `npx tsx scripts/tests/07-update-issuer.ts` | Update issuer status |

## Notes

- Tests 5 and 6 use hardcoded commitments from Test 4 (batch issue)
- If Test 4 fails, update the commitment values in Tests 5 & 6
- Each test generates unique data to avoid conflicts
