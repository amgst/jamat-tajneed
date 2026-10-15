import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'antd/dist/reset.css'
import { registerServiceWorker } from './lib/pwa'

registerServiceWorker();

// Remove data left by obsolete local-only versions; Firebase is now the sole source.
for (const key of Object.keys(localStorage)) {
  if (key.startsWith('tajneed_') || key.startsWith('file_') || ['app_settings', 'user_profile', 'storage_mode', 'auth_user'].includes(key)) localStorage.removeItem(key);
}
const root = createRoot(document.getElementById('root')!);
async function startApp() {
  try {
    const { databaseReady } = await import('./lib/firebase');
    await databaseReady;
    const { default: App } = await import('./App.tsx');
    root.render(<StrictMode><App /></StrictMode>);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
    const firebaseError = code === 'auth/invalid-api-key';
    root.render(<main style={{ maxWidth: 560, margin: '10vh auto', padding: 24, fontFamily: 'system-ui', color: '#26334a' }}>
      <h1>{firebaseError ? 'Firebase configuration needs attention' : 'Unable to start Tajneed'}</h1>
      <p style={{ lineHeight: 1.8 }}>{firebaseError ? 'The Firebase API key in this deployment is missing or invalid. Add the VITE_FIREBASE_* settings to the correct Vercel environment, then redeploy with a fresh build.' : 'Close other Tajneed tabs and reload. If this continues, check the Firebase configuration and browser console.'}</p>
      <button onClick={() => window.location.reload()} style={{ background: '#345eae', color: 'white', padding: '14px 24px', border: 0, borderRadius: 12, cursor: 'pointer' }}>Try again</button>
    </main>);
    console.error('Tajneed startup failed:', error);
  }
}
void startApp();
