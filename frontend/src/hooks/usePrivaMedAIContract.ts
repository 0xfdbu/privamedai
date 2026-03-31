import { useState, useEffect, useCallback, useRef } from 'react';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { findDeployedContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { UnshieldedWallet, createKeystore, InMemoryTransactionHistoryStorage, PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';
import { createHash } from 'crypto';

// Contract configuration for preprod
const CONFIG = {
  indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
};

// Deployment info - PrivaMedAI contract
const DEPLOYMENT = {
  contractAddress: '9a965779dcd16a1f1d295dc890125cc11b93a2d037a0b298a66e4b8e1f3bf187',
  network: 'preprod',
};

setNetworkId('preprod');

export type ContractState = 'initializing' | 'syncing' | 'ready' | 'error';

export interface Credential {
  commitment: string;
  issuer: string;
  claimHash: string;
  expiry: number;
  status: 'VALID' | 'REVOKED';
}

// Helper to compute derived admin key from zswap secret key
function computeDerivedAdminKey(zswapKey: Uint8Array): string {
  const prefix = new Uint8Array(32);
  const prefixStr = new TextEncoder().encode('privamed:pk:');
  prefix.set(prefixStr.slice(0, 32));
  const combined = new Uint8Array(64);
  combined.set(prefix);
  combined.set(zswapKey, 32);
  return createHash('sha256').update(Buffer.from(combined)).digest('hex');
}

export function usePrivaMedAIContract(seed: string) {
  const [state, setState] = useState<ContractState>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [adminKey, setAdminKey] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const walletCtxRef = useRef<any>(null);
  const compiledContractRef = useRef<any>(null);
  const providersRef = useRef<any>(null);

  // Initialize wallet and connect to contract
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setState('initializing');

        // Load contract module
        const PrivaMedAIModule = await import('../../../contract/src/managed/PrivaMedAI/contract/index.js');
        
        // Create compiled contract
        const compiledContract = CompiledContract.make('privamedai', PrivaMedAIModule.Contract).pipe(
          CompiledContract.withWitnesses({
            local_secret_key: () => new Uint8Array(32),
            get_credential_data: () => new Uint8Array(32),
            get_bundled_credential_data: () => new Uint8Array(32),
          }),
          CompiledContract.withCompiledFileAssets('/contract/src/managed/PrivaMedAI'),
        );
        compiledContractRef.current = compiledContract;

        // Setup wallet
        const keys = deriveKeys(seed);
        const networkId = getNetworkId();
        const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
        const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
        const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);
        
        const derivedAdminKey = computeDerivedAdminKey(keys[Roles.Zswap]);

        const walletConfig = {
          networkId,
          indexerClientConnection: { indexerHttpUrl: CONFIG.indexer, indexerWsUrl: CONFIG.indexerWS },
          provingServerUrl: new URL(CONFIG.proofServer),
          relayURL: new URL(CONFIG.node.replace(/^http/, 'ws')),
        };

        const wallet = await WalletFacade.init({
          configuration: walletConfig,
          shielded: (config: any) => ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys),
          unshielded: (config: any) => UnshieldedWallet({
            ...config,
            txHistoryStorage: new InMemoryTransactionHistoryStorage(),
          }).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
          dust: (config: any) => DustWallet({
            ...config,
            costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
          }).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
        });

        await wallet.start(shieldedSecretKeys, dustSecretKey);

        if (cancelled) return;

        setState('syncing');

        // Wait for sync
        await Rx.firstValueFrom(wallet.state().pipe(
          Rx.filter((s: any) => s.isSynced),
        ));

        if (cancelled) return;

        const address = unshieldedKeystore.getBech32Address();
        setWalletAddress(typeof address === 'string' ? address : address.asString());
        setAdminKey(derivedAdminKey);

        walletCtxRef.current = { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore, keys };

        // Create providers
        const providers = await createProviders(walletCtxRef.current);
        providersRef.current = providers;

        // Connect to deployed contract
        await findDeployedContract(providers as any, {
          contractAddress: DEPLOYMENT.contractAddress,
          compiledContract,
          privateStateId: 'privaMedAIFrontendState',
          initialPrivateState: {},
        });

        // Check if user is admin - derived key should match if this wallet initialized the contract
        setIsAdmin(true); // Will be enforced by circuit assertions if not actually admin
        
        setState('ready');
      } catch (err: any) {
        console.error('Contract initialization error:', err);
        setError(err.message || 'Failed to initialize contract');
        setState('error');
      }
    }

    init();

    return () => {
      cancelled = true;
      if (walletCtxRef.current?.wallet) {
        walletCtxRef.current.wallet.stop();
      }
    };
  }, [seed]);

  // Helper to create call options
  const createCallOptions = useCallback((circuitId: string, args: unknown[]) => ({
    contractAddress: DEPLOYMENT.contractAddress,
    compiledContract: compiledContractRef.current,
    circuitId,
    args,
  }), []);

  // Initialize contract (set admin)
  const initialize = useCallback(async () => {
    if (!providersRef.current) {
      throw new Error('Contract not ready');
    }

    const txData = await submitCallTx(providersRef.current, createCallOptions('initialize', [
      Buffer.from(adminKey, 'hex'),
    ]));

    return txData?.public?.txId || 'unknown';
  }, [adminKey, createCallOptions]);

  // Register issuer (admin only)
  const registerIssuer = useCallback(async (issuerPubKey: string, nameHash: string) => {
    if (!providersRef.current) {
      throw new Error('Contract not ready');
    }

    const txData = await submitCallTx(providersRef.current, createCallOptions('registerIssuer', [
      Buffer.from(adminKey, 'hex'),
      Buffer.from(issuerPubKey.replace('0x', ''), 'hex'),
      Buffer.from(nameHash.replace('0x', ''), 'hex'),
    ]));

    return txData?.public?.txId || 'unknown';
  }, [adminKey, createCallOptions]);

  // Issue credential (issuer only)
  const issueCredential = useCallback(async (
    commitment: string,
    claimHash: string,
    expiryDays: number
  ) => {
    if (!providersRef.current) {
      throw new Error('Contract not ready');
    }

    const expiry = BigInt(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    
    const txData = await submitCallTx(providersRef.current, createCallOptions('issueCredential', [
      Buffer.from(adminKey, 'hex'),
      Buffer.from(commitment.replace('0x', ''), 'hex'),
      Buffer.from(claimHash.replace('0x', ''), 'hex'),
      expiry,
    ]));

    return txData?.public?.txId || 'unknown';
  }, [adminKey, createCallOptions]);

  // Batch issue 3 credentials (issuer only)
  const batchIssueCredentials = useCallback(async (
    commitments: string[],
    claimHashes: string[],
    expiryDays: number
  ) => {
    if (!providersRef.current) {
      throw new Error('Contract not ready');
    }

    if (commitments.length !== 3 || claimHashes.length !== 3) {
      throw new Error('Batch issue requires exactly 3 credentials');
    }

    const expiry = BigInt(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    
    const txData = await submitCallTx(providersRef.current, createCallOptions('batchIssue3Credentials', [
      Buffer.from(adminKey, 'hex'),
      Buffer.from(commitments[0].replace('0x', ''), 'hex'),
      Buffer.from(claimHashes[0].replace('0x', ''), 'hex'),
      Buffer.from(commitments[1].replace('0x', ''), 'hex'),
      Buffer.from(claimHashes[1].replace('0x', ''), 'hex'),
      Buffer.from(commitments[2].replace('0x', ''), 'hex'),
      Buffer.from(claimHashes[2].replace('0x', ''), 'hex'),
      expiry,
    ]));

    return txData?.public?.txId || 'unknown';
  }, [adminKey, createCallOptions]);

  // Verify credential (now requires credentialData as parameter)
  const verifyCredential = useCallback(async (
    commitment: string,
    credentialData: string
  ) => {
    if (!providersRef.current) {
      throw new Error('Contract not ready');
    }

    const txData = await submitCallTx(providersRef.current, createCallOptions('verifyCredential', [
      Buffer.from(commitment.replace('0x', ''), 'hex'),
      Buffer.from(credentialData.replace('0x', ''), 'hex'),
    ]));

    return txData?.public?.txId || 'unknown';
  }, [createCallOptions]);

  // Bundled verify 2 credentials
  const bundledVerify2 = useCallback(async (
    commitment1: string,
    credentialData1: string,
    commitment2: string,
    credentialData2: string
  ) => {
    if (!providersRef.current) {
      throw new Error('Contract not ready');
    }

    const txData = await submitCallTx(providersRef.current, createCallOptions('bundledVerify2Credentials', [
      Buffer.from(commitment1.replace('0x', ''), 'hex'),
      Buffer.from(credentialData1.replace('0x', ''), 'hex'),
      Buffer.from(commitment2.replace('0x', ''), 'hex'),
      Buffer.from(credentialData2.replace('0x', ''), 'hex'),
    ]));

    return txData?.public?.txId || 'unknown';
  }, [createCallOptions]);

  // Revoke credential (issuer only)
  const revokeCredential = useCallback(async (commitment: string) => {
    if (!providersRef.current) {
      throw new Error('Contract not ready');
    }

    const txData = await submitCallTx(providersRef.current, createCallOptions('revokeCredential', [
      Buffer.from(adminKey, 'hex'),
      Buffer.from(commitment.replace('0x', ''), 'hex'),
    ]));

    return txData?.public?.txId || 'unknown';
  }, [adminKey, createCallOptions]);

  // Update issuer status (admin only)
  const updateIssuerStatus = useCallback(async (issuerPubKey: string, status: number) => {
    if (!providersRef.current) {
      throw new Error('Contract not ready');
    }

    const txData = await submitCallTx(providersRef.current, createCallOptions('updateIssuerStatus', [
      Buffer.from(adminKey, 'hex'),
      Buffer.from(issuerPubKey.replace('0x', ''), 'hex'),
      status,
    ]));

    return txData?.public?.txId || 'unknown';
  }, [adminKey, createCallOptions]);

  // Check credential status
  const checkCredentialStatus = useCallback(async (commitment: string): Promise<number> => {
    // Note: This would need to be implemented via a query circuit or off-chain indexer
    // For now, we return a mock status
    console.log('Checking status for:', commitment);
    return 0; // 0 = VALID, 1 = REVOKED, 2 = NOT_FOUND
  }, []);

  return {
    state,
    error,
    walletAddress,
    adminKey,
    isAdmin,
    initialize,
    registerIssuer,
    issueCredential,
    batchIssueCredentials,
    verifyCredential,
    bundledVerify2,
    revokeCredential,
    updateIssuerStatus,
    checkCredentialStatus,
    contractAddress: DEPLOYMENT.contractAddress,
  };
}

// Helper functions
function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
  const result = hdWallet.hdWallet.selectAccount(0).selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  hdWallet.hdWallet.clear();
  return result.keys;
}

function signTransactionIntents(tx: { intents?: Map<number, any> }, signFn: (payload: Uint8Array) => ledger.Signature, proofMarker: 'proof' | 'pre-proof'): void {
  if (!tx.intents || tx.intents.size === 0) return;
  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;
    const cloned = ledger.Intent.deserialize<ledger.SignatureEnabled, any, ledger.PreBinding>('signature', proofMarker, 'pre-binding', intent.serialize());
    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);
    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map((_: any, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature);
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }
    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map((_: any, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature);
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }
    tx.intents.set(segment, cloned);
  }
}

async function createProviders(walletCtx: any) {
  const state: any = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));

  const walletProvider = {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signFn = (payload: Uint8Array) => walletCtx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigPath = '/contract/src/managed/PrivaMedAI';
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'privamedai-frontend-private-state',
      privateStoragePasswordProvider: async () => 'PrivaMedAI-Secure-Store-2025!',
      accountId: walletProvider.getCoinPublicKey(),
    }),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(CONFIG.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  } as any;
}
