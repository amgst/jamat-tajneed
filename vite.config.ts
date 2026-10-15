import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'validate-firebase-environment',
      configResolved(config) {
        if (config.command !== 'build') return;
        const required = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];
        const missing = required.filter(name => !config.env[name]?.trim());
        if (missing.length) throw new Error(`Missing Firebase environment variables: ${missing.join(', ')}. Add them to the Vercel environment being deployed, then rebuild.`);
      }
    },
    react()
  ],
  define: {
    global: 'globalThis'
  }
})
