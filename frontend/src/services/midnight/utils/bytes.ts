/**
 * Byte Utilities
 * 
 * Helper functions for byte/hex conversions
 */

import { bech32m } from '@scure/base';

/**
 * Hash a string to bytes32
 */
export function hashString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = new Uint8Array(32);
  for (let i = 0; i < data.length; i++) {
    hash[i % 32] = (hash[i % 32] + data[i]) % 256;
  }
  return hash;
}

/**
 * Convert hex string to bytes32
 */
export function hexToBytes32(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 64 && i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert hex string to bytes32 (alias for hexToBytes32)
 */
export function hexStringToBytes32(hex: string): Uint8Array {
  return hexToBytes32(hex);
}

/**
 * Convert bech32m address to bytes32
 */
export function bech32mToBytes32(address: string): Uint8Array {
  try {
    // Decode bech32m address
    const decoded = bech32m.decode(address as `${string}1${string}`);
    const data = bech32m.fromWords(decoded.words);
    // Take first 32 bytes or pad
    const result = new Uint8Array(32);
    for (let i = 0; i < Math.min(data.length, 32); i++) {
      result[i] = data[i];
    }
    return result;
  } catch (e) {
    // If decoding fails, treat as hex
    return hexToBytes32(address);
  }
}
