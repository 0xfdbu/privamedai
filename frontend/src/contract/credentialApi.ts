import { fromHex, toHex } from '@midnight-ntwrk/compact-runtime';
import { Transaction, SignatureEnabled, Proof, Binding } from '@midnight-ntwrk/ledger-v8';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import * as PrivaMedAI from '../../../contract/dist/managed/PrivaMedAI/contract/index.js';
import type { PrivateStateId, PrivateStateProvider } from '@midnight-ntwrk/midnight-js-types';

const CONTRACT_ADDRESS = '8b5e6beaece98e9af39b323aea15dda68881e95483effe29950dfc92add6800d';
const PRIVATE_STATE_ID = 'privamedai-default';

export enum CredentialStatus { VALID = 0, REVOKED = 1 }
export enum IssuerStatus { PENDING = 0, ACTIVE = 1, SUSPENDED = 2, REVOKED = 3 }

export interface CredentialData {
  commitment: string;
  issuer: string;
  claimHash: string;
  expiry: number;
  status: 'VALID' | 'REVOKED';
}

export interface CredentialWithPrivateData extends CredentialData {
  credentialData: string;
  claimType: string;
  claimValue: string;
}

export interface IssuerInfo {
  publicKey: string;
  status: IssuerStatus;
  nameHash: string;
  credentialCount: bigint;
}

export interface CredentialAPI {
  initialize(adminPublicKey: string): Promise<string>;
  registerIssuer(issuerPubKey: string, nameHash: string): Promise<string>;
  updateIssuerStatus(issuerPubKey: string, newStatus: IssuerStatus): Promise<string>;
  getIssuerInfo(issuerPubKey: string): Promise<IssuerInfo | null>;
  issueCredential(commitment: string, claimHash: string, expiryDays: number): Promise<string>;
  revokeCredential(commitment: string): Promise<string>;
  adminRevokeCredential(commitment: string, reasonHash: string): Promise<string>;
  checkCredentialStatus(commitment: string): Promise<CredentialStatus | null>;
  verifyCredential(commitment: string, credentialData: string): Promise<boolean>;
  verifyOnChain(commitment: string, claimHash: string): Promise<boolean>;
  // Parametric verification circuits (new)
  verifyAgeRange(commitment: string, minAge: number, maxAge: number): Promise<boolean>;
  verifyDiabetesTrialEligibility(commitment: string): Promise<boolean>;
  verifyFreeHealthcareEligibility(commitment: string): Promise<boolean>;
  verifyHealthcareWorkerClearance(commitment: string): Promise<boolean>;
  verifyParametricClaim(commitment: string, credentialData: string, expectedClaimHash: string): Promise<boolean>;
  storeCredential(credential: CredentialWithPrivateData): void;
  getStoredCredentials(): CredentialWithPrivateData[];
  getContractAddress(): string;
  getContractState(): Promise<{ roundCounter: bigint; totalCredentials: bigint; totalVerifications: bigint } | null>;
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace('0x', '');
  return fromHex(cleanHex);
}

export async function createCredentialAPI(
  walletApi: any,
  config: { indexerUri: string; indexerWsUri: string; proofServerUri: string; networkId: string }
): Promise<CredentialAPI> {
  
  setNetworkId(config.networkId);
  
  const shieldedAddresses = await walletApi.getShieldedAddresses();
  const uris = await walletApi.getConfiguration();
  
  const getCallerPubKey = (): Uint8Array => {
    return hexToBytes(shieldedAddresses.shieldedCoinPublicKey);
  };

  // Track witness data for circuits that need private inputs
  let credentialDataWitness: Uint8Array = new Uint8Array(32);
  
  // Create contract witnesses
  const witnesses = {
    local_secret_key: () => new Uint8Array(32),
    get_credential_data: () => credentialDataWitness,
  };
  
  // Create contract instance (for potential direct use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _contractInstance = new PrivaMedAI.Contract(witnesses);
  
  // In-memory private state storage
  const privateStateStore = new Map<string, any>();
  
  // In-memory private state provider
  const privateStateProvider: PrivateStateProvider<string, any> = {
    setContractAddress: (address: any) => {
      console.log('Private state provider scoped to contract:', address);
    },
    get: async (id: string) => privateStateStore.get(id) || null,
    set: async (id: string, state: any) => {
      privateStateStore.set(id, state);
      console.log('Private state stored for ID:', id);
    },
    remove: async (id: string) => { privateStateStore.delete(id); },
    clear: async () => privateStateStore.clear(),
    setSigningKey: async () => {},
    getSigningKey: async () => null,
    removeSigningKey: async () => {},
    clearSigningKeys: async () => {},
    exportPrivateStates: async () => ({ format: 'midnight-private-state-export', encryptedPayload: '', salt: '' }),
    importPrivateStates: async () => ({ imported: 0, notImported: 0, skipped: 0, overwritten: 0 }),
    exportSigningKeys: async () => ({ format: 'midnight-signing-key-export', encryptedPayload: '', salt: '' }),
    importSigningKeys: async () => ({ imported: 0, notImported: 0, skipped: 0, overwritten: 0 }),
  };
  
  // Set contract address and initialize private state
  // The contract address scopes the private state to this specific contract
  // Using a dummy object since we're using in-memory storage
  privateStateProvider.setContractAddress({ toHexString: () => CONTRACT_ADDRESS } as any);
  await privateStateProvider.set(PRIVATE_STATE_ID, {});

  // Wallet provider for transaction signing
  const walletProvider = {
    getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
    async balanceTx(tx: any) {
      const serialized = toHex(tx.serialize());
      const received = await walletApi.balanceUnsealedTransaction(serialized);
      return Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', fromHex(received.tx));
    },
  };

  const midnightProvider = {
    async submitTx(tx: any) {
      await walletApi.submitTransaction(toHex(tx.serialize()));
      return tx.identifiers()[0];
    },
  };

  // Set up ZK config provider to load circuit configs from the contract build
  const zkConfigProvider = new FetchZkConfigProvider(
    uris.zkConfigUri || window.location.origin, 
    fetch.bind(window)
  );
  
  // Create proof provider with the configured proof server
  // ALWAYS use the configured proof server (ignore wallet's URL to avoid CORS issues)
  // The wallet may provide a different URL, but we need to use our configured one
  const proofServerUrl = config.proofServerUri || 'http://localhost:6300';
  console.log('Wallet suggests:', uris.proverServerUri);
  console.log('Using configured proof server:', proofServerUrl);
  const proofProvider = httpClientProofProvider(proofServerUrl, zkConfigProvider);
  
  // Build compiled contract with proper configuration
  // Using pipe pattern - first apply witnesses, then compiled file assets
  let compiledContract: any = CompiledContract.make('privamedai', PrivaMedAI.Contract);
  compiledContract = (CompiledContract.withWitnesses as any)(compiledContract, witnesses);
  compiledContract = (CompiledContract.withCompiledFileAssets as any)(compiledContract, window.location.origin + '/zk-configs');

  const providers: any = {
    privateStateProvider,
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
  };

  // Helper to submit circuit calls using midnight-js-contracts
  const submitCircuitCall = async (circuitId: string, args: any[]): Promise<string> => {
    console.log(`Submitting ${circuitId} with args:`, args);
    try {
      const txOptions: any = {
        compiledContract,
        contractAddress: CONTRACT_ADDRESS,
        circuitId,
        privateStateId: PRIVATE_STATE_ID,
        args,
      };
      const txData: any = await submitCallTx(providers, txOptions);
      console.log(`${circuitId} transaction successful:`, txData.public.txId);
      return txData.public.txId;
    } catch (error: any) {
      console.error(`${circuitId} failed:`, error);
      
      // Check for connection errors (proof server not running)
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError') || error.message?.includes('ECONNREFUSED')) {
        const enhancedError = new Error(
          `${error.message}\n\n` +
          '⚠️ Proof Server Not Running!\n\n' +
          'Start the local proof server:\n' +
          '   docker run -p 6300:6300 midnightnetwork/proof-server:latest\n\n' +
          'Wait for "listening on: 0.0.0.0:6300" then refresh the page.\n\n' +
          'Or use CLI (no proof server needed):\n' +
          '   npm run cli:privamedai'
        );
        throw enhancedError;
      }
      
      // Check for proof server version mismatch (400 Bad Request)
      if (error.message?.includes('400') || error.message?.includes('Bad Request')) {
        const enhancedError = new Error(
          `${error.message}\n\n` +
          '⚠️ Proof Server Version Mismatch!\n' +
          'Local proof server (v7.0.0-rc.1) is incompatible with contract (Compact 0.30.0).\n\n' +
          '✅ USE CLI (Recommended - Always Works):\n' +
          '   npm run cli:privamedai\n' +
          '   Then select option 6 (Issue Credential)\n\n' +
          'The CLI uses the wallet\'s internal proving and bypasses this issue.'
        );
        throw enhancedError;
      }
      
      throw error;
    }
  };

  return {
    async initialize(adminPublicKey: string): Promise<string> {
      return submitCircuitCall('initialize', [hexToBytes(adminPublicKey)]);
    },
    
    async registerIssuer(issuerPubKey: string, nameHash: string): Promise<string> {
      const callerPubKey = getCallerPubKey();
      // Ensure nameHash is exactly 64 hex chars (32 bytes)
      const paddedNameHash = nameHash.padEnd(64, '0').slice(0, 64);
      return submitCircuitCall('registerIssuer', [callerPubKey, hexToBytes(issuerPubKey), hexToBytes(paddedNameHash)]);
    },
    
    async updateIssuerStatus(issuerPubKey: string, newStatus: IssuerStatus): Promise<string> {
      const callerPubKey = getCallerPubKey();
      return submitCircuitCall('updateIssuerStatus', [callerPubKey, hexToBytes(issuerPubKey), newStatus]);
    },
    
    async getIssuerInfo(): Promise<IssuerInfo | null> {
      // TODO: Query from indexer when properly typed
      return null;
    },
    
    async issueCredential(commitment: string, claimHash: string, expiryDays: number): Promise<string> {
      const callerPubKey = getCallerPubKey();
      const expiry = BigInt(Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60));
      
      const txId = await submitCircuitCall('issueCredential', [
        callerPubKey, hexToBytes(commitment), callerPubKey, hexToBytes(claimHash), expiry
      ]);
      
      // Store in localStorage for tracking
      const existing = JSON.parse(localStorage.getItem('privamed_issued') || '[]');
      existing.push({ commitment, claimHash, expiry: Number(expiry), timestamp: Date.now(), txId });
      localStorage.setItem('privamed_issued', JSON.stringify(existing));
      
      return txId;
    },
    
    async revokeCredential(commitment: string): Promise<string> {
      const callerPubKey = getCallerPubKey();
      return submitCircuitCall('revokeCredential', [callerPubKey, hexToBytes(commitment)]);
    },
    
    async adminRevokeCredential(commitment: string, reasonHash: string): Promise<string> {
      const callerPubKey = getCallerPubKey();
      return submitCircuitCall('adminRevokeCredential', [callerPubKey, hexToBytes(commitment), hexToBytes(reasonHash)]);
    },
    
    async checkCredentialStatus(commitment: string): Promise<CredentialStatus | null> {
      try {
        await submitCircuitCall('checkCredentialStatus', [hexToBytes(commitment)]);
        return null;
      } catch (e) {
        return null;
      }
    },
    
    async verifyCredential(commitment: string, credentialData: string): Promise<boolean> {
      credentialDataWitness = hexToBytes(credentialData);
      try {
        await submitCircuitCall('verifyCredential', [hexToBytes(commitment), credentialDataWitness]);
        return true;
      } catch (e) {
        return false;
      }
    },
    
    async verifyOnChain(commitment: string): Promise<boolean> {
      // Simulate on-chain verification proof
      await new Promise(r => setTimeout(r, 500));
      const stored = JSON.parse(localStorage.getItem('privamed_issued') || '[]');
      return stored.some((c: any) => c.commitment === commitment);
    },
    
    // Parametric verification circuits (new)
    async verifyAgeRange(commitment: string, minAge: number, maxAge: number): Promise<boolean> {
      // Simulate ZK proof verification for age range
      console.log(`Verifying age range ${minAge}-${maxAge} for commitment ${commitment.slice(0, 10)}...`);
      await new Promise(r => setTimeout(r, 800));
      // Mock result - in production this would call the actual circuit
      return true;
    },
    
    async verifyDiabetesTrialEligibility(commitment: string): Promise<boolean> {
      // Simulate ZK proof verification for diabetes trial
      console.log(`Verifying diabetes trial eligibility for commitment ${commitment.slice(0, 10)}...`);
      await new Promise(r => setTimeout(r, 1000));
      // Mock result
      return true;
    },
    
    async verifyFreeHealthcareEligibility(commitment: string): Promise<boolean> {
      // Simulate ZK proof verification for free healthcare eligibility
      console.log(`Verifying free healthcare eligibility for commitment ${commitment.slice(0, 10)}...`);
      await new Promise(r => setTimeout(r, 800));
      // Mock result
      return true;
    },
    
    async verifyHealthcareWorkerClearance(commitment: string): Promise<boolean> {
      // Simulate ZK proof verification for healthcare clearance
      console.log(`Verifying healthcare worker clearance for commitment ${commitment.slice(0, 10)}...`);
      await new Promise(r => setTimeout(r, 800));
      // Mock result
      return true;
    },
    
    async verifyParametricClaim(commitment: string, _credentialData: string, _expectedClaimHash: string): Promise<boolean> {
      // Simulate generic parametric claim verification
      console.log(`Verifying parametric claim for commitment ${commitment.slice(0, 10)}...`);
      await new Promise(r => setTimeout(r, 600));
      // Mock result
      return true;
    },
    
    storeCredential(credential: CredentialWithPrivateData): void {
      const existing = JSON.parse(localStorage.getItem('privamed_creds') || '[]');
      existing.push({ ...credential, storedAt: Date.now() });
      localStorage.setItem('privamed_creds', JSON.stringify(existing));
    },
    
    getStoredCredentials(): CredentialWithPrivateData[] {
      return JSON.parse(localStorage.getItem('privamed_creds') || '[]');
    },
    
    getContractAddress(): string {
      return CONTRACT_ADDRESS;
    },
    
    async getContractState(): Promise<{ roundCounter: bigint; totalCredentials: bigint; totalVerifications: bigint } | null> {
      // TODO: Query from indexer when properly typed
      return {
        roundCounter: 0n,
        totalCredentials: 0n,
        totalVerifications: 0n,
      };
    }
  };
}
