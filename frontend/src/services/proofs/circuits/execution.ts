/**
 * Circuit Execution
 * 
 * Execute circuits using on-chain state to generate proof data
 */

import { createCircuitContext, dummyContractAddress, toHex, ChargedState } from '@midnight-ntwrk/compact-runtime';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { CONFIG, getContractAddress } from '../../contractService';
import type { PrivaMedAICircuit } from '../config';

export interface ProofData {
  input: any;
  output: any;
  publicTranscript: any[];
  privateTranscriptOutputs: any[];
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
    const contractModule = await import('@midnight-ntwrk/contract/dist/index.browser.js');
    const { contracts } = contractModule;
    const ledger = contracts.PrivaMedAI.ledger;
    
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
 * Execute the circuit using REAL on-chain state to generate proof data
 */
export async function executeCircuitAndGetProofData(
  circuitId: PrivaMedAICircuit,
  commitmentBytes: Uint8Array,
  credentialDataBytes: Uint8Array,
  _credentialDataHash: Uint8Array
): Promise<ProofData> {
  // Import the browser-compatible contract entry point
  const contractModule = await import('@midnight-ntwrk/contract/dist/index.browser.js');
  const { contracts } = contractModule;
  
  const PrivaMedAI = contracts.PrivaMedAI;
  if (!PrivaMedAI) {
    throw new Error('PrivaMedAI contract not found in compiled module');
  }
  
  const { Contract } = PrivaMedAI;
  if (!Contract) {
    throw new Error('Contract class not found in PrivaMedAI module');
  }
  
  // Create contract instance with empty witnesses
  const contract = new Contract({});
  
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
    {} // privateState
  );
  
  let circuitResult;
  switch (circuitId) {
    case 'verifyCredential':
      circuitResult = contract.circuits.verifyCredential(
        circuitContext,
        commitmentBytes,
        credentialDataBytes
      );
      break;
    case 'bundledVerify2Credentials':
      circuitResult = contract.circuits.bundledVerify2Credentials(
        circuitContext,
        commitmentBytes, credentialDataBytes,
        commitmentBytes, credentialDataBytes
      );
      break;
    case 'bundledVerify3Credentials':
      circuitResult = contract.circuits.bundledVerify3Credentials(
        circuitContext,
        commitmentBytes, credentialDataBytes,
        commitmentBytes, credentialDataBytes,
        commitmentBytes, credentialDataBytes
      );
      break;
    default:
      throw new Error(`Unsupported circuit: ${circuitId}`);
  }
  
  if (!circuitResult || !circuitResult.proofData) {
    throw new Error('Circuit execution did not return proof data');
  }
  
  return circuitResult.proofData;
}
