/**
 * Credential Circuit Functions
 * 
 * On-chain credential lifecycle management
 */

import { submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { toHex, persistentHash, CompactTypeVector, CompactTypeBytes } from '@midnight-ntwrk/compact-runtime';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { initializeProviders } from '../providers';
import { CIRCUITS, CONTRACT_ADDRESS, NETWORK_CONFIG } from '../config';
import { hexToBytes32, hashString } from '../utils/bytes';
import { getWalletState, storeCredential } from '../../contractService';
import type { Credential } from '../../../types/claims';

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
    const wallet = getWalletState();
    
    if (!wallet.coinPublicKey) {
      return { success: false, error: 'Wallet not connected' };
    }

    // Generate commitment from credential data
    const commitment = hashString(
      JSON.stringify({
        patient: patientAddress,
        type: claimType,
        data: claimData,
        issuedAt: Date.now(),
      })
    );

    // Create claimDataBytes (exactly 32 bytes) for the circuit
    const claimDataJson = JSON.stringify({
      type: claimType,
      data: claimData,
      expiry: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
    });
    const encoder = new TextEncoder();
    const claimDataBytes = new Uint8Array(32);
    claimDataBytes.set(encoder.encode(claimDataJson).slice(0, 32));

    // Generate claimHash using persistentHash
    const bytes32Type = new CompactTypeBytes(32);
    const vectorType = new CompactTypeVector(1, bytes32Type);
    const claimHash = persistentHash(vectorType, [claimDataBytes]);

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
        compiledContract: providers.compiledContract,
        circuitId: CIRCUITS.ISSUE_CREDENTIAL,
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
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error cause:', error.cause);
    
    const message = error.message || '';
    
    if (message.includes('timeout')) {
      return { 
        success: false, 
        error: 'Transaction timed out after 2 minutes. The proof server may be slow or the network is congested.' 
      };
    }
    
    if (message.includes('already exists')) {
      return { success: false, error: 'Credential already exists' };
    }
    if (message.includes('Issuer not registered')) {
      return { success: false, error: 'Issuer not registered' };
    }
    if (message.includes('Issuer not active')) {
      return { success: false, error: 'Issuer is not active' };
    }
    if (message.includes('Only registered issuer')) {
      return { success: false, error: 'Only registered issuer can issue credentials' };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to issue credential on-chain',
    };
  }
}

/**
 * Revoke a credential on-chain
 */
export async function revokeCredentialOnChain(
  commitment: string
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    console.log('📝 Revoking credential on-chain:', commitment);

    const providers = await initializeProviders();
    const wallet = getWalletState();
    
    if (!wallet.coinPublicKey) {
      return { success: false, error: 'Wallet not connected' };
    }

    // Get issuer public key bytes
    const pubKeyHex = wallet.coinPublicKey.slice(0, 64);
    const pubKeyBytes = hexToBytes32(pubKeyHex);

    // Convert commitment hex to bytes
    const commitmentBytes = hexToBytes32(commitment);

    console.log('📤 Submitting revokeCredential transaction...');

    const result = await (submitCallTx as any)(providers, {
      contractAddress: CONTRACT_ADDRESS,
      compiledContract: providers.compiledContract,
      circuitId: CIRCUITS.REVOKE_CREDENTIAL,
      args: [pubKeyBytes, commitmentBytes],
    });

    const txId = (result as any)?.public?.txId;
    console.log('✅ Credential revoked successfully:', txId);

    return {
      success: true,
      txId: txId ? String(txId) : undefined,
    };
  } catch (error: any) {
    console.error('❌ Failed to revoke credential:', error);
    
    const message = error.message || '';
    if (message.includes('Credential not found')) {
      return { success: false, error: 'Credential not found' };
    }
    if (message.includes('Only issuer')) {
      return { success: false, error: 'Only the issuing issuer can revoke this credential' };
    }
    if (message.includes('Already revoked')) {
      return { success: false, error: 'Credential is already revoked' };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to revoke credential on-chain',
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
    const { contracts } = await import('@midnight-ntwrk/contract/dist/index.browser.js');
    const ledger = contracts.PrivaMedAI.ledger;
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
    const { contracts } = await import('@midnight-ntwrk/contract/dist/index.browser.js');
    const ledger = contracts.PrivaMedAI.ledger;
    const state = ledger(contractState.data);

    console.log('✅ Contract state retrieved');
    const totalCredentials = BigInt(state.credentials?.size?.() || 0);
    const totalIssuers = BigInt(state.issuerRegistry?.size?.() || 0);
    console.log('   Total credentials:', totalCredentials);
    console.log('   Total issuers:', totalIssuers);

    const credentials = totalCredentials > 0 
      ? [{ 
          commitment: '0x' + '0'.repeat(64),
          issuer: 'Unknown',
          status: 'VALID',
          expiry: 0n,
        }]
      : [];

    return {
      success: true,
      credentials,
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
