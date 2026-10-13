import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'antd/dist/reset.css'
import { registerServiceWorker } from './lib/pwa'

registerServiceWorker();

// Add global reset function for development
if (import.meta.env.DEV) {
  (window as any).resetAppData = () => {
    // Since data is now stored in Firebase Firestore,
    // clearing localStorage here will only affect the local auth state.
    // To clear actual data, you need to go to Firebase Console.
    localStorage.removeItem('tajneed_auth_user'); // Clears local auth state
    console.log('App local auth state cleared! To clear actual data, please go to Firebase Firestore console.');
    console.log('Refreshing page...');
    window.location.reload();
  };
  console.log('Development mode: Use resetAppData() to clear local auth state. Data stored in Firebase Firestore must be managed via Firebase Console.');
}

const root = createRoot(document.getElementById('root')!);
async function startApp() {
  try {
    const { default: App } = await import('./App.tsx');
    root.render(<StrictMode><App /></StrictMode>);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
    const firebaseError = code === 'auth/invalid-api-key';
    root.render(<main style={{ maxWidth: 560, margin: '10vh auto', padding: 24, fontFamily: 'system-ui', color: '#26334a' }}>
      <h1>{firebaseError ? 'Firebase configuration needs attention' : 'Unable to start Tajneed'}</h1>
      <p style={{ lineHeight: 1.8 }}>{firebaseError ? 'The Firebase API key in this deployment is missing or invalid. Add the VITE_FIREBASE_* settings to the correct Vercel environment, then redeploy with a fresh build.' : 'The app could not load. Refresh the page. If this continues, check the deployment configuration and browser console.'}</p>
      <button onClick={() => window.location.reload()} style={{ background: '#345eae', color: 'white', padding: '14px 24px', border: 0, borderRadius: 12, cursor: 'pointer' }}>Try again</button>
    </main>);
    console.error('Tajneed startup failed:', error);
  }
}
void startApp();
