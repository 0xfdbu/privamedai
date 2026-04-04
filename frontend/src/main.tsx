import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id'

// CRITICAL: Set network ID BEFORE importing any contract-related modules
// This must be the very first thing to run
setNetworkId('preprod')
console.log('✅ Network ID set to preprod in main.tsx')

import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
