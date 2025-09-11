import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = { projectId: 'jamat-tajneed-44f6d' };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function exportToJson() {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    
    const data = { members: {}, families: {} };
    
    // Export members
    const membersSnapshot = await getDocs(collection(db, 'members'));
    membersSnapshot.docs.forEach(doc => {
      data.members[doc.id] = doc.data();
    });
    
    // Export families
    const familiesSnapshot = await getDocs(collection(db, 'families'));
    familiesSnapshot.docs.forEach(doc => {
      data.families[doc.id] = doc.data();
    });
    
    // Save to JSON
    fs.writeFileSync('./firebase-export.json', JSON.stringify(data, null, 2));
    console.log('Data exported to firebase-export.json');
    
  } catch (error) {
    console.error('Export failed:', error);
  }
}

exportToJson();