/**
 * Proof Service (Legacy Export)
 * 
 * This file is kept for backwards compatibility.
 * All functionality has been moved to the modular structure in ./proofs/
 * 
 * New code should import directly from ./proofs/
 */

// Re-export everything from the modular proofs service
export * from './proofs';

// Main export for backwards compatibility
export { generateProductionZKProof as default, generateProductionZKProof } from './proofs/proofGenerator';
