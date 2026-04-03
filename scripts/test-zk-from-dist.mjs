import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This is the exact same calculation as in the deployed code
const currentDir = __dirname;
const zkConfigPath = path.resolve(currentDir, '..', '..', '..', 'contract', 'src', 'managed', 'PrivaMedAI');

console.log('Current directory:', currentDir);
console.log('ZK Config path:', zkConfigPath);

const provider = new NodeZkConfigProvider(zkConfigPath);

// Test the exact same circuit ID the SDK uses
const circuitId = 'PrivaMedAI#initialize';
console.log('Testing circuit ID:', circuitId);

try {
  const vk = await provider.getVerifierKey(circuitId);
  console.log('✅ SUCCESS! Verifier key size:', vk.length, 'bytes');
} catch (e) {
  console.error('❌ FAILED:', e.message);
  console.error('Stack:', e.stack);
}
