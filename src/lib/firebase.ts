import { initializeApp } from "firebase/app";
import {
    initializeFirestore,
    memoryLocalCache,
    clearIndexedDbPersistence
} from "firebase/firestore";
import { initializeAuth, browserSessionPersistence } from "firebase/auth";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true,
});
export const auth = initializeAuth(app, { persistence: browserSessionPersistence });
// Purge the cache created by older releases before the first database operation.
export const databaseReady = clearIndexedDbPersistence(db).catch(() => {
    throw new Error('Close other Tajneed tabs and reload to clear the previous offline record cache.');
});
export default app;

// Configure Firestore emulator if in development
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    console.log('Using Firebase emulator');

    // Only connect to emulator in development
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        import('firebase/firestore').then(({ connectFirestoreEmulator }) => {
            try {
                connectFirestoreEmulator(db, 'localhost', 8080);
                console.log('Connected to Firestore emulator');
            } catch (error) {
                console.warn('Could not connect to Firestore emulator:', error);
            }
        }).catch(err => {
            console.warn('Error importing Firestore emulator:', err);
        });
    }
}
