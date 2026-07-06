import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from the GrewAnalytics root (two levels up) and the Treasury app root (one level up)
  const envGrew = loadEnv(mode, path.resolve(__dirname, '../../'), '')
  const envTreasury = loadEnv(mode, path.resolve(__dirname, '../'), '')
  const env = { ...envGrew, ...envTreasury }

  const host = env.FRONTEND_HOST || process.env.FRONTEND_HOST || '127.0.0.1'
  const port = parseInt(env.FRONTEND_PORT || process.env.FRONTEND_PORT || '8000', 10)
  const backendPort = env.BACKEND_PORT || process.env.BACKEND_PORT || '8002'

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_FRONTEND_PORT': JSON.stringify(port.toString()),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
    },
    resolve: {
      alias: {
        '@grew/auth': path.resolve(__dirname, '../../packages/auth/src'),
        '@supabase/supabase-js': path.resolve(__dirname, './node_modules/@supabase/supabase-js'),
        'zustand': path.resolve(__dirname, './node_modules/zustand'),
        'react': path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
        'lucide-react': path.resolve(__dirname, './node_modules/lucide-react'),
      },
    },
    server: {
      host: host,
      port: port,
      strictPort: true,
      // Single-URL standalone: browser only talks to :8000; /api is tunnelled to
      // the Treasury backend (root-level routes) so nothing is cross-origin.
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    }
  }
})
