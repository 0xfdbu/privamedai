import { contracts, type PrivaMedAIPrivateState } from '@midnight-ntwrk/contract';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import type { DeployedContract, FoundContract } from '@midnight-ntwrk/midnight-js-contracts';

// Get the dynamic contract module
const getContractModule = () => {
  const contractNames = Object.keys(contracts);
  if (contractNames.length === 0) {
    throw new Error('No contract found in contracts object');
  }
  return contracts[contractNames[0]];
};

const contractModule = getContractModule();

export type { PrivaMedAIPrivateState };

export const PrivaMedAIPrivateStateId = 'privamedaiPrivateState';

export type PrivaMedAIProviders = MidnightProviders<any, typeof PrivaMedAIPrivateStateId, PrivaMedAIPrivateState>;

export type PrivaMedAIContract = typeof contractModule.Contract;

export type DeployedPrivaMedAIContract = DeployedContract<PrivaMedAIContract> | FoundContract<PrivaMedAIContract>;
