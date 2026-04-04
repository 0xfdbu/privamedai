/**
 * Circuit Execution
 * 
 * Execute circuits using on-chain state to generate proof data
 */

import { createCircuitContext, dummyContractAddress, toHex, ChargedState } from '@midnight-ntwrk/compact-runtime';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { CONFIG, getContractAddress } from '../../contractService';
import type { PrivaMedAICircuit } from '../config';
import type { HealthClaim } from '../../../types/claims';

export interface ProofData {
  input: any;
  output: any;
  publicTranscript: any[];
  privateTranscriptOutputs: any[];
}

/**
 * Private state for the PrivaMedAI contract
 * Stores the health claim data used by witnesses
 * NOTE: Circuit expects BigInt values (Compact Uint types map to bigint)
 */
export interface PrivaMedAIPrivateState {
  healthClaim?: {
    age: bigint;
    conditionCode: bigint;
    prescriptionCode: bigint;
  };
}

/**
 * Fetch the actual on-chain contract state from the indexer
 */
export async function fetchContractState(
  _commitmentBytes?: Uint8Array
): Promise<{ chargedState: ChargedState; parsedState: any } | null> {
  try {
    console.log('   Fetching on-chain contract state...');
    
    const publicDataProvider = indexerPublicDataProvider(
      CONFIG.indexer,
      CONFIG.indexerWS
    );
    
    const contractState = await publicDataProvider.queryContractState(getContractAddress());
    
    if (!contractState) {
      console.error('   Contract not found on-chain');
      return null;
    }
    
    // Parse the ledger state using the contract's ledger function for logging
    const { ledger } = await import('@midnight-ntwrk/contract/dist/managed/PrivaMedAI/contract/index.js');
    
    if (!ledger) {
      throw new Error('Ledger function not found in contract');
    }
    
    // Parse the contract state for logging
    const parsedState = ledger(contractState.data);
    
    console.log('   On-chain state loaded:');
    console.log('     - Credentials:', parsedState.credentials?.size?.() || 0);
    console.log('     - Issuers:', parsedState.issuerRegistry?.size?.() || 0);
    
    // Log specific credential info if commitment provided
    let credentialExists = false;
    if (_commitmentBytes) {
      try {
        credentialExists = parsedState.credentials.member(_commitmentBytes);
        if (credentialExists) {
          const cred = parsedState.credentials.lookup(_commitmentBytes);
          console.log('   Credential found:');
          console.log('     - Stored claimHash:', toHex(cred.claimHash));
          console.log('     - Issuer:', toHex(cred.issuer).slice(0, 20) + '...');
          console.log('     - Expiry:', cred.expiry);
          console.log('     - Status:', cred.status);
        } else {
          console.error('   ❌ CRITICAL: Credential NOT FOUND in on-chain state!');
          throw new Error('Credential does not exist on-chain. Cannot generate proof.');
        }
      } catch (e: any) {
        if (e.message.includes('does not exist')) {
          throw e;
        }
        console.log('   Error looking up credential:', e.message);
      }
    }
    
    return { chargedState: contractState.data, parsedState };
    
  } catch (error: any) {
    console.error('   Failed to fetch contract state:', error.message);
    return null;
  }
}

/**
 * Create witnesses object for the PrivaMedAI contract
 * Maps witness function names to their implementations
 */
function createWitnesses(privateState: PrivaMedAIPrivateState) {
  return {
    // For standard verification - returns empty bytes
    local_secret_key: (): [PrivaMedAIPrivateState, Uint8Array] => {
      return [privateState, new Uint8Array(32)];
    },
    
    // For selective disclosure - returns the health claim data as bigints
    get_private_health_claim: (): [PrivaMedAIPrivateState, { age: bigint; conditionCode: bigint; prescriptionCode: bigint }] => {
      if (!privateState.healthClaim) {
        throw new Error('HealthClaim witness data not provided');
      }
      return [privateState, {
        age: BigInt(privateState.healthClaim.age),
        conditionCode: BigInt(privateState.healthClaim.conditionCode),
        prescriptionCode: BigInt(privateState.healthClaim.prescriptionCode),
      }];
    },
  };
}

/**
 * Circuit parameters for selective disclosure circuits
 */
export interface CircuitParams {
  minAge?: bigint;
  requiredPrescription?: bigint;
  requiredCondition?: bigint;
}

/**
 * Execute the circuit using REAL on-chain state to generate proof data
 * 
 * For selective disclosure circuits (verifyForFreeHealthClinic, verifyForPharmacy, verifyForHospital),
 * the healthClaim parameter must be provided in privateState.
 * 
 * Circuit parameters (thresholds) must be provided via circuitParams:
 * - verifyForFreeHealthClinic: minAge (default: 18n)
 * - verifyForPharmacy: requiredPrescription (default: 500n)
 * - verifyForHospital: minAge (default: 18n), requiredCondition (default: 100n)
 */
export async function executeCircuitAndGetProofData(
  circuitId: PrivaMedAICircuit,
  commitmentBytes: Uint8Array,
  _credentialDataBytes: Uint8Array,
  _credentialDataHash: Uint8Array,
  privateState: PrivaMedAIPrivateState = {},
  circuitParams: CircuitParams = {}
): Promise<ProofData> {
  // Import the contract entry point (browser-compatible)
  const { Contract } = await import('@midnight-ntwrk/contract/dist/managed/PrivaMedAI/contract/index.js');
  
  // Create contract instance with witnesses
  const witnesses = createWitnesses(privateState);
  const contract = new Contract(witnesses);
  
  // Fetch the REAL on-chain state
  const onChainState = await fetchContractState(commitmentBytes);
  if (!onChainState) {
    throw new Error('Failed to fetch on-chain contract state. Cannot generate valid proof without real state.');
  }
  
  // Create the circuit context with the REAL on-chain state
  const circuitContext = createCircuitContext(
    dummyContractAddress(),
    '0'.repeat(64),
    onChainState.chargedState,
    privateState
  );
  
  let circuitResult;
  
  // Our contract has 12 circuits - only selective disclosure circuits are available for verification
  switch (circuitId) {
    // Selective disclosure circuits
    case 'verifyForFreeHealthClinic': {
      if (!privateState.healthClaim) {
        throw new Error('HealthClaim required for verifyForFreeHealthClinic circuit');
      }
      const freeHealthClinicCircuit = (contract.circuits as any).verifyForFreeHealthClinic;
      if (!freeHealthClinicCircuit) {
        throw new Error('verifyForFreeHealthClinic circuit not available in this contract version.');
      }
      // minAge threshold (default 18) - proves: witness_age >= minAge
      const minAge = circuitParams.minAge ?? 18n;
      circuitResult = freeHealthClinicCircuit(
        circuitContext,
        commitmentBytes,
        minAge
      );
      break;
    }
    case 'verifyForPharmacy': {
      if (!privateState.healthClaim) {
        throw new Error('HealthClaim required for verifyForPharmacy circuit');
      }
      const pharmacyCircuit = (contract.circuits as any).verifyForPharmacy;
      if (!pharmacyCircuit) {
        throw new Error('verifyForPharmacy circuit not available in this contract version.');
      }
      // requiredPrescription code (default 500) - proves: witness_prescriptionCode == requiredPrescription
      const requiredPrescription = circuitParams.requiredPrescription ?? 500n;
      circuitResult = pharmacyCircuit(
        circuitContext,
        commitmentBytes,
        requiredPrescription
      );
      break;
    }
    case 'verifyForHospital': {
      if (!privateState.healthClaim) {
        throw new Error('HealthClaim required for verifyForHospital circuit');
      }
      const hospitalCircuit = (contract.circuits as any).verifyForHospital;
      if (!hospitalCircuit) {
        throw new Error('verifyForHospital circuit not available in this contract version.');
      }
      // minAge threshold (default 18) and requiredCondition code (default 100)
      // proves: witness_age >= minAge AND witness_conditionCode == requiredCondition
      const minAge = circuitParams.minAge ?? 18n;
      const requiredCondition = circuitParams.requiredCondition ?? 100n;
      circuitResult = hospitalCircuit(
        circuitContext,
        commitmentBytes,
        minAge,
        requiredCondition
      );
      break;
    }
    default:
      throw new Error(`Unsupported circuit: ${circuitId}`);
  }
  
  if (!circuitResult || !circuitResult.proofData) {
    throw new Error('Circuit execution did not return proof data');
  }
  
  return circuitResult.proofData;
}
