/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_XAI_API_KEY: string
  readonly VITE_XAI_MODEL: string
  readonly VITE_XAI_API_URL: string
  readonly VITE_CONTRACT_ADDRESS: string
  readonly VITE_NETWORK_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
