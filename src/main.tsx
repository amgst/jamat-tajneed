import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
