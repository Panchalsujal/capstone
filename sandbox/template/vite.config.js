import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  cacheDir: './.vite',
  plugins: [preact()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    hmr: {
      // Tell the browser to connect the HMR WebSocket back through the
      // ingress on port 80, using the same host the page was loaded from.
      clientPort: 80,
      protocol: 'ws',
    },
    watch: {
      usePolling: true,
      interval: 300,
      ignored: ['node_modules']
    }
  },
})