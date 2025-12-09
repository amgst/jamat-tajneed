const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jamat_tajneed_db',
  user: 'postgres',
  password: '123456',
});

const MEMBERS_JSON_PATH = path.join(__dirname, 'public', 'data', 'members.json');

async function syncMembersJson() {
  const result = await pool.query('SELECT * FROM "Members"');
  const members = result.rows.map(member => ({
    ...member,
    religiousActivities: member.religiousActivities && typeof member.religiousActivities === 'string'
      ? JSON.parse(member.religiousActivities)
      : member.religiousActivities
  }));
  await fs.promises.writeFile(MEMBERS_JSON_PATH, JSON.stringify(members, null, 2), 'utf8');
}

// Members
app.get('/api/members', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Members"');
    const members = result.rows.map(member => ({
      ...member,
      religiousActivities: member.religiousActivities && typeof member.religiousActivities === 'string' 
        ? JSON.parse(member.religiousActivities) 
        : member.religiousActivities
    }));
    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/members', async (req, res) => {
  try {
    const member = req.body;
    const result = await pool.query(`
      INSERT INTO "Members" (id, name, "fatherName", gender, cnic, "dateOfBirth", age, phone, address, "profilePhoto", tanzeem, "familyId", halqa, "hasNewTanzeemTransition", "religiousActivities", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      member.id || require('crypto').randomUUID(),
      member.name,
      member.fatherName || null,
      member.gender,
      member.cnic || null,
      member.dateOfBirth,
      member.age,
      member.phone || null,
      member.address,
      member.profilePhoto || null,
      member.tanzeem,
      member.familyId || null,
      member.halqa || null,
      member.hasNewTanzeemTransition || false,
      JSON.stringify(member.religiousActivities || {}),
      member.createdAt || new Date().toISOString(),
      member.updatedAt || new Date().toISOString()
    ]);
    res.json(result.rows[0]);
    await syncMembersJson(); // <-- sync JSON file
  } catch (error) {
    console.error('Error creating member:', error);
    res.status(500).json({ error: error.message });
  }
});

// Families
app.get('/api/families', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Families"');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching families:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/families/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const f = req.body;
    const result = await pool.query(`
      UPDATE "Families" SET 
        "headId" = COALESCE($2, "headId"),
        "familyName" = COALESCE($3, "familyName"),
        "familyNumber" = COALESCE($4, "familyNumber"),
        "memberIds" = COALESCE($5, "memberIds"),
        "totalMembers" = COALESCE($6, "totalMembers"),
        "halqa" = COALESCE($7, "halqa"),
        "familyHistory" = COALESCE($8, "familyHistory"),
        "updatedAt" = COALESCE($9, "updatedAt")
      WHERE id = $1
      RETURNING *
    `, [
      id,
      f.headId ?? null,
      f.familyName ?? null,
      f.familyNumber ?? null,
      f.memberIds ?? null,
      f.totalMembers ?? null,
      f.halqa ?? null,
      f.familyHistory ?? null,
      f.updatedAt ?? new Date().toISOString()
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating family:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stats
app.get('/api/stats', async (req, res) => {
  try {
    const [members, families, tanzeem, ageGroups, halqas, religiousData, recentMembers] = await Promise.all([
      pool.query('SELECT COUNT(*)::int as count, gender FROM "Members" GROUP BY gender'),
      pool.query('SELECT COUNT(*) as count FROM "Families"'),
      pool.query('SELECT tanzeem, COUNT(*) as count FROM "Members" GROUP BY tanzeem'),
      pool.query(`
        SELECT 
          CASE 
            WHEN age < 7 THEN 'Under 7'
            WHEN age BETWEEN 7 AND 15 THEN '7-15'
            WHEN age BETWEEN 16 AND 25 THEN '16-25'
            WHEN age BETWEEN 26 AND 40 THEN '26-40'
            WHEN age BETWEEN 41 AND 60 THEN '41-60'
            ELSE 'Above 60'
          END as age_group,
          COUNT(*)::int as count
        FROM "Members" 
        WHERE age IS NOT NULL 
        GROUP BY age_group
        ORDER BY age_group
      `),
      pool.query("SELECT halqa, COUNT(*)::int as count FROM \"Members\" WHERE halqa IS NOT NULL AND halqa != '' GROUP BY halqa ORDER BY count DESC"),
      pool.query('SELECT COUNT(*) as count FROM "Members" WHERE "religiousActivities" IS NOT NULL'),
      pool.query("SELECT COUNT(*) as count FROM \"Members\" WHERE \"createdAt\" >= NOW() - INTERVAL '30 days'")
    ]);
    
    const maleCount = members.rows.find(row => row.gender === 'male')?.count || 0;
    const femaleCount = members.rows.find(row => row.gender === 'female')?.count || 0;
    
    console.log('Members by gender:', members.rows);
    console.log('Age groups:', ageGroups.rows);
    console.log('Halqas:', halqas.rows);
    
    res.json({
      totalMembers: members.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
      maleMembers: parseInt(maleCount),
      femaleMembers: parseInt(femaleCount),
      totalFamilies: parseInt(families.rows[0]?.count || 0),
      tanzeemStats: tanzeem.rows.reduce((acc, row) => {
        acc[row.tanzeem] = parseInt(row.count);
        return acc;
      }, {}),
      ageGroups: ageGroups.rows.reduce((acc, row) => {
        acc[row.age_group] = parseInt(row.count);
        return acc;
      }, {}),
      halqaStats: halqas.rows.reduce((acc, row) => {
        acc[row.halqa] = parseInt(row.count);
        return acc;
      }, {}),
      membersWithReligiousData: parseInt(religiousData.rows[0]?.count || 0),
      recentMembers: parseInt(recentMembers.rows[0]?.count || 0)
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const member = req.body;
    console.log('Updating member with religious activities:', member.religiousActivities);
    const result = await pool.query(`
      UPDATE "Members" SET 
        name = $2, "fatherName" = $3, gender = $4, cnic = $5, 
        "dateOfBirth" = $6, age = $7, phone = $8, address = $9, "profilePhoto" = $10, 
        tanzeem = $11, "familyId" = $12, halqa = $13, "hasNewTanzeemTransition" = $14, 
        "religiousActivities" = $15, "updatedAt" = $16
      WHERE id = $1 RETURNING *
    `, [
      id,
      member.name,
      member.fatherName || null,
      member.gender,
      member.cnic || null,
      member.dateOfBirth,
      member.age,
      member.phone || null,
      member.address,
      member.profilePhoto || null,
      member.tanzeem,
      member.familyId || null,
      member.halqa || null,
      member.hasNewTanzeemTransition || false,
      JSON.stringify(member.religiousActivities || {}),
      new Date().toISOString()
    ]);
    const updatedMember = {
      ...result.rows[0],
      religiousActivities: result.rows[0].religiousActivities && typeof result.rows[0].religiousActivities === 'string'
        ? JSON.parse(result.rows[0].religiousActivities)
        : result.rows[0].religiousActivities
    };
    res.json(updatedMember);
    await syncMembersJson(); // <-- sync JSON file
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM "Members" WHERE id = $1', [id]);
    res.json({ success: true });
    await syncMembersJson(); // <-- sync JSON file
  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => console.log('API running on http://localhost:3001'));

// Save JSON data to public/data (used in JSON storage mode)
app.post('/api/save-data', async (req, res) => {
  try {
    const { filename, data } = req.body || {};
    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }
    const safeName = path.basename(filename); // prevent path traversal
    const targetPath = path.join(__dirname, 'public', 'data', safeName);
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.writeFile(targetPath, JSON.stringify(data ?? [], null, 2), 'utf8');
    return res.json({ success: true, path: `/public/data/${safeName}` });
  } catch (err) {
    console.error('Failed to save JSON file:', err);
    return res.status(500).json({ error: 'Failed to save JSON file' });
  }
});