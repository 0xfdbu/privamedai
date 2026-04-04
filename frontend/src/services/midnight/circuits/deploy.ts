/**
 * Deployment Functions
 * 
 * Contract deployment (for testing/development)
 */

import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { initializeProviders } from '../providers';
import { hexToBytes32 } from '../utils/bytes';
import { getWalletState } from '../../contractService';

/**
 * Deploy a new contract instance
 * NOTE: This is for testing/development only
 */
export async function deployNewContract(
  initialAdmin?: string
): Promise<{
  success: boolean;
  contractAddress?: string;
  txId?: string;
  error?: string;
}> {
  try {
    console.log('🚀 Deploying new contract...');

    const providers = await initializeProviders();
    const wallet = getWalletState();
    
    if (!wallet.coinPublicKey) {
      return { success: false, error: 'Wallet not connected' };
    }

    // Use provided admin or default to wallet
    const adminPubKey = initialAdmin || wallet.coinPublicKey.slice(0, 64);
    const adminBytes = hexToBytes32(adminPubKey);

    console.log('📤 Deploying contract with admin:', adminPubKey.slice(0, 16) + '...');

    const result = await (deployContract as any)(providers, {
      compiledContract: providers.compiledContract,
      initialPrivateState: {},
      args: [adminBytes],
    });

    const contractAddress = (result as any)?.contractAddress;
    const txId = (result as any)?.txId;
    
    console.log('✅ Contract deployed!');
    console.log('   Address:', contractAddress);
    console.log('   Tx ID:', txId);

    return {
      success: true,
      contractAddress: contractAddress ? String(contractAddress) : undefined,
      txId: txId ? String(txId) : undefined,
    };
  } catch (error: any) {
    console.error('❌ Failed to deploy contract:', error);
    return {
      success: false,
      error: error.message || 'Failed to deploy contract',
    };
  }
}
