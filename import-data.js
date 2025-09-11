import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

// Firebase config for emulator
const firebaseConfig = {
  projectId: 'jamat-tajneed-44f6d'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Connect to emulator
try {
  connectFirestoreEmulator(db, 'localhost', 8080);
} catch (error) {
  console.log('Emulator already connected or not available');
}

async function importData() {
  try {
    // Read the JSON data
    const jsonData = JSON.parse(fs.readFileSync('./firebase-export.json', 'utf8'));
    
    console.log('Starting data import...');
    
    // Import members
    if (jsonData.members) {
      console.log(`Importing ${Object.keys(jsonData.members).length} members...`);
      for (const [id, memberData] of Object.entries(jsonData.members)) {
        await setDoc(doc(db, 'members', id), memberData);
      }
      console.log('Members imported successfully');
    }
    
    // Import families
    if (jsonData.families) {
      console.log(`Importing ${Object.keys(jsonData.families).length} families...`);
      for (const [id, familyData] of Object.entries(jsonData.families)) {
        await setDoc(doc(db, 'families', id), familyData);
      }
      console.log('Families imported successfully');
    }
    
    console.log('Data import completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('Error importing data:', error);
    process.exit(1);
  }
}

// Wait a bit for emulator to be ready, then import
setTimeout(importData, 2000);