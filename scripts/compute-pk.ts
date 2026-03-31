// Try to call the contract's get_public_key pure function
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { CompiledContract } from '@midnight-ntwrk/compact-js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const zkConfigPath = path.resolve(repoRoot, 'contract', 'dist', 'managed', 'PrivaMedAI');

async function main() {
  console.log('Loading contract...');
  const PrivaMedAIModule = await import(pathToFileURL(path.join(zkConfigPath, 'contract', 'index.js')).href);
  
  console.log('Contract exported functions:', Object.keys(PrivaMedAIModule));
  
  // Check if we can access pure circuits directly
  const contract = PrivaMedAIModule.Contract;
  console.log('Contract pureCircuits:', Object.keys(contract.pureCircuits || {}));
  console.log('Contract provableCircuits:', Object.keys(contract.provableCircuits || {}));
}

main().catch(console.error);
