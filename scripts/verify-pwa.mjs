import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root));
const manifest = JSON.parse(read('public/manifest.webmanifest'));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, '/');
for (const icon of manifest.icons) {
  const bytes = read(`public${icon.src}`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(icon.sizes, `${width}x${height}`);
}
assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
assert.ok(read('index.html').toString().includes('/icons/apple-touch-icon.png'));
assert.ok(read('public/icons/apple-touch-icon.png'));

const listeners = {};
const precached = [];
const deleted = [];
const offline = new Response('offline notice');
let networkFails = false;
let claimed = false;
const self = {
  location: { origin: 'https://tajneed.example' },
  addEventListener: (type, callback) => { listeners[type] = callback; },
  skipWaiting: async () => {},
  clients: { claim: async () => { claimed = true; } },
};
vm.runInNewContext(read('public/sw.js').toString(), {
  self, URL, Response,
  fetch: async () => { if (networkFails) throw new Error('offline'); return new Response('online page'); },
  caches: {
    open: async () => ({ addAll: async urls => precached.push(...urls) }),
    keys: async () => ['tajneed-offline-v0', 'tajneed-offline-v1', 'unrelated-cache'],
    delete: async key => { deleted.push(key); },
    match: async () => offline,
  },
});
let pending;
listeners.install({ waitUntil: promise => { pending = promise; } });
await pending;
assert.deepEqual(precached, ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png']);
listeners.activate({ waitUntil: promise => { pending = promise; } });
await pending;
assert.deepEqual(deleted, ['tajneed-offline-v0']);
assert.ok(claimed);
const navigate = () => {
  let response;
  listeners.fetch({ request: { mode: 'navigate', url: 'https://tajneed.example/members/test-person' }, respondWith: promise => { response = promise; } });
  return response;
};
assert.equal(await (await navigate()).text(), 'online page');
networkFails = true;
assert.equal(await (await navigate()).text(), 'offline notice');
for (const request of [
  { mode: 'cors', url: 'https://firestore.googleapis.com/records' },
  { mode: 'navigate', url: 'https://another.example/' },
  { mode: 'cors', url: 'https://tajneed.example/data/members.json' },
]) {
  listeners.fetch({ request, respondWith: () => assert.fail('Record requests must pass through') });
}
console.log('PWA checks passed: manifest icons, offline navigation, cache cleanup, and record request boundaries.');
