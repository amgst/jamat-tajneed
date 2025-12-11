import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, writeBatch } from "firebase/firestore";
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const sqlite = new Database(path.join(__dirname, '../jamat.db'));

async function migrate() {
    console.log('Starting migration...');

    const batchSize = 450; // Firestore batch limit is 500
    let batch = writeBatch(db);
    let count = 0;

    // 1. Members
    console.log('Migrating Members...');
    const members = sqlite.prepare('SELECT * FROM Members').all();
    for (const member of members) {
        // Parse JSON fields
        try {
            member.religiousActivities = member.religiousActivities ? JSON.parse(member.religiousActivities) : {};
        } catch { member.religiousActivities = {}; }

        member.hasNewTanzeemTransition = !!member.hasNewTanzeemTransition;

        // SQLite stores dates as strings, which is fine for Firestore (or convert to Timestamp)

        const ref = doc(db, 'members', member.id);
        batch.set(ref, member);
        count++;

        if (count >= batchSize) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
            console.log('Committed batch...');
        }
    }

    // 2. Families
    console.log('Migrating Families...');
    const families = sqlite.prepare('SELECT * FROM Families').all();
    for (const family of families) {
        try {
            family.memberIds = family.memberIds ? JSON.parse(family.memberIds) : [];
        } catch { family.memberIds = []; }

        const ref = doc(db, 'families', family.id);
        batch.set(ref, family);
        count++;

        if (count >= batchSize) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
            console.log('Committed batch...');
        }
    }

    // 3. WaqfJadeed
    console.log('Migrating WaqfJadeed records...');
    // Check if tables exist first to avoid errors on fresh dbs
    try {
        const wjRecords = sqlite.prepare('SELECT * FROM WaqfJadeed').all();
        for (const record of wjRecords) {
            const ref = doc(db, 'waqfJadeed', record.id);
            batch.set(ref, record);
            count++;
            if (count >= batchSize) { await batch.commit(); batch = writeBatch(db); count = 0; }
        }
    } catch (e) { console.log('Skipping WaqfJadeed (table missing?)'); }

    // 4. WaqfJadeedPayments
    try {
        const wjPayments = sqlite.prepare('SELECT * FROM WaqfJadeedPayments').all();
        for (const payment of wjPayments) {
            const ref = doc(db, 'waqfJadeedPayments', payment.id);
            batch.set(ref, payment);
            count++;
            if (count >= batchSize) { await batch.commit(); batch = writeBatch(db); count = 0; }
        }
    } catch (e) { console.log('Skipping WaqfJadeedPayments'); }

    // 5. WaqfJadeedSpecial
    try {
        const wjSpecial = sqlite.prepare('SELECT * FROM WaqfJadeedSpecial').all();
        for (const special of wjSpecial) {
            const ref = doc(db, 'waqfJadeedSpecial', special.id);
            batch.set(ref, {
                ...special,
                isDeceased: !!special.isDeceased
            });
            count++;
            if (count >= batchSize) { await batch.commit(); batch = writeBatch(db); count = 0; }
        }
    } catch (e) { console.log('Skipping WaqfJadeedSpecial'); }


    if (count > 0) {
        await batch.commit();
        console.log('Final batch committed.');
    }

    console.log('Migration complete!');
    process.exit(0);
}

migrate().catch(console.error);
