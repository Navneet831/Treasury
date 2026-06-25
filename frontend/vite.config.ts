import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from the Treasury app root (one level up from frontend)
  const env = loadEnv(mode, path.resolve(__dirname, '../'), '')

  const host = env.FRONTEND_HOST || '127.0.0.1'
  const port = parseInt(env.FRONTEND_PORT || '8001', 10)

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@grew/auth': path.resolve(__dirname, '../../../packages/auth/src'),
        '@supabase/supabase-js': path.resolve(__dirname, './node_modules/@supabase/supabase-js'),
        'zustand': path.resolve(__dirname, './node_modules/zustand'),
      },
    },
    server: {
      host: host,
      port: port,
      strictPort: true
    }
  }
})
