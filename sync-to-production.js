import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, getDocs, doc, setDoc } from 'firebase/firestore';

// Local emulator config
const localConfig = {
  projectId: 'jamat-tajneed-44f6d'
};

// Production config
const prodConfig = {
  apiKey: "AIzaSyAa6zRE_7TKpT5nVq3VmO8Kr5-h12PpfGM",
  authDomain: "jamat-tajneed-44f6d.firebaseapp.com",
  projectId: "jamat-tajneed-44f6d",
  storageBucket: "jamat-tajneed-44f6d.firebasestorage.app",
  messagingSenderId: "794157972693",
  appId: "1:794157972693:web:2f012a4f481c5dbc38f65c"
};

async function syncToProduction() {
  // Initialize local (emulator)
  const localApp = initializeApp(localConfig, 'local');
  const localDb = getFirestore(localApp);
  connectFirestoreEmulator(localDb, 'localhost', 8080);

  // Initialize production
  const prodApp = initializeApp(prodConfig, 'prod');
  const prodDb = getFirestore(prodApp);

  try {
    // Sync members
    console.log('Syncing members...');
    const membersSnapshot = await getDocs(collection(localDb, 'members'));
    for (const memberDoc of membersSnapshot.docs) {
      await setDoc(doc(prodDb, 'members', memberDoc.id), memberDoc.data());
    }

    // Sync families
    console.log('Syncing families...');
    const familiesSnapshot = await getDocs(collection(localDb, 'families'));
    for (const familyDoc of familiesSnapshot.docs) {
      await setDoc(doc(prodDb, 'families', familyDoc.id), familyDoc.data());
    }

    console.log('Sync completed successfully!');
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

syncToProduction();