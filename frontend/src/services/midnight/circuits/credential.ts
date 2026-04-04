/**
 * Credential Circuit Functions
 * 
 * On-chain credential lifecycle management
 */

import { submitCallTx, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { toHex, persistentHash, CompactTypeVector, CompactTypeBytes } from '@midnight-ntwrk/compact-runtime';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { initializeProviders } from '../providers';
import { getCompiledContract } from '../providers/contract';
import { createInitialPrivateState } from '../witnesses';
import { CIRCUITS, CONTRACT_ADDRESS, NETWORK_CONFIG } from '../config';
import { hexToBytes32, hashString } from '../utils/bytes';
import { getWalletState, storeCredential } from '../../contractService';
import type { Credential } from '../../../types/claims';

// Private state ID for this contract
const PRIVATE_STATE_ID = 'privamedai-private-state';

/**
 * Helper to ensure contract is found and private state is seeded
 */
async function ensureContractJoined(providers: any, wallet: any): Promise<void> {
  const compiledContract = await getCompiledContract();
  const initialPrivateState = createInitialPrivateState(
    hexToBytes32(wallet.coinPublicKey.slice(0, 64))
  );
  
  try {
    await findDeployedContract(providers, {
      contractAddress: CONTRACT_ADDRESS,
      compiledContract,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState,
    });
    console.log('✅ Found deployed contract and seeded private state');
  } catch (findError: any) {
    console.warn('⚠️ findDeployedContract warning (may be already joined):', findError.message);
    // Continue anyway - we might already be joined
  }
}

/**
 * Issue a credential on-chain
 */
export async function issueCredentialOnChain(
  patientAddress: string,
  claimType: string,
  claimData: string,
  expiryDays: number
): Promise<{
  success: boolean;
  txId?: string;
  commitment?: string;
  claimHash?: string;
  error?: string;
}> {
  try {
    console.log('📝 Issuing credential on-chain:', { patientAddress, claimType });

    const providers = await initializeProviders();
    const compiledContract = await getCompiledContract();
    const wallet = getWalletState();
    
    if (!wallet.coinPublicKey) {
      return { success: false, error: 'Wallet not connected' };
    }

    // Ensure contract is joined first
    await ensureContractJoined(providers, wallet);

    // Generate commitment from credential data
    const commitment = hashString(
      JSON.stringify({
        patient: patientAddress,
        type: claimType,
        data: claimData,
        issuedAt: Date.now(),
      })
    );

    // Parse claimData to extract health claim fields
    let healthClaimFields = { age: 18n, conditionCode: 100n, prescriptionCode: 500n };
    try {
      const parsedClaimData = JSON.parse(claimData);
      if (parsedClaimData.age !== undefined) {
        healthClaimFields.age = BigInt(parsedClaimData.age);
      }
      if (parsedClaimData.conditionCode !== undefined) {
        healthClaimFields.conditionCode = BigInt(parsedClaimData.conditionCode);
      }
      if (parsedClaimData.prescriptionCode !== undefined) {
        healthClaimFields.prescriptionCode = BigInt(parsedClaimData.prescriptionCode);
      }
    } catch (e) {
      console.warn('Could not parse claimData as JSON, using default health claim fields');
    }

    // Create claimDataBytes (exactly 32 bytes) for the circuit
    const claimDataJson = JSON.stringify({
      type: claimType,
      data: claimData,
      expiry: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
    });
    const encoder = new TextEncoder();
    const claimDataBytes = new Uint8Array(32);
    claimDataBytes.set(encoder.encode(claimDataJson).slice(0, 32));

    // Generate claimHash using the SAME formula as the circuit's _verify_claim_hash_private
    // Circuit computes: persistentHash([pad(32, "privamed:claim:"), age as Field, conditionCode as Field, prescriptionCode as Field])
    // Domain separator: "privamed:claim:" padded to 32 bytes
    const domainSep = new Uint8Array([112, 114, 105, 118, 97, 109, 101, 100, 58, 99, 108, 97, 105, 109, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    
    // Helper: Convert a bigint (Field) to 32-byte little-endian array
    function fieldToBytes32(value: bigint): Uint8Array {
      const bytes = new Uint8Array(32);
      let temp = value;
      for (let i = 0; i < 32 && temp > 0n; i++) {
        bytes[i] = Number(temp & 0xffn);
        temp >>= 8n;
      }
      return bytes;
    }
    
    const ageBytes = fieldToBytes32(healthClaimFields.age);
    const conditionBytes = fieldToBytes32(healthClaimFields.conditionCode);
    const prescriptionBytes = fieldToBytes32(healthClaimFields.prescriptionCode);
    
    const bytes32Type = new CompactTypeBytes(32);
    const vectorType = new CompactTypeVector(4, bytes32Type);
    const claimHash = persistentHash(vectorType, [domainSep, ageBytes, conditionBytes, prescriptionBytes]);
    
    console.log('   Health claim fields:', {
      age: healthClaimFields.age.toString(),
      conditionCode: healthClaimFields.conditionCode.toString(),
      prescriptionCode: healthClaimFields.prescriptionCode.toString(),
    });
    console.log('   Computed claimHash:', toHex(claimHash));

    // Calculate expiry timestamp
    const expiryTimestamp = BigInt(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    // Get issuer public key bytes
    const pubKeyHex = wallet.coinPublicKey.slice(0, 64);
    const pubKeyBytes = hexToBytes32(pubKeyHex);

    console.log('📤 Submitting issueCredential transaction...');
    console.log('   Proof server:', NETWORK_CONFIG.proofServer);

    // Add timeout to prevent infinite hanging
    const submitWithTimeout = Promise.race([
      (submitCallTx as any)(providers, {
        contractAddress: CONTRACT_ADDRESS,
        compiledContract,
        circuitId: CIRCUITS.ISSUE_CREDENTIAL,
        privateStateId: PRIVATE_STATE_ID,
        args: [pubKeyBytes, commitment, pubKeyBytes, claimHash, expiryTimestamp],
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction timeout - proof server may be slow or unresponsive')), 120000)
      )
    ]);

    const result = await submitWithTimeout;
    const txId = (result as any)?.public?.txId;
    console.log('✅ Credential issued successfully:', txId);

    // Store credential locally
    const credential: Credential = {
      id: toHex(commitment),
      issuer: wallet.coinPublicKey || '',
      claimType,
      issuedAt: Date.now(),
      expiresAt: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
      isRevoked: false,
      encryptedData: JSON.stringify({ patientAddress, claimData, issuedTo: patientAddress }),
      commitment: toHex(commitment),
      claimHash: toHex(claimHash),
      // Store health claim for witness access during verification
      healthClaim: {
        age: Number(healthClaimFields.age),
        conditionCode: Number(healthClaimFields.conditionCode),
        prescriptionCode: Number(healthClaimFields.prescriptionCode),
      },
    };
    storeCredential(credential);
    console.log('💾 Credential stored locally:', credential.id);

    return {
      success: true,
      txId: txId ? String(txId) : undefined,
      commitment: toHex(commitment),
      claimHash: toHex(claimHash),
    };
  } catch (error: any) {
    console.error('❌ Failed to issue credential:', error);
    
    // Extract the real error from the FiberFailure wrapper
    const cause = error.cause?.cause || error.cause;
    const causeMessage = cause?.message || cause?.failure?.message || error.cause?.message || '';
    
    console.error('   Real cause:', cause);
    console.error('   Cause message:', causeMessage);
    
    if (causeMessage.includes('Insufficient Funds') || causeMessage.includes('could not balance dust')) {
      return { 
        success: false, 
        error: 'Insufficient funds: Your wallet needs tDUST tokens. Get some from https://faucet.preprod.midnight.network/' 
      };
    }
    if (causeMessage.includes('timeout')) {
      return { 
        success: false, 
        error: 'Transaction timed out after 2 minutes. The proof server may be slow or the network is congested.' 
      };
    }
    if (causeMessage.includes('already exists')) {
      return { success: false, error: 'Credential already exists' };
    }
    if (causeMessage.includes('Issuer not registered')) {
      return { success: false, error: 'Issuer not registered' };
    }
    if (causeMessage.includes('Issuer not active')) {
      return { success: false, error: 'Issuer is not active' };
    }
    if (causeMessage.includes('Only registered issuer')) {
      return { success: false, error: 'Only registered issuer can issue credentials' };
    }
    
    return {
      success: false,
      error: causeMessage || error.message || 'Failed to issue credential on-chain',
    };
  }
}

/**
 * Query credentials on-chain
 */
export async function queryCredentialsOnChain(
  walletAddress: string
): Promise<{
  success: boolean;
  credentials?: any[];
  totalCredentials?: bigint;
  totalIssuers?: bigint;
  error?: string;
}> {
  try {
    console.log('🔍 Querying credentials on-chain for:', walletAddress.slice(0, 20) + '...');

    const publicDataProvider = indexerPublicDataProvider(
      NETWORK_CONFIG.indexer,
      NETWORK_CONFIG.indexerWS
    );

    const contractState = await publicDataProvider.queryContractState(CONTRACT_ADDRESS);
    
    if (!contractState) {
      return {
        success: false,
        error: 'Contract not found or no state available',
      };
    }

    // Parse ledger state
    const { ledger } = await import('@midnight-ntwrk/contract/dist/managed/PrivaMedAI/contract/index.js');
    const state = ledger(contractState.data);

    console.log('✅ Contract state retrieved');
    const totalCredentials = BigInt(state.credentials?.size?.() || 0);
    const totalIssuers = BigInt(state.issuerRegistry?.size?.() || 0);
    console.log('   Total credentials:', totalCredentials);
    console.log('   Total issuers:', totalIssuers);

    // Return only stats - actual credentials are stored in localStorage
    // The contract doesn't index credentials by patient address for privacy
    return {
      success: true,
      credentials: [],
      totalCredentials,
      totalIssuers,
    };
  } catch (error: any) {
    console.error('❌ Failed to query credentials:', error);
    return {
      success: false,
      error: error.message || 'Failed to query credentials on-chain',
    };
  }
}

/**
 * Check if a specific credential exists on-chain
 */
export async function checkCredentialOnChain(
  commitment: string
): Promise<{
  success: boolean;
  exists?: boolean;
  credential?: {
    issuer: string;
    status: string;
    expiry: bigint;
  };
  error?: string;
}> {
  try {
    console.log('🔍 Checking credential on-chain:', commitment.slice(0, 16) + '...');

    const publicDataProvider = indexerPublicDataProvider(
      NETWORK_CONFIG.indexer,
      NETWORK_CONFIG.indexerWS
    );

    const contractState = await publicDataProvider.queryContractState(CONTRACT_ADDRESS);
    
    if (!contractState) {
      return {
        success: false,
        error: 'Contract not found',
      };
    }

    // Parse ledger state
    const { ledger } = await import('@midnight-ntwrk/contract/dist/managed/PrivaMedAI/contract/index.js');
    const state = ledger(contractState.data);

    // Convert commitment hex to bytes32
    const commitmentBytes = hexToBytes32(commitment);
    
    // Check if credential exists
    const exists = state.credentials.member(commitmentBytes);
    
    if (!exists) {
      return {
        success: true,
        exists: false,
      };
    }

    // Get credential details
    const credential = state.credentials.lookup(commitmentBytes);

    return {
      success: true,
      exists: true,
      credential: {
        issuer: toHex(credential.issuer),
        status: credential.status === 0 ? 'VALID' : 'REVOKED',
        expiry: credential.expiry,
      },
    };
  } catch (error: any) {
    console.error('❌ Failed to check credential:', error);
    return {
      success: false,
      error: error.message || 'Failed to check credential on-chain',
    };
  }
}


/**
 * Revoke a credential on-chain (issuer only)
 */
export async function revokeCredentialOnChain(
  callerPubKey: string,
  commitment: string
): Promise<{
  success: boolean;
  txId?: string;
  error?: string;
}> {
  try {
    console.log('🗑️ Revoking credential on-chain:', commitment.slice(0, 16) + '...');

    const providers = await initializeProviders();
    const compiledContract = await getCompiledContract();
    const wallet = getWalletState();
    
    if (!wallet.coinPublicKey) {
      return { success: false, error: 'Wallet not connected' };
    }

    // Ensure contract is joined first
    await ensureContractJoined(providers, wallet);

    // Convert commitment hex to bytes32
    const commitmentBytes = hexToBytes32(commitment);
    
    // Convert caller pubkey to bytes32
    const pubKeyBytes = hexToBytes32(callerPubKey.slice(0, 64));

    console.log('📤 Submitting revokeCredential transaction...');

    // Add timeout to prevent infinite hanging
    const submitWithTimeout = Promise.race([
      (submitCallTx as any)(providers, {
        contractAddress: CONTRACT_ADDRESS,
        compiledContract,
        circuitId: CIRCUITS.REVOKE_CREDENTIAL,
        privateStateId: PRIVATE_STATE_ID,
        args: [pubKeyBytes, commitmentBytes],
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction timeout - proof server may be slow or unresponsive')), 120000)
      )
    ]);

    const result = await submitWithTimeout;
    const txId = (result as any)?.public?.txId;
    console.log('✅ Credential revoked successfully:', txId);

    return {
      success: true,
      txId: txId ? String(txId) : undefined,
    };
  } catch (error: any) {
    console.error('❌ Failed to revoke credential:', error);
    
    // Extract the real error from the FiberFailure wrapper
    const cause = error.cause?.cause || error.cause;
    const causeMessage = cause?.message || cause?.failure?.message || error.cause?.message || '';
    
    console.error('   Real cause:', cause);
    console.error('   Cause message:', causeMessage);
    
    if (causeMessage.includes('Insufficient Funds') || causeMessage.includes('could not balance dust')) {
      return { 
        success: false, 
        error: 'Insufficient funds: Your wallet needs tDUST tokens. Get some from https://faucet.preprod.midnight.network/' 
      };
    }
    if (causeMessage.includes('timeout')) {
      return { 
        success: false, 
        error: 'Transaction timed out after 2 minutes. The proof server may be slow or the network is congested.' 
      };
    }
    if (causeMessage.includes('Only issuer can revoke')) {
      return { success: false, error: 'Only the original issuer can revoke this credential' };
    }
    if (causeMessage.includes('Credential not found')) {
      return { success: false, error: 'Credential not found on-chain' };
    }
    if (causeMessage.includes('Already revoked')) {
      return { success: false, error: 'Credential is already revoked' };
    }
    
    return {
      success: false,
      error: causeMessage || error.message || 'Failed to revoke credential on-chain',
    };
  }
}
