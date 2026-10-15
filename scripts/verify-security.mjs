import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

const window = new JSDOM('').window;
const purifier = createDOMPurify(window);
for (const payload of ['<img src=x onerror="alert(1)">', '<svg onload="alert(1)"></svg>', '<script>alert(1)</script>', '<a href="javascript:alert(1)">name</a>']) {
  const div = window.document.createElement('div');
  div.innerHTML = purifier.sanitize(payload);
  assert.equal(div.querySelector('script,[onerror],[onload],[href^="javascript:"]'), null);
}
const helperSource = fs.readFileSync('src/utils/helpers.ts', 'utf8');
const csvSource = helperSource.slice(helperSource.indexOf('const convertToCSV ='));
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(csvSource + '\nexports.csv = convertToCSV;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const csv = context.exports.csv([{ name: '=HYPERLINK("https://example.com")', notes: 'A,"B"\nC' }]);
assert.ok(csv.includes("'=HYPERLINK"));
assert.ok(csv.includes('"A,""B""\nC"'));
for (const file of ['public/data/members.json', 'public/data/families.json', 'dist/data/members.json', 'dist/data/families.json']) assert.equal(fs.existsSync(file), false, `${file} exposes records`);
const page = fs.readFileSync('src/pages/WaqfJadeed.tsx', 'utf8');
assert.equal((page.match(/\.innerHTML\s*=/g) || []).length, (page.match(/\.innerHTML\s*= DOMPurify\.sanitize\(/g) || []).length);
const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8').replace(/^\uFEFF/, ''));
assert.ok(config.headers.find(entry => entry.source === '/(.*)').headers.some(header => header.key === 'Content-Security-Policy' && header.value.includes("frame-ancestors 'none'")));
console.log('Passed: HTML injection, CSV formulas/escaping, public-data removal, export sinks and security headers.');
window.close();

if (process.argv.includes('--rules')) {
  const { initializeTestEnvironment, assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
  const { doc, getDoc, setDoc } = await import('firebase/firestore');
  const env = await initializeTestEnvironment({ projectId: 'demo-tajneed-security', firestore: { host: '127.0.0.1', port: 8085, rules: fs.readFileSync('firestore.rules', 'utf8') } });
  try {
    const admin = env.authenticatedContext('admin', { email: 'amgst99@gmail.com' }).firestore();
    const other = env.authenticatedContext('other', { email: 'not-authorized@example.com' }).firestore();
    const anonymous = env.unauthenticatedContext().firestore();
    for (const collection of ['members', 'families', 'graves', 'settings', 'profiles', 'receiptBooks', 'waqfJadeed', 'waqfJadeedMarkazPayments']) {
      await assertSucceeds(setDoc(doc(admin, collection, 'test'), { name: 'Test' }));
      await assertSucceeds(getDoc(doc(admin, collection, 'test')));
      for (const db of [other, anonymous]) {
        await assertFails(getDoc(doc(db, collection, 'test')));
        await assertFails(setDoc(doc(db, collection, 'test'), { name: 'Changed' }));
      }
    }
    await assertFails(setDoc(doc(admin, 'unknownCollection', 'test'), {}));
    console.log('Passed: Firestore admin access, anonymous and unauthorized denials, unknown collection denial.');
  } finally { await env.cleanup(); }
}
