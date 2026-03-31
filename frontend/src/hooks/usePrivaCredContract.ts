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

// Contract configuration for preprod
const CONFIG = {
  indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
};

// Deployment info - this would normally be fetched from a config file
const DEPLOYMENT = {
  contractAddress: '56c506bed6acff24377f26d2c46eb60dd31f9c4039449e47bd61e0555f6a9404',
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

export function usePrivaCredContract(seed: string) {
  const [state, setState] = useState<ContractState>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const walletCtxRef = useRef<any>(null);
  const contractRef = useRef<any>(null);
  const providersRef = useRef<any>(null);

  // Initialize wallet and connect to contract
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setState('initializing');

        // Load contract module
        const PrivaCredModule = await import('../../../contract/src/managed/PrivaCred/contract/index.js');
        
        // Create compiled contract
        const compiledContract = CompiledContract.make('priva-cred', PrivaCredModule.Contract).pipe(
          CompiledContract.withWitnesses({
            local_secret_key: () => new Uint8Array(32),
            get_credential_data: () => new TextEncoder().encode(JSON.stringify({ age: 21 })),
          }),
          CompiledContract.withCompiledFileAssets('/contract/src/managed/PrivaCred'),
        );

        // Setup wallet
        const keys = deriveKeys(seed);
        const networkId = getNetworkId();
        const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
        const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
        const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);

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

        walletCtxRef.current = { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };

        // Create providers
        const providers = await createProviders(walletCtxRef.current);
        providersRef.current = providers;

        // Connect to deployed contract
        const contract = await findDeployedContract(providers, {
          contractAddress: DEPLOYMENT.contractAddress,
          compiledContract,
          privateStateId: 'privaCredFrontendState',
          initialPrivateState: {},
        });

        contractRef.current = contract;
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

  // Issue credential
  const issueCredential = useCallback(async (
    commitment: string,
    issuer: string,
    claimHash: string,
    expiryDays: number
  ) => {
    if (!providersRef.current || !contractRef.current) {
      throw new Error('Contract not ready');
    }

    const expiry = BigInt(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    
    const tx = await submitCallTx(providersRef.current, contractRef.current, 'issueCredential', {
      commitment: Buffer.from(commitment.replace('0x', ''), 'hex'),
      issuer: Buffer.from(issuer.replace('0x', ''), 'hex'),
      claimHash: Buffer.from(claimHash.replace('0x', ''), 'hex'),
      expiry,
    });

    return tx.txId;
  }, []);

  // Verify credential
  const verifyCredential = useCallback(async (commitment: string) => {
    if (!providersRef.current || !contractRef.current) {
      throw new Error('Contract not ready');
    }

    const tx = await submitCallTx(providersRef.current, contractRef.current, 'verifyCredential', {
      commitment: Buffer.from(commitment.replace('0x', ''), 'hex'),
    });

    return tx.txId;
  }, []);

  // Revoke credential
  const revokeCredential = useCallback(async (commitment: string) => {
    if (!providersRef.current || !contractRef.current) {
      throw new Error('Contract not ready');
    }

    const tx = await submitCallTx(providersRef.current, contractRef.current, 'revokeCredential', {
      commitment: Buffer.from(commitment.replace('0x', ''), 'hex'),
    });

    return tx.txId;
  }, []);

  return {
    state,
    error,
    walletAddress,
    balance,
    issueCredential,
    verifyCredential,
    revokeCredential,
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
  const state = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));

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

  const zkConfigPath = '/contract/src/managed/PrivaCred';
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'priva-cred-frontend-private-state',
      walletProvider,
      privateStoragePasswordProvider: async () => 'PrivaCred-Secure-Store-2025!',
      accountId: walletProvider.getCoinPublicKey(),
    }),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(CONFIG.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}
