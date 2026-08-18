import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react()],
    server: {
      port: parseInt(env.VITE_PORT) || 3000,
      host: true,
      allowedHosts: true,
      proxy: {
        '/socket.io': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:3001',
          ws: true,
          changeOrigin: true
        },
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:3001',
          changeOrigin: true
        }
      },
    }
  };
});

