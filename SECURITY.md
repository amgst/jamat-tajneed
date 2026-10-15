# Security changes and deployment

The app now reads and writes records, settings, and profiles through Firebase only.
Local JSON services and public datasets were removed. Legacy exports were preserved
in `.private-legacy-backup/`, which is ignored by Git and excluded from the web build.
They are not used by the app. Sensitive files remain recoverable in earlier Git history;
restrict repository access and review historical deployments separately.

## Administrator

Only `amgst99@gmail.com` is authorized by `firestore.rules` and the application.
Changing the email field in the app's settings does not grant access. To change
administrator access, update both `firestore.rules` and `src/lib/access.ts`.

## Required deployment

Build and redeploy the website to publish the removed files, security headers, session
login, sanitized exports, and dependency fixes. Existing published builds are unchanged
until redeployed. Old deployment URLs may still contain the previous public datasets;
delete or protect those deployments through the hosting account.

The attempted Firestore rules deployment was denied by project IAM. Sign in to the
Firebase CLI with a Google account authorized to deploy rules to `tajneed-f537c`, then run:

```powershell
firebase deploy --only firestore:rules --project tajneed-f537c
```

Alternatively, copy `firestore.rules` into Firebase Console → Firestore Database → Rules
and publish using an authorized project account. Until this is done, live database
permissions have not changed. The current app administrator email and the project-owner
Google account are separate concepts.

## Verification

```powershell
npm run build
node scripts/verify-security.mjs
node scripts/verify-pwa.mjs
firebase emulators:exec --only firestore --project demo-tajneed-security "node scripts/verify-security.mjs --rules"
npm audit
```

Rules tests cover the authorized administrator, anonymous access, unauthorized signed-in
accounts, and unknown collections. They run against a local demo emulator, never production.
The export tests cover malicious HTML and CSV formulas. The production build must not
contain `/data/members.json` or `/data/families.json`.

Firestore record caching is memory-only. Authentication lasts for the browser session;
logout reloads the app to discard record data held in memory. On first startup, older
Firestore disk caches are cleared. Close old Tajneed tabs if that cleanup is blocked.
