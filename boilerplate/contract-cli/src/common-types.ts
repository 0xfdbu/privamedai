import { contracts, type PrivaCredPrivateState } from '@midnight-ntwrk/contract';
import type { ImpureCircuitId, MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
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

export type { PrivaCredPrivateState };
export type PrivaCredCircuits = ImpureCircuitId<typeof contractModule.Contract>;

export const PrivaCredPrivateStateId = 'privacredPrivateState';

export type PrivaCredProviders = MidnightProviders<PrivaCredCircuits, typeof PrivaCredPrivateStateId, PrivaCredPrivateState>;

export type PrivaCredContract = typeof contractModule.Contract;

export type DeployedPrivaCredContract = DeployedContract<PrivaCredContract> | FoundContract<PrivaCredContract>;
