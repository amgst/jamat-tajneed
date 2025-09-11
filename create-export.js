import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, doc, setDoc } from 'firebase/firestore';
import { spawn } from 'child_process';
import fs from 'fs';

const firebaseConfig = { projectId: 'jamat-tajneed-44f6d' };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createExport() {
  // Start emulator temporarily
  console.log('Starting temporary emulator...');
  const emulator = spawn('firebase', ['emulators:start', '--only=firestore'], { 
    stdio: 'pipe',
    shell: true 
  });

  // Wait for emulator to start
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    
    // Import data
    const jsonData = JSON.parse(fs.readFileSync('./firebase-export.json', 'utf8'));
    
    console.log('Importing data...');
    if (jsonData.members) {
      for (const [id, memberData] of Object.entries(jsonData.members)) {
        await setDoc(doc(db, 'members', id), memberData);
      }
    }
    
    if (jsonData.families) {
      for (const [id, familyData] of Object.entries(jsonData.families)) {
        await setDoc(doc(db, 'families', id), familyData);
      }
    }
    
    console.log('Data imported, creating export...');
    
    // Export data
    const exportProcess = spawn('firebase', ['emulators:export', './firebase-export'], {
      stdio: 'inherit',
      shell: true
    });
    
    exportProcess.on('close', () => {
      console.log('Export created successfully!');
      emulator.kill();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error:', error);
    emulator.kill();
    process.exit(1);
  }
}

createExport();