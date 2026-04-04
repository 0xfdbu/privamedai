/**
 * Serialization Utilities
 */

import { persistentHash, CompactTypeVector, CompactTypeBytes, StateValue, bigIntToValue } from '@midnight-ntwrk/compact-runtime';

/**
 * Serialize credential data into Bytes<32> format
 */
export function serializeCredentialData(credentialData: Record<string, any>): {
  rawBytes: Uint8Array;
  hash: Uint8Array;
} {
  // Sort keys for deterministic serialization
  const sortedData = Object.keys(credentialData).sort().reduce((acc, key) => {
    acc[key] = credentialData[key];
    return acc;
  }, {} as Record<string, any>);
  
  // Convert to JSON string
  const jsonStr = JSON.stringify(sortedData);
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(jsonStr);
  
  // Pad to 32 bytes (the credentialData field in the circuit is Bytes<32>)
  const rawBytes = new Uint8Array(32);
  rawBytes.set(dataBytes.slice(0, 32));
  
  // Compute the hash: persistentHash<Vector<1, Bytes<32>>>([rawBytes])
  const bytes32Type = new CompactTypeBytes(32);
  const vectorType = new CompactTypeVector(1, bytes32Type);
  const hash = persistentHash(vectorType, [rawBytes]);
  
  return { rawBytes, hash };
}

/**
 * Convert hex string to Uint8Array (32 bytes)
 */
export function hexToBytes32(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32 && i < cleanHex.length / 2; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Strip trailing zeros from a Uint8Array
 */
export function trimTrailingZeros(bytes: Uint8Array): Uint8Array {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) {
    end--;
  }
  return bytes.slice(0, end);
}

/**
 * Create a StateValue for a Credential struct
 */
export function createCredentialValue(
  issuer: Uint8Array,
  claimHash: Uint8Array,
  expiry: bigint,
  status: number
): StateValue {
  const issuerValue = trimTrailingZeros(issuer);
  const claimHashValue = trimTrailingZeros(claimHash);
  
  const value = [
    issuerValue,
    claimHashValue,
    ...bigIntToValue(expiry),
    ...bigIntToValue(BigInt(status))
  ];
  
  const alignment = [
    { tag: 'atom', value: { tag: 'bytes', length: 32 } },
    { tag: 'atom', value: { tag: 'bytes', length: 32 } },
    { tag: 'atom', value: { tag: 'field' } },
    { tag: 'atom', value: { tag: 'bytes', length: 1 } }
  ];
  
  return StateValue.newCell({ value, alignment } as any);
}

/**
 * Create a StateValue for an Issuer struct
 */
export function createIssuerValue(
  publicKey: Uint8Array,
  status: number,
  nameHash: Uint8Array,
  credentialCount: bigint
): StateValue {
  const pubkeyValue = trimTrailingZeros(publicKey);
  const nameHashValue = trimTrailingZeros(nameHash);
  
  const value = [
    pubkeyValue,
    ...bigIntToValue(BigInt(status)),
    nameHashValue,
    ...bigIntToValue(credentialCount)
  ];
  
  const alignment = [
    { tag: 'atom', value: { tag: 'bytes', length: 32 } },
    { tag: 'atom', value: { tag: 'bytes', length: 1 } },
    { tag: 'atom', value: { tag: 'bytes', length: 32 } },
    { tag: 'atom', value: { tag: 'field' } }
  ];
  
  return StateValue.newCell({ value, alignment } as any);
}
