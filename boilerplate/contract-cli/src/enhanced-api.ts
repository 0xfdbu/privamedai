// Enhanced API wrapper for PrivaMedAI Contract
// Generated on: 2026-04-07T22:58:11.286Z
// Auto-generated from PrivaMedAI.compact

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
   * Execute initialize function
   */
  async initialize(...args: any[]): Promise<any> {
    return await (originalApi as any).initialize(...args);
  }
  /**
   * Execute getAdmin function
   */
  async getAdmin(...args: any[]): Promise<any> {
    return await (originalApi as any).getAdmin(...args);
  }
  /**
   * Execute registerIssuer function
   */
  async registerIssuer(...args: any[]): Promise<any> {
    return await (originalApi as any).registerIssuer(...args);
  }
  /**
   * Execute updateIssuerStatus function
   */
  async updateIssuerStatus(...args: any[]): Promise<any> {
    return await (originalApi as any).updateIssuerStatus(...args);
  }
  /**
   * Execute getIssuerInfo function
   */
  async getIssuerInfo(...args: any[]): Promise<any> {
    return await (originalApi as any).getIssuerInfo(...args);
  }
  /**
   * Execute issueCredential function
   */
  async issueCredential(...args: any[]): Promise<any> {
    return await (originalApi as any).issueCredential(...args);
  }
  /**
   * Execute verifyForFreeHealthClinic function
   */
  async verifyForFreeHealthClinic(...args: any[]): Promise<any> {
    return await (originalApi as any).verifyForFreeHealthClinic(...args);
  }
  /**
   * Execute verifyForPharmacy function
   */
  async verifyForPharmacy(...args: any[]): Promise<any> {
    return await (originalApi as any).verifyForPharmacy(...args);
  }
  /**
   * Execute verifyForHospital function
   */
  async verifyForHospital(...args: any[]): Promise<any> {
    return await (originalApi as any).verifyForHospital(...args);
  }
  /**
   * Execute revokeCredential function
   */
  async revokeCredential(...args: any[]): Promise<any> {
    return await (originalApi as any).revokeCredential(...args);
  }
  /**
   * Execute adminRevokeCredential function
   */
  async adminRevokeCredential(...args: any[]): Promise<any> {
    return await (originalApi as any).adminRevokeCredential(...args);
  }
  /**
   * Execute checkCredentialStatus function
   */
  async checkCredentialStatus(...args: any[]): Promise<any> {
    return await (originalApi as any).checkCredentialStatus(...args);
  }
}

// Export contract metadata for reference
export const CONTRACT_METADATA = {
  name: 'PrivaMedAI Contract',
  fileName: 'PrivaMedAI.compact',
  generatedAt: '2026-04-07T22:58:11.286Z',
  functions: [
  {
    "name": "initialize",
    "parameters": [
      {
        "name": "initialAdmin",
        "type": "Bytes<32>"
      }
    ],
    "returnType": "[]",
    "readOnly": false
  },
  {
    "name": "getAdmin",
    "parameters": [],
    "returnType": "Bytes<32>",
    "readOnly": true
  },
  {
    "name": "registerIssuer",
    "parameters": [
      {
        "name": "callerPubKey",
        "type": "Bytes<32>"
      },
      {
        "name": "issuerPubKey",
        "type": "Bytes<32>"
      },
      {
        "name": "nameHash",
        "type": "Bytes<32>"
      }
    ],
    "returnType": "[]",
    "readOnly": false
  },
  {
    "name": "updateIssuerStatus",
    "parameters": [
      {
        "name": "callerPubKey",
        "type": "Bytes<32>"
      },
      {
        "name": "issuerPubKey",
        "type": "Bytes<32>"
      },
      {
        "name": "newStatus",
        "type": "IssuerStatus"
      }
    ],
    "returnType": "[]",
    "readOnly": false
  },
  {
    "name": "getIssuerInfo",
    "parameters": [
      {
        "name": "issuerPubKey",
        "type": "Bytes<32>"
      }
    ],
    "returnType": "Issuer",
    "readOnly": true
  },
  {
    "name": "issueCredential",
    "parameters": [
      {
        "name": "callerPubKey",
        "type": "Bytes<32>"
      },
      {
        "name": "commitment",
        "type": "Bytes<32>"
      },
      {
        "name": "issuerPubKey",
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
    "name": "verifyForFreeHealthClinic",
    "parameters": [
      {
        "name": "commitment",
        "type": "Bytes<32>"
      },
      {
        "name": "minAge",
        "type": "Uint<8>"
      }
    ],
    "returnType": "Boolean",
    "readOnly": true
  },
  {
    "name": "verifyForPharmacy",
    "parameters": [
      {
        "name": "commitment",
        "type": "Bytes<32>"
      },
      {
        "name": "requiredPrescription",
        "type": "Uint<16>"
      }
    ],
    "returnType": "Boolean",
    "readOnly": true
  },
  {
    "name": "verifyForHospital",
    "parameters": [
      {
        "name": "commitment",
        "type": "Bytes<32>"
      },
      {
        "name": "minAge",
        "type": "Uint<8>"
      },
      {
        "name": "requiredCondition",
        "type": "Uint<16>"
      }
    ],
    "returnType": "Boolean",
    "readOnly": true
  },
  {
    "name": "revokeCredential",
    "parameters": [
      {
        "name": "callerPubKey",
        "type": "Bytes<32>"
      },
      {
        "name": "commitment",
        "type": "Bytes<32>"
      }
    ],
    "returnType": "[]",
    "readOnly": false
  },
  {
    "name": "adminRevokeCredential",
    "parameters": [
      {
        "name": "callerPubKey",
        "type": "Bytes<32>"
      },
      {
        "name": "commitment",
        "type": "Bytes<32>"
      },
      {
        "name": "reasonHash",
        "type": "Bytes<32>"
      }
    ],
    "returnType": "[]",
    "readOnly": false
  },
  {
    "name": "checkCredentialStatus",
    "parameters": [
      {
        "name": "commitment",
        "type": "Bytes<32>"
      }
    ],
    "returnType": "CredentialStatus",
    "readOnly": true
  }
],
  ledgerState: [
  {
    "name": "credentials",
    "type": "Map<Bytes<32>, Credential>"
  },
  {
    "name": "issuerRegistry",
    "type": "Map<Bytes<32>, Issuer>"
  },
  {
    "name": "admin",
    "type": "Map<Bytes<1>, Bytes<32>>"
  },
  {
    "name": "roundCounter",
    "type": "Counter"
  },
  {
    "name": "totalCredentialsIssued",
    "type": "Counter"
  },
  {
    "name": "totalVerificationsPerformed",
    "type": "Counter"
  }
],
  witnesses: []
} as const;
