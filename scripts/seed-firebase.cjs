
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// NOTE: To use this script with the emulator, set FIRESTORE_EMULATOR_HOST=localhost:8080
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

// Initialize with a dummy project ID for the emulator
initializeApp({
    projectId: 'tajneed-f537c'
});

const db = getFirestore();

async function seedData() {
    const membersPath = path.join(__dirname, '../public/data/members.json');
    const familiesPath = path.join(__dirname, '../public/data/families.json');

    console.log('Reading local data files...');

    if (!fs.existsSync(membersPath)) {
        console.error('members.json not found!');
        return;
    }

    const members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
    const families = fs.existsSync(familiesPath) ? JSON.parse(fs.readFileSync(familiesPath, 'utf8')) : [];

    console.log(`Found ${members.length} members and ${families.length} families.`);

    // Seed Members
    console.log('Seeding members...');
    const memberBatch = db.batch();
    members.forEach(member => {
        const ref = db.collection('members').doc(member.id);
        memberBatch.set(ref, {
            ...member,
            updatedAt: member.updatedAt || new Date().toISOString(),
            createdAt: member.createdAt || new Date().toISOString()
        });
    });
    await memberBatch.commit();
    console.log('Members seeded.');

    // Seed Families
    if (families.length > 0) {
        console.log('Seeding families...');
        const familyBatch = db.batch();
        families.forEach(family => {
            const ref = db.collection('families').doc(family.id);
            familyBatch.set(ref, {
                ...family,
                updatedAt: family.updatedAt || new Date().toISOString(),
                createdAt: family.createdAt || new Date().toISOString()
            });
        });
        await familyBatch.commit();
        console.log('Families seeded.');
    }

    console.log('Seeding complete!');
}

seedData().catch(console.error);
