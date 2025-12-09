
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'jamat.db');
// Delete existing DB if you want a fresh start, or just open it
// fs.unlinkSync(DB_PATH); 

const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create Tables
const createSchema = () => {
    console.log('Creating schema...');

    db.exec(`
    CREATE TABLE IF NOT EXISTS "Families" (
      "id" TEXT PRIMARY KEY,
      "headId" TEXT,
      "familyName" TEXT,
      "familyNumber" TEXT,
      "memberIds" TEXT, -- JSON array string
      "totalMembers" INTEGER,
      "halqa" TEXT,
      "familyHistory" TEXT,
      "createdAt" TEXT,
      "updatedAt" TEXT
    );

    CREATE TABLE IF NOT EXISTS "Members" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "fatherName" TEXT,
      "gender" TEXT,
      "cnic" TEXT,
      "dateOfBirth" TEXT,
      "age" INTEGER,
      "phone" TEXT,
      "address" TEXT,
      "profilePhoto" TEXT,
      "tanzeem" TEXT,
      "familyId" TEXT,
      "halqa" TEXT,
      "hasNewTanzeemTransition" INTEGER DEFAULT 0, -- boolean as 0/1
      "religiousActivities" TEXT, -- JSON string
      "createdAt" TEXT,
      "updatedAt" TEXT,
      FOREIGN KEY ("familyId") REFERENCES "Families" ("id") ON DELETE SET NULL
    );
  `);

    console.log('Schema created.');
};

const migrateData = () => {
    console.log('Migrating data from JSON...');

    // Paths to JSON files
    const membersPath = path.join(__dirname, 'public', 'data', 'members.json');
    const familiesPath = path.join(__dirname, 'public', 'data', 'families.json');

    let members = [];
    let families = [];

    if (fs.existsSync(membersPath)) {
        members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
    }
    if (fs.existsSync(familiesPath)) {
        families = JSON.parse(fs.readFileSync(familiesPath, 'utf8'));
    }

    // Insert Families
    const insertFamily = db.prepare(`
        INSERT OR REPLACE INTO "Families" (
            id, "headId", "familyName", "familyNumber", "memberIds", "totalMembers", "halqa", "familyHistory", "createdAt", "updatedAt"
        ) VALUES (
            @id, @headId, @familyName, @familyNumber, @memberIds, @totalMembers, @halqa, @familyHistory, @createdAt, @updatedAt
        )
    `);

    const insertMember = db.prepare(`
        INSERT OR REPLACE INTO "Members" (
            id, name, "fatherName", gender, cnic, "dateOfBirth", age, phone, address, "profilePhoto", tanzeem, "familyId", halqa, "hasNewTanzeemTransition", "religiousActivities", "createdAt", "updatedAt"
        ) VALUES (
            @id, @name, @fatherName, @gender, @cnic, @dateOfBirth, @age, @phone, @address, @profilePhoto, @tanzeem, @familyId, @halqa, @hasNewTanzeemTransition, @religiousActivities, @createdAt, @updatedAt
        )
    `);

    const runTransaction = db.transaction(() => {
        for (const f of families) {
            insertFamily.run({
                id: f.id,
                headId: f.headId || null,
                familyName: f.familyName || null,
                familyNumber: f.familyNumber || null,
                memberIds: JSON.stringify(f.memberIds || []),
                totalMembers: f.totalMembers || 0,
                halqa: f.halqa || null,
                familyHistory: f.familyHistory || null,
                createdAt: f.createdAt || new Date().toISOString(),
                updatedAt: f.updatedAt || new Date().toISOString()
            });
        }
        console.log(`Migrated ${families.length} families.`);

        for (const m of members) {
            insertMember.run({
                id: m.id,
                name: m.name,
                fatherName: m.fatherName || null,
                gender: m.gender,
                cnic: m.cnic || null,
                dateOfBirth: m.dateOfBirth,
                age: m.age,
                phone: m.phone || null,
                address: m.address,
                profilePhoto: m.profilePhoto || null,
                tanzeem: m.tanzeem,
                familyId: m.familyId || null,
                halqa: m.halqa || null,
                hasNewTanzeemTransition: m.hasNewTanzeemTransition ? 1 : 0,
                religiousActivities: JSON.stringify(m.religiousActivities || {}),
                createdAt: m.createdAt || new Date().toISOString(),
                updatedAt: m.updatedAt || new Date().toISOString()
            });
        }
        console.log(`Migrated ${members.length} members.`);
    });

    runTransaction();
};

try {
    createSchema();
    migrateData();
    console.log('Database setup complete: jamat.db');
} catch (err) {
    console.error('Error setting up database:', err);
}
