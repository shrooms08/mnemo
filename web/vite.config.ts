import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/rpc/sui-testnet': {
          target: 'https://sui-testnet.gateway.tatum.io',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/rpc\/sui-testnet/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.TATUM_API_KEY) {
                proxyReq.setHeader('x-api-key', env.TATUM_API_KEY)
              }
            })
          },
        },
      },
    },
  }
})
