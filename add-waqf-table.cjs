
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'jamat.db');
const db = new Database(DB_PATH);

console.log('Adding WaqfJadeed table...');

db.exec(`
  CREATE TABLE IF NOT EXISTS "WaqfJadeed" (
    "id" TEXT PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "promiseAmount" INTEGER DEFAULT 0,
    "paidAmount" INTEGER DEFAULT 0,
    "notes" TEXT,
    "updatedAt" TEXT,
    FOREIGN KEY ("memberId") REFERENCES "Members" ("id") ON DELETE CASCADE,
    UNIQUE("memberId", "year")
  );
`);

console.log('WaqfJadeed table created successfully.');
