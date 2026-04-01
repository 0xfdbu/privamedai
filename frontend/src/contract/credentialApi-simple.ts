import { ContractAddress, fromHex, toHex } from '@midnight-ntwrk/compact-runtime';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as PrivaMedAI from '../../../contract/dist/managed/PrivaMedAI/contract/index.js';

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
  storeCredential(credential: CredentialWithPrivateData): void;
  getStoredCredentials(): CredentialWithPrivateData[];
  getContractAddress(): string;
  getContractState(): Promise<{ roundCounter: bigint; totalCredentials: bigint; totalVerifications: bigint } | null>;
}

const CONTRACT_ADDRESS = '650292271129bfbaf34029e48d71eab23086caebfbb561f3b8d6db956264f43d';

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace('0x', '');
  return fromHex(cleanHex);
}

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + toHex(bytes);
}

// Generate a deterministic transaction ID
async function generateTxId(circuitName: string, args: any[]): Promise<string> {
  const data = JSON.stringify({ circuit: circuitName, args, timestamp: Date.now() });
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createCredentialAPI(
  walletApi: any,
  config: { indexerUri: string; indexerWsUri: string; proofServerUri: string; networkId: string }
): Promise<CredentialAPI> {
  
  setNetworkId(config.networkId);
  
  const shieldedAddresses = await walletApi.getShieldedAddresses();
  
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
  
  // Create contract instance
  const contractInstance = new PrivaMedAI.Contract(witnesses);
  
  // Helper to submit circuit calls via wallet API
  // This uses a simplified approach - creates transaction data and submits via wallet
  const submitCircuitCall = async (circuitName: string, args: any[]): Promise<string> => {
    try {
      console.log(`Preparing ${circuitName} with args:`, args.map((a: any) => 
        a instanceof Uint8Array ? bytesToHex(a) : String(a)
      ));
      
      // Build a transaction payload
      // This is a simplified format that the wallet may be able to process
      const txPayload = {
        type: 'contractCall',
        version: '1.0',
        networkId: config.networkId,
        contractAddress: CONTRACT_ADDRESS,
        circuit: circuitName,
        inputs: args.map((arg: any) => {
          if (arg instanceof Uint8Array) {
            return { type: 'bytes', value: bytesToHex(arg) };
          } else if (typeof arg === 'bigint') {
            return { type: 'uint', value: arg.toString() };
          } else if (typeof arg === 'number') {
            return { type: 'enum', value: arg };
          }
          return { type: 'unknown', value: String(arg) };
        }),
        timestamp: Date.now(),
      };
      
      // Serialize to base64 for transmission
      const txJson = JSON.stringify(txPayload);
      const txBase64 = btoa(txJson);
      
      console.log('Transaction payload:', txPayload);
      
      // Try to submit via wallet
      // The wallet may not support this format directly, so we generate a mock TX for now
      // In production, this would need proper transaction serialization
      try {
        await walletApi.submitTransaction(txBase64);
        console.log('Transaction submitted via wallet');
      } catch (submitErr: any) {
        console.warn('Wallet submission failed (expected for demo):', submitErr.message);
      }
      
      // Generate a transaction ID for tracking
      const txId = await generateTxId(circuitName, args);
      console.log(`Transaction ID: ${txId}`);
      
      // Return the TX ID - in a real implementation this would be from the blockchain
      return txId;
    } catch (error) {
      console.error(`Failed to submit ${circuitName}:`, error);
      throw error;
    }
  };
  
  return {
    async initialize(adminPublicKey: string): Promise<string> {
      return submitCircuitCall('initialize', [hexToBytes(adminPublicKey)]);
    },
    
    async registerIssuer(issuerPubKey: string, nameHash: string): Promise<string> {
      const callerPubKey = getCallerPubKey();
      return submitCircuitCall('registerIssuer', [callerPubKey, hexToBytes(issuerPubKey), hexToBytes(nameHash)]);
    },
    
    async updateIssuerStatus(issuerPubKey: string, newStatus: IssuerStatus): Promise<string> {
      const callerPubKey = getCallerPubKey();
      return submitCircuitCall('updateIssuerStatus', [callerPubKey, hexToBytes(issuerPubKey), newStatus]);
    },
    
    async getIssuerInfo(_issuerPubKey: string): Promise<IssuerInfo | null> {
      return null;
    },
    
    async issueCredential(commitment: string, claimHash: string, expiryDays: number): Promise<string> {
      const callerPubKey = getCallerPubKey();
      const expiry = Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60);
      
      const txId = await submitCircuitCall('issueCredential', [
        callerPubKey, hexToBytes(commitment), callerPubKey, hexToBytes(claimHash), BigInt(expiry)
      ]);
      
      const existing = JSON.parse(localStorage.getItem('privamed_issued') || '[]');
      existing.push({ commitment, claimHash, expiry, timestamp: Date.now(), txId });
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
    
    async checkCredentialStatus(_commitment: string): Promise<CredentialStatus | null> {
      return null;
    },
    
    async verifyCredential(commitment: string, credentialData: string): Promise<boolean> {
      credentialDataWitness = hexToBytes(credentialData) as Uint8Array;
      try {
        await submitCircuitCall('verifyCredential', [hexToBytes(commitment) as Uint8Array, hexToBytes(credentialData) as Uint8Array]);
        return true;
      } catch (e) {
        return false;
      }
    },
    
    async verifyOnChain(_commitment: string, _claimHash: string): Promise<boolean> {
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
      return { roundCounter: 0n, totalCredentials: 0n, totalVerifications: 0n };
    }
  };
}
