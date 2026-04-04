/**
 * Byte Utilities
 * 
 * Helper functions for byte/hex conversions
 */

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
