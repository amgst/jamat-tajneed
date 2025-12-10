const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SQLite Database
const DB_PATH = path.join(__dirname, 'jamat.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Ensure tables exist
const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='WaqfJadeedSpecial'");
if (!tableCheck.get()) {
  db.prepare(`
        CREATE TABLE IF NOT EXISTS "WaqfJadeedSpecial" (
            "id" TEXT PRIMARY KEY,
            "familyId" TEXT,
            "year" INTEGER,
            "name" TEXT,
            "gender" TEXT,
            "isDeceased" INTEGER,
            "promiseAmount" INTEGER,
            "nagarparAmount" INTEGER,
            "paidAmount" INTEGER,
            "notes" TEXT,
            "createdAt" TEXT,
            "updatedAt" TEXT,
            FOREIGN KEY("familyId") REFERENCES "Families"("id") ON DELETE CASCADE
        )
    `).run();
}

// --- Helpers ---
const parseActivities = (jsonStr) => {
  try {
    return jsonStr && typeof jsonStr === 'string' ? JSON.parse(jsonStr) : (jsonStr || {});
  } catch (e) {
    return {};
  }
};

const parseMemberIds = (jsonStr) => {
  try {
    return jsonStr ? JSON.parse(jsonStr) : [];
  } catch (e) {
    return [];
  }
};

// --- Members Endpoints ---

// Get all members
app.get('/api/members', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM "Members"');
    const rows = stmt.all();
    const members = rows.map(member => ({
      ...member,
      religiousActivities: parseActivities(member.religiousActivities),
      hasNewTanzeemTransition: !!member.hasNewTanzeemTransition // Convert 0/1 to boolean
    }));
    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create member
app.post('/api/members', (req, res) => {
  try {
    const member = req.body;
    const stmt = db.prepare(`
            INSERT INTO "Members" (
                id, name, "fatherName", gender, cnic, "dateOfBirth", age, phone, address, "profilePhoto", tanzeem, "familyId", halqa, "hasNewTanzeemTransition", "religiousActivities", "createdAt", "updatedAt"
            ) VALUES (
                @id, @name, @fatherName, @gender, @cnic, @dateOfBirth, @age, @phone, @address, @profilePhoto, @tanzeem, @familyId, @halqa, @hasNewTanzeemTransition, @religiousActivities, @createdAt, @updatedAt
            )
        `);

    const newMember = {
      id: member.id || require('crypto').randomUUID(),
      name: member.name,
      fatherName: member.fatherName || null,
      gender: member.gender,
      cnic: member.cnic || null,
      dateOfBirth: member.dateOfBirth,
      age: member.age,
      phone: member.phone || null,
      address: member.address,
      profilePhoto: member.profilePhoto || null,
      tanzeem: member.tanzeem,
      familyId: member.familyId || null,
      halqa: member.halqa || null,
      hasNewTanzeemTransition: member.hasNewTanzeemTransition ? 1 : 0,
      religiousActivities: JSON.stringify(member.religiousActivities || {}),
      createdAt: member.createdAt || new Date().toISOString(),
      updatedAt: member.updatedAt || new Date().toISOString()
    };

    stmt.run(newMember);

    // Return the created member object (with parsed JSON/boolean for consistency)
    res.json({
      ...newMember,
      religiousActivities: JSON.parse(newMember.religiousActivities),
      hasNewTanzeemTransition: !!newMember.hasNewTanzeemTransition
    });
  } catch (error) {
    console.error('Error creating member:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update member
app.put('/api/members/:id', (req, res) => {
  try {
    const { id } = req.params;
    const member = req.body;

    console.log(`Updating member ${id}...`);

    // Fetch existing member to ensure we don't overwrite missing fields
    const getStmt = db.prepare('SELECT * FROM "Members" WHERE id = ?');
    const currentMember = getStmt.get(id);

    if (!currentMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const stmt = db.prepare(`
            UPDATE "Members" SET 
                name = @name, 
                "fatherName" = @fatherName, 
                gender = @gender, 
                cnic = @cnic, 
                "dateOfBirth" = @dateOfBirth, 
                age = @age, 
                phone = @phone, 
                address = @address, 
                "profilePhoto" = @profilePhoto, 
                tanzeem = @tanzeem, 
                "familyId" = @familyId, 
                halqa = @halqa, 
                "hasNewTanzeemTransition" = @hasNewTanzeemTransition, 
                "religiousActivities" = @religiousActivities, 
                "updatedAt" = @updatedAt
            WHERE id = @id
        `);

    // Helper to parse JSON safely if it's already a string in DB, or use default
    const currentReligiousActivities = currentMember.religiousActivities
      ? JSON.parse(currentMember.religiousActivities)
      : {};

    const updatedData = {
      id: id,
      name: member.name !== undefined ? member.name : currentMember.name,
      fatherName: member.fatherName !== undefined ? member.fatherName : currentMember.fatherName,
      gender: member.gender !== undefined ? member.gender : currentMember.gender,
      cnic: member.cnic !== undefined ? member.cnic : currentMember.cnic,
      dateOfBirth: member.dateOfBirth !== undefined ? member.dateOfBirth : currentMember.dateOfBirth,
      age: member.age !== undefined ? member.age : currentMember.age,
      phone: member.phone !== undefined ? member.phone : currentMember.phone,
      address: member.address !== undefined ? member.address : currentMember.address,
      profilePhoto: member.profilePhoto !== undefined ? member.profilePhoto : currentMember.profilePhoto,
      tanzeem: member.tanzeem !== undefined ? member.tanzeem : currentMember.tanzeem,
      familyId: member.familyId !== undefined ? member.familyId : currentMember.familyId,
      halqa: member.halqa !== undefined ? member.halqa : currentMember.halqa,
      hasNewTanzeemTransition: member.hasNewTanzeemTransition !== undefined
        ? (member.hasNewTanzeemTransition ? 1 : 0)
        : currentMember.hasNewTanzeemTransition,
      religiousActivities: member.religiousActivities !== undefined
        ? JSON.stringify(member.religiousActivities)
        : JSON.stringify(currentReligiousActivities),
      updatedAt: new Date().toISOString()
    };

    const result = stmt.run(updatedData);

    // Return the full updated member
    const updatedRow = getStmt.get(id);

    res.json({
      ...updatedRow,
      religiousActivities: parseActivities(updatedRow.religiousActivities),
      hasNewTanzeemTransition: !!updatedRow.hasNewTanzeemTransition
    });

  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete member
app.delete('/api/members/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM "Members" WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      // It's possible the member didn't exist, but we generally return success for idempotency or 404
      // Returning success here is fine for this app
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Families Endpoints ---

// Get all families
app.get('/api/families', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM "Families"');
    const rows = stmt.all();
    const families = rows.map(f => ({
      ...f,
      memberIds: parseMemberIds(f.memberIds)
    }));
    res.json(families);
  } catch (error) {
    console.error('Error fetching families:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update family
app.put('/api/families/:id', (req, res) => {
  try {
    const { id } = req.params;
    const f = req.body;

    // Perform a dynamic update or just assume all fields for simplicity. 
    // For better-sqlite3 with named parameters, we often prefer explicit fields.
    // We'll fetch the existing record first to merge, similar to how COALESCE works but in JS.

    const getStmt = db.prepare('SELECT * FROM "Families" WHERE id = ?');
    const currentFamily = getStmt.get(id);

    if (!currentFamily) {
      return res.status(404).json({ error: 'Family not found' });
    }

    const updatedFamilyParams = {
      id: id,
      headId: f.headId !== undefined ? f.headId : currentFamily.headId,
      familyName: f.familyName !== undefined ? f.familyName : currentFamily.familyName,
      familyNumber: f.familyNumber !== undefined ? f.familyNumber : currentFamily.familyNumber,
      memberIds: f.memberIds !== undefined ? JSON.stringify(f.memberIds) : currentFamily.memberIds,
      totalMembers: f.totalMembers !== undefined ? f.totalMembers : currentFamily.totalMembers,
      halqa: f.halqa !== undefined ? f.halqa : currentFamily.halqa,
      familyHistory: f.familyHistory !== undefined ? f.familyHistory : currentFamily.familyHistory,
      updatedAt: new Date().toISOString()
    };

    const updateStmt = db.prepare(`
            UPDATE "Families" SET 
                "headId" = @headId,
                "familyName" = @familyName,
                "familyNumber" = @familyNumber,
                "memberIds" = @memberIds,
                "totalMembers" = @totalMembers,
                "halqa" = @halqa,
                "familyHistory" = @familyHistory,
                "updatedAt" = @updatedAt
            WHERE id = @id
        `);

    updateStmt.run(updatedFamilyParams);

    // refetch to return formatted response
    const finalFamily = getStmt.get(id);
    res.json({
      ...finalFamily,
      memberIds: parseMemberIds(finalFamily.memberIds)
    });

  } catch (error) {
    console.error('Error updating family:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Stats Endpoint ---

app.get('/api/stats', (req, res) => {
  try {
    // Run queries in parallel? SQLite is synchronous in node by default with better-sqlite3, 
    // but it is very fast. We execute sequentially.

    const membersCountStmt = db.prepare('SELECT COUNT(*) as count, gender FROM "Members" GROUP BY gender');
    const membersRows = membersCountStmt.all();

    const familiesCountStmt = db.prepare('SELECT COUNT(*) as count FROM "Families"');
    const familiesCount = familiesCountStmt.get().count;

    const tanzeemStmt = db.prepare('SELECT tanzeem, COUNT(*) as count FROM "Members" GROUP BY tanzeem');
    const tanzeemRows = tanzeemStmt.all();

    const ageGroupStmt = db.prepare(`
            SELECT 
              CASE 
                WHEN age < 7 THEN 'Under 7'
                WHEN age BETWEEN 7 AND 15 THEN '7-15'
                WHEN age BETWEEN 16 AND 25 THEN '16-25'
                WHEN age BETWEEN 26 AND 40 THEN '26-40'
                WHEN age BETWEEN 41 AND 60 THEN '41-60'
                ELSE 'Above 60'
              END as age_group,
              COUNT(*) as count
            FROM "Members" 
            WHERE age IS NOT NULL 
            GROUP BY age_group
            ORDER BY age_group
        `);
    const ageGroupRows = ageGroupStmt.all();

    const halqaStmt = db.prepare("SELECT halqa, COUNT(*) as count FROM \"Members\" WHERE halqa IS NOT NULL AND halqa != '' GROUP BY halqa ORDER BY count DESC");
    const halqaRows = halqaStmt.all();

    const religiousDataStmt = db.prepare('SELECT COUNT(*) as count FROM "Members" WHERE "religiousActivities" IS NOT NULL AND "religiousActivities" != \'{}\'');
    const religiousDataCount = religiousDataStmt.get().count;

    const recentMembersStmt = db.prepare("SELECT COUNT(*) as count FROM \"Members\" WHERE datetime(\"createdAt\") >= datetime('now', '-30 days')");
    const recentMembersCount = recentMembersStmt.get().count;

    const maleCount = membersRows.find(row => row.gender === 'male')?.count || 0;
    const femaleCount = membersRows.find(row => row.gender === 'female')?.count || 0;

    res.json({
      totalMembers: membersRows.reduce((sum, row) => sum + row.count, 0),
      maleMembers: maleCount,
      femaleMembers: femaleCount,
      totalFamilies: familiesCount,
      tanzeemStats: tanzeemRows.reduce((acc, row) => {
        acc[row.tanzeem] = row.count;
        return acc;
      }, {}),
      ageGroups: ageGroupRows.reduce((acc, row) => {
        acc[row.age_group] = row.count;
        return acc;
      }, {}),
      halqaStats: halqaRows.reduce((acc, row) => {
        acc[row.halqa] = row.count;
        return acc;
      }, {}),
      membersWithReligiousData: religiousDataCount,
      recentMembers: recentMembersCount
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Waqf-e-Jadeed Endpoints ---

// Get Waqf-e-Jadeed records
app.get('/api/waqf-jadeed', (req, res) => {
  try {
    const { year, memberId } = req.query;
    let query = 'SELECT * FROM "WaqfJadeed"';
    const params = [];
    const conditions = [];

    if (year) {
      conditions.push('year = ?');
      params.push(year);
    }
    if (memberId) {
      conditions.push('"memberId" = ?');
      params.push(memberId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Join with members to get names for easy display if needed, but for now just raw records
    // If we want sorting by member name, we'd join. keeping it simple.

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    // Attach payments
    const paymentsStmt = db.prepare('SELECT * FROM "WaqfJadeedPayments" WHERE "waqfJadeedId" = ? ORDER BY date DESC');
    const records = rows.map(row => ({
      ...row,
      payments: paymentsStmt.all(row.id)
    }));

    res.json(records);
  } catch (error) {
    console.error('Error fetching WaqfJadeed records:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save (Upsert) Waqf-e-Jadeed record
app.post('/api/waqf-jadeed', (req, res) => {
  try {
    const { memberId, year, promiseAmount, nagarparAmount, paidAmount, notes } = req.body;

    if (!memberId || !year) {
      return res.status(400).json({ error: 'memberId and year are required' });
    }

    const stmt = db.prepare(`
            INSERT INTO "WaqfJadeed" (id, "memberId", year, "promiseAmount", "nagarparAmount", "paidAmount", notes, "updatedAt")
            VALUES (@id, @memberId, @year, @promiseAmount, @nagarparAmount, @paidAmount, @notes, @updatedAt)
            ON CONFLICT("memberId", year) DO UPDATE SET
                "promiseAmount" = excluded."promiseAmount",
                "nagarparAmount" = excluded."nagarparAmount",
                notes = excluded.notes,
                "updatedAt" = excluded."updatedAt"
        `);
    // Removed "paidAmount" = excluded."paidAmount" from UPDATE to prevent overwriting calculation

    const id = require('crypto').randomUUID();

    const params = {
      id, // Only used if inserting new
      memberId,
      year,
      promiseAmount: promiseAmount || 0,
      nagarparAmount: nagarparAmount || 0,
      paidAmount: paidAmount || 0, // Initial value for new records, but ignored on update
      notes: notes || '',
      updatedAt: new Date().toISOString()
    };

    stmt.run(params);

    // Return the updated record
    const getStmt = db.prepare('SELECT * FROM "WaqfJadeed" WHERE "memberId" = ? AND year = ?');
    const row = getStmt.get(memberId, year);

    // Attach payments
    const paymentsStmt = db.prepare('SELECT * FROM "WaqfJadeedPayments" WHERE "waqfJadeedId" = ? ORDER BY date DESC');
    const payments = paymentsStmt.all(row.id);

    res.json({ ...row, payments });

  } catch (error) {
    console.error('Error saving WaqfJadeed record:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add Payment
app.post('/api/waqf-jadeed/payment', (req, res) => {
  try {
    const { memberId, year, amount, date, notes } = req.body;

    if (!memberId || !year || amount === undefined) {
      return res.status(400).json({ error: 'memberId, year, and amount are required' });
    }

    // 1. Ensure WaqfJadeed record exists
    const findStmt = db.prepare('SELECT * FROM "WaqfJadeed" WHERE "memberId" = ? AND year = ?');
    let waqfRecord = findStmt.get(memberId, year);

    if (!waqfRecord) {
      const id = require('crypto').randomUUID();
      const insertStmt = db.prepare(`
            INSERT INTO "WaqfJadeed" (id, "memberId", year, "promiseAmount", "paidAmount", notes, "updatedAt")
            VALUES (?, ?, ?, 0, 0, '', ?)
        `);
      insertStmt.run(id, memberId, year, new Date().toISOString());
      waqfRecord = { id, memberId, year, promiseAmount: 0, paidAmount: 0, notes: '' };
    }

    // 2. Insert Payment
    const paymentId = require('crypto').randomUUID();
    const insertPayment = db.prepare(`
        INSERT INTO "WaqfJadeedPayments" (id, "waqfJadeedId", amount, date, notes)
        VALUES (?, ?, ?, ?, ?)
    `);

    const paymentDate = date || new Date().toISOString();
    insertPayment.run(paymentId, waqfRecord.id, amount, paymentDate, notes || '');

    // 3. Recalculate Total Paid
    const sumStmt = db.prepare('SELECT SUM(amount) as total FROM "WaqfJadeedPayments" WHERE "waqfJadeedId" = ?');
    const totalPaid = sumStmt.get(waqfRecord.id).total || 0;

    const updateWaqf = db.prepare('UPDATE "WaqfJadeed" SET "paidAmount" = ?, "updatedAt" = ? WHERE id = ?');
    updateWaqf.run(totalPaid, new Date().toISOString(), waqfRecord.id);

    // 4. Return updated record with payments
    const getStmt = db.prepare('SELECT * FROM "WaqfJadeed" WHERE id = ?');
    const updatedRow = getStmt.get(waqfRecord.id);
    const paymentsStmt = db.prepare('SELECT * FROM "WaqfJadeedPayments" WHERE "waqfJadeedId" = ? ORDER BY date DESC');

    res.json({
      ...updatedRow,
      payments: paymentsStmt.all(waqfRecord.id)
    });

  } catch (error) {
    console.error('Error adding payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete Payment
app.delete('/api/waqf-jadeed/payment/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Get payment to find parent waqfId
    const getPayment = db.prepare('SELECT * FROM "WaqfJadeedPayments" WHERE id = ?');
    const payment = getPayment.get(id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const deleteStmt = db.prepare('DELETE FROM "WaqfJadeedPayments" WHERE id = ?');
    deleteStmt.run(id);

    // Recalculate Total Paid
    const waqfId = payment.waqfJadeedId;
    const sumStmt = db.prepare('SELECT SUM(amount) as total FROM "WaqfJadeedPayments" WHERE "waqfJadeedId" = ?');
    const totalPaid = sumStmt.get(waqfId).total || 0;

    const updateWaqf = db.prepare('UPDATE "WaqfJadeed" SET "paidAmount" = ?, "updatedAt" = ? WHERE id = ?');
    updateWaqf.run(totalPaid, new Date().toISOString(), waqfId);

    res.json({ success: true, waqfJadeedId: waqfId, newTotal: totalPaid });

  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Waqf-e-Jadeed Special Members Endpoints ---

// Get Special Records
app.get('/api/waqf-jadeed/special', (req, res) => {
  try {
    const { year, familyId } = req.query;
    let query = 'SELECT * FROM "WaqfJadeedSpecial"';
    const params = [];
    const conditions = [];

    if (year) {
      conditions.push('year = ?');
      params.push(year);
    }
    if (familyId) {
      conditions.push('"familyId" = ?');
      params.push(familyId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching special records:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create/Update Special Record
app.post('/api/waqf-jadeed/special', (req, res) => {
  try {
    const { id, familyId, year, name, gender, isDeceased, promiseAmount, nagarparAmount, paidAmount, notes } = req.body;

    if (!familyId || !year || !name) {
      return res.status(400).json({ error: 'familyId, year, and name are required' });
    }

    const recordId = id || require('crypto').randomUUID();
    const now = new Date().toISOString();

    if (id) {
      // Update
      const stmt = db.prepare(`
                UPDATE "WaqfJadeedSpecial" SET
                    "name" = @name,
                    "gender" = @gender,
                    "isDeceased" = @isDeceased,
                    "promiseAmount" = @promiseAmount,
                    "nagarparAmount" = @nagarparAmount,
                    "notes" = @notes,
                    "updatedAt" = @updatedAt
                WHERE id = @id
            `);
      stmt.run({
        id,
        name,
        gender: gender || 'male',
        isDeceased: isDeceased ? 1 : 0,
        promiseAmount: promiseAmount || 0,
        nagarparAmount: nagarparAmount || 0,
        notes: notes || '',
        updatedAt: now
      });
    } else {
      // Insert
      const stmt = db.prepare(`
                INSERT INTO "WaqfJadeedSpecial" (id, "familyId", year, name, gender, "isDeceased", "promiseAmount", "nagarparAmount", "paidAmount", notes, "createdAt", "updatedAt")
                VALUES (@id, @familyId, @year, @name, @gender, @isDeceased, @promiseAmount, @nagarparAmount, @paidAmount, @notes, @createdAt, @updatedAt)
            `);
      stmt.run({
        id: recordId,
        familyId,
        year,
        name,
        gender: gender || 'male',
        isDeceased: isDeceased ? 1 : 0,
        promiseAmount: promiseAmount || 0,
        nagarparAmount: nagarparAmount || 0,
        paidAmount: paidAmount || 0,
        notes: notes || '',
        createdAt: now,
        updatedAt: now
      });
    }

    const getStmt = db.prepare('SELECT * FROM "WaqfJadeedSpecial" WHERE id = ?');
    const row = getStmt.get(recordId);
    res.json({ ...row, isDeceased: !!row.isDeceased });

  } catch (error) {
    console.error('Error saving special record:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete Special Record
app.delete('/api/waqf-jadeed/special/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM "WaqfJadeedSpecial" WHERE id = ?');
    stmt.run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting special record:', error);
    res.status(500).json({ error: error.message });
  }
});


// JSON data Save/Load endpoints (kept if needed for manual file backup, unrelated to core DB)
app.post('/api/save-data', (req, res) => {
  // This looks like a file system utility you might still want.
  // Keeping it as is using 'fs'
  const fs = require('fs');
  try {
    const { filename, data } = req.body || {};
    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }
    const safeName = path.basename(filename);
    const targetPath = path.join(__dirname, 'public', 'data', safeName);
    // Ensure dir exists
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(targetPath, JSON.stringify(data ?? [], null, 2), 'utf8');
    return res.json({ success: true, path: `/public/data/${safeName}` });
  } catch (err) {
    console.error('Failed to save JSON file:', err);
    return res.status(500).json({ error: 'Failed to save JSON file' });
  }
});

app.listen(3001, () => console.log('API running on http://localhost:3001'));