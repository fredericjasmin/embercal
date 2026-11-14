import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Serves /api/recent locally (dev and preview) with the same handler Vercel runs.
function localApi(env) {
  const mount = server => {
    server.middlewares.use('/api/recent', async (req, res) => {
      if (env.FIRMS_MAP_KEY) process.env.FIRMS_MAP_KEY = env.FIRMS_MAP_KEY
      const { default: handler } = await import('./api/recent.js')
      const shim = {
        setHeader: (k, v) => res.setHeader(k, v),
        status(code) { res.statusCode = code; return this },
        json(obj) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) },
      }
      await handler(req, shim)
    })
  }
  return { name: 'local-api', configureServer: mount, configurePreviewServer: mount }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), localApi(env)] }
})
