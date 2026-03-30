import {
  type CircuitContext,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext,
  persistentHash,
  CompactTypeBytes,
  CompactTypeVector,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  type Ledger,
  ledger,
  CredentialStatus,
} from '../managed/PrivaCred/contract/index.js';
import { type PrivaCredPrivateState, witnesses } from '../witnesses.js';

const bytes32Type = new CompactTypeBytes(32);
const vector1Bytes32Type = new CompactTypeVector(1, bytes32Type);
const vector2Bytes32Type = new CompactTypeVector(2, bytes32Type);

export function computeClaimHash(credentialData: Uint8Array): Uint8Array {
  return persistentHash(vector1Bytes32Type, [credentialData]);
}

export function computePublicKey(secretKey: Uint8Array): Uint8Array {
  const pkPrefix = new TextEncoder().encode('privacred:pk:').slice(0, 32);
  return persistentHash(vector2Bytes32Type, [pkPrefix, secretKey]);
}

export class PrivaCredSimulator {
  readonly contract: Contract<PrivaCredPrivateState>;
  circuitContext: CircuitContext<PrivaCredPrivateState>;

  constructor(privateState: PrivaCredPrivateState = { secretKey: new Uint8Array(32), credentialData: new Uint8Array(32) }) {
    this.contract = new Contract<PrivaCredPrivateState>(witnesses);
    const constructorResult = this.contract.initialState(
      createConstructorContext(privateState, new Uint8Array(32).fill(0))
    );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      constructorResult.currentZswapLocalState,
      constructorResult.currentContractState,
      constructorResult.currentPrivateState
    );
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): PrivaCredPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public issueCredential(
    commitment: Uint8Array,
    issuer: Uint8Array,
    claimHash: Uint8Array,
    expiry: bigint
  ): Ledger {
    const result = this.contract.circuits.issueCredential(
      this.circuitContext,
      commitment,
      issuer,
      claimHash,
      expiry
    );
    this.circuitContext = result.context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public verifyCredential(commitment: Uint8Array): boolean {
    const result = this.contract.circuits.verifyCredential(
      this.circuitContext,
      commitment
    );
    this.circuitContext = result.context;
    return result.result;
  }

  public revokeCredential(commitment: Uint8Array): Ledger {
    const result = this.contract.circuits.revokeCredential(
      this.circuitContext,
      commitment
    );
    this.circuitContext = result.context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }
}
