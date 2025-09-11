const fs = require('fs');

// Read the exported data
const rawData = JSON.parse(fs.readFileSync('./firebase-export.json', 'utf8'));

// Convert to Firebase emulator format
const emulatorData = {
  version: "1.0.0",
  firestore: {
    version: "1.0.0",
    collections: []
  }
};

// Convert members
if (rawData.members) {
  const membersCollection = {
    collectionId: "members",
    docs: []
  };

  Object.entries(rawData.members).forEach(([id, data]) => {
    const doc = {
      docId: id,
      data: {}
    };

    // Convert each field to Firestore format
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string') {
        doc.data[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        doc.data[key] = { integerValue: value.toString() };
      } else if (typeof value === 'boolean') {
        doc.data[key] = { booleanValue: value };
      } else if (Array.isArray(value)) {
        doc.data[key] = {
          arrayValue: {
            values: value.map(v => ({ stringValue: v.toString() }))
          }
        };
      }
    });

    membersCollection.docs.push(doc);
  });

  emulatorData.firestore.collections.push(membersCollection);
}

// Convert families
if (rawData.families) {
  const familiesCollection = {
    collectionId: "families",
    docs: []
  };

  Object.entries(rawData.families).forEach(([id, data]) => {
    const doc = {
      docId: id,
      data: {}
    };

    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string') {
        doc.data[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        doc.data[key] = { integerValue: value.toString() };
      } else if (typeof value === 'boolean') {
        doc.data[key] = { booleanValue: value };
      } else if (Array.isArray(value)) {
        doc.data[key] = {
          arrayValue: {
            values: value.map(v => ({ stringValue: v.toString() }))
          }
        };
      }
    });

    familiesCollection.docs.push(doc);
  });

  emulatorData.firestore.collections.push(familiesCollection);
}

// Write converted data
fs.writeFileSync('./emulator-data.json', JSON.stringify(emulatorData, null, 2));
console.log('Data converted successfully! Use: firebase emulators:start --import=./emulator-data.json');