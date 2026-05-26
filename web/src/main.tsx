import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit'
import { JsonRpcHTTPTransport, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc'
import '@mysten/dapp-kit/dist/index.css'
import './index.css'
import App from './App.tsx'

const USE_TATUM = import.meta.env.VITE_USE_TATUM === 'true'

function buildTestnet() {
  if (!USE_TATUM) {
    console.warn(
      'VITE_USE_TATUM is not "true". Falling back to public Sui testnet RPC.',
    )
    return { network: 'testnet' as const, url: getJsonRpcFullnodeUrl('testnet') }
  }
  // Same-origin path. The Vite dev server proxies this to Tatum and injects
  // the x-api-key header server-side so the key never reaches the browser bundle.
  // TODO(production): replace the Vite proxy with a serverless function (Vercel /
  // Netlify / Cloudflare Workers) that performs the same header injection. Keep
  // this client URL stable across environments.
  return {
    network: 'testnet' as const,
    transport: new JsonRpcHTTPTransport({
      url: '/rpc/sui-testnet',
    }),
  }
}

const { networkConfig } = createNetworkConfig({
  testnet: buildTestnet(),
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </StrictMode>,
)
