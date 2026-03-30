// Enhanced API wrapper for PrivaCred Contract
// Generated on: 2026-03-30T20:14:42.032Z
// Auto-generated from PrivaCred.compact

import { type Logger } from 'pino';
import { ContractAnalyzer } from './contract-analyzer.js';
import { DynamicCLIGenerator } from './dynamic-cli-generator.js';
import * as originalApi from './api.js';

// Re-export all original API functions
export * from './api.js';

/**
 * Contract information interface
 */
export interface ContractInfo {
  contractName: string;
  functions: Array<{
    name: string;
    parameters: Array<{ name: string; type: string }>;
    returnType: string;
    readOnly: boolean;
    description: string;
  }>;
  ledgerState: Array<{ name: string; type: string }>;
  witnesses: Array<{
    name: string;
    ledgerType: string;
    privateType: string;
    returns: string[];
  }>;
}

/**
 * Enhanced API with dynamic contract analysis
 */
export class EnhancedContractAPI {
  private analyzer: ContractAnalyzer;
  private cliGenerator: DynamicCLIGenerator;
  private contractInfo: ContractInfo | null;

  constructor(logger: Logger) {
    this.analyzer = new ContractAnalyzer();
    this.cliGenerator = new DynamicCLIGenerator(logger);
    this.contractInfo = null;
  }

  async initialize(): Promise<ContractInfo> {
    try {
      const analysis = await this.analyzer.analyzeContract();
      await this.cliGenerator.initialize();
      
      // Convert ContractAnalysis to ContractInfo format
      this.contractInfo = {
        contractName: analysis.contractName,
        functions: analysis.functions.map(func => ({
          ...func,
          readOnly: this.analyzer.isReadOnlyFunction(func.name),
          description: func.description || `Execute ${func.name} function`
        })),
        ledgerState: Object.entries(analysis.ledgerState).map(([name, type]) => ({ name, type })),
        witnesses: analysis.witnesses.map(witness => ({
          name: witness.name,
          ledgerType: witness.ledgerType,
          privateType: witness.privateType,
          returns: witness.returns
        }))
      };
      
      return this.contractInfo;
    } catch (error) {
      throw new Error(`Failed to initialize enhanced API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getContractInfo(): ContractInfo | null {
    return this.contractInfo;
  }

  generateMenuItems(): any[] {
    return this.cliGenerator.generateMenuItems();
  }

  generateMenuQuestion(menuItems: any[]): string {
    return this.cliGenerator.generateMenuQuestion(menuItems);
  }

  // Dynamic function mapping based on contract analysis
  /**
   * Execute issueCredential function
   */
  async issueCredential(...args: any[]): Promise<any> {
    return await (originalApi as any).issueCredential(...args);
  }
  /**
   * Execute verifyCredential function
   */
  async verifyCredential(...args: any[]): Promise<any> {
    return await (originalApi as any).verifyCredential(...args);
  }
  /**
   * Execute revokeCredential function
   */
  async revokeCredential(...args: any[]): Promise<any> {
    return await (originalApi as any).revokeCredential(...args);
  }
}

// Export contract metadata for reference
export const CONTRACT_METADATA = {
  name: 'PrivaCred Contract',
  fileName: 'PrivaCred.compact',
  generatedAt: '2026-03-30T20:14:42.032Z',
  functions: [
  {
    "name": "issueCredential",
    "parameters": [
      {
        "name": "commitment",
        "type": "Bytes<32>"
      },
      {
        "name": "issuer",
        "type": "Bytes<32>"
      },
      {
        "name": "claimHash",
        "type": "Bytes<32>"
      },
      {
        "name": "expiry",
        "type": "Uint<64>"
      }
    ],
    "returnType": "[]",
    "readOnly": false
  },
  {
    "name": "verifyCredential",
    "parameters": [
      {
        "name": "commitment",
        "type": "Bytes<32>"
      }
    ],
    "returnType": "Boolean",
    "readOnly": true
  },
  {
    "name": "revokeCredential",
    "parameters": [
      {
        "name": "commitment",
        "type": "Bytes<32>"
      }
    ],
    "returnType": "[]",
    "readOnly": false
  }
],
  ledgerState: [
  {
    "name": "credentials",
    "type": "Map<Bytes<32>, Credential>"
  },
  {
    "name": "roundCounter",
    "type": "Counter"
  }
],
  witnesses: []
} as const;
