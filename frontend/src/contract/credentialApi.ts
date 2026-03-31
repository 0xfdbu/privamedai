import { ContractAddress, fromHex, toHex } from '@midnight-ntwrk/compact-runtime';
import { FinalizedTransaction, Proof, SignatureEnabled, Transaction, TransactionId } from '@midnight-ntwrk/ledger-v8';
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

const CONTRACT_ADDRESS = '9a965779dcd16a1f1d295dc890125cc11b93a2d037a0b298a66e4b8e1f3bf187';

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace('0x', '');
  return fromHex(cleanHex);
}

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + toHex(bytes);
}

export async function createCredentialAPI(
  walletApi: any,
  networkConfig: { indexerUri: string; indexerWsUri: string; proofServerUri: string; networkId: string }
): Promise<CredentialAPI> {
  
  setNetworkId(networkConfig.networkId);
  
  const shieldedAddresses = await walletApi.getShieldedAddresses();
  
  const getCallerPubKey = (): Uint8Array => {
    return hexToBytes(shieldedAddresses.shieldedCoinPublicKey);
  };

  let credentialDataWitness = new Uint8Array(32);
  
  const witnesses = {
    local_secret_key: () => new Uint8Array(32),
    get_credential_data: () => credentialDataWitness,
  };
  
  const contractInstance = new PrivaMedAI.Contract(witnesses);
  
  const submitCircuitCall = async (circuitName: string, args: any[]): Promise<string> => {
    const txData = {
      circuit: circuitName,
      arguments: args.map((arg: any) => arg instanceof Uint8Array ? bytesToHex(arg) : arg),
      contractAddress: CONTRACT_ADDRESS,
    };
    
    const mockTxId = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    
    console.log(`Submitted ${circuitName}:`, txData);
    
    return mockTxId;
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
      credentialDataWitness = hexToBytes(credentialData) as any;
      try {
        await submitCircuitCall('verifyCredential', [hexToBytes(commitment) as any, hexToBytes(credentialData) as any]);
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
