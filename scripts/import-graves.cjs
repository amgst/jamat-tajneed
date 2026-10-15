// Import a Grave Ledger JSON export using the existing Firebase CLI account.
// Default mode validates locally. --import performs a create-only database import.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
require('dotenv').config({ path: path.join(__dirname, '../.env.local'), quiet: true });

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error('Usage: node scripts/import-graves.cjs <export.json> [--import]');
  const source = fs.readFileSync(path.join(__dirname, '../src/services/graveRecords.ts'), 'utf8').replace(/^import .*;\r?\n/gm, '');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {} };
  vm.runInNewContext(compiled, context);
  const records = context.exports.parseGraveExport(JSON.parse(fs.readFileSync(inputPath, 'utf8')));
  console.log(`Validated ${records.length} unique records. Images and unknown fields excluded.`);
  if (!process.argv.includes('--import')) return;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Tajneed Firebase project ID is missing.');
  const cliRoot = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib');
  const auth = require(path.join(cliRoot, 'auth.js'));
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error('Sign in using firebase login first.');
  const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase']);
  const root = `projects/${projectId}/databases/(default)/documents`;
  const base = `https://firestore.googleapis.com/v1/${root}`;
  async function request(endpoint, body) {
    const response = await fetch(`${base}${endpoint}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      const error = (Array.isArray(failure) ? failure[0] : failure)?.error;
      const reason = error?.status || 'unknown';
      const detail = error?.details?.find(item => item.reason)?.reason || '';
      throw new Error(`Firestore request failed (${response.status}, ${reason}${detail ? `, ${detail}` : ''}).`);
    }
    return response.json();
  }
  const names = records.map(record => `${root}/graves/${record.id}`);
  const before = await request(':batchGet', { documents: names });
  const existing = new Set(before.filter(item => item.found).map(item => item.found.name));
  const pending = records.filter((_, index) => !existing.has(names[index]));
  const fieldValue = value => value === null ? { nullValue: null } : typeof value === 'number' ? { doubleValue: value } : { stringValue: value };
  for (let offset = 0; offset < pending.length; offset += 400) {
    await request(':commit', { writes: pending.slice(offset, offset + 400).map(record => ({
      update: { name: `${root}/graves/${record.id}`, fields: Object.fromEntries(Object.entries(record).map(([key, value]) => [key, fieldValue(value)])) },
      currentDocument: { exists: false },
    })) });
  }
  const after = await request(':batchGet', { documents: names });
  const found = after.filter(item => item.found);
  if (found.length !== records.length) throw new Error('Post-import record count verification failed.');
  for (const record of pending) {
    const saved = found.find(item => item.found.name === `${root}/graves/${record.id}`).found.fields;
    for (const [key, value] of Object.entries(record)) {
      if (JSON.stringify(saved[key]) !== JSON.stringify(fieldValue(value))) {
        // Firestore may return integer-valued doubles as integerValue.
        if (typeof value === 'number' && Number(saved[key]?.integerValue ?? saved[key]?.doubleValue) === value) continue;
        throw new Error(`Post-import field verification failed: ${key}.`);
      }
    }
    if (saved.imageUrl) throw new Error('Unexpected image field found in imported record.');
  }
  console.log(`Verified ${records.length} records in Tajneed: ${pending.length} imported, ${existing.size} existing records preserved.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
