'use strict';

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const functionsSource = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

const clientCallables = new Set(
  [...html.matchAll(/httpsCallable\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)/g)].map(match => match[1])
);
const serverCallables = new Set(
  [...functionsSource.matchAll(/exports\.([A-Za-z0-9_]+)\s*=\s*functions\.https\.onCall\s*\(/g)].map(match => match[1])
);

const missing = [...clientCallables].filter(name => !serverCallables.has(name));
if (missing.length) {
  console.error('Client calls missing Firebase callable exports:', missing.join(', '));
  process.exitCode = 1;
} else {
  console.log('Firebase callable contract OK:', clientCallables.size, 'client callables matched server exports.');
}

const privateRule = rules.match(/match \/users\/\{userId\}\/private\/\{document=\*\*\} \{([\s\S]*?)\n\s*\}/);
if (!privateRule || !/allow read, write: if hasActiveLicense\(userId\)/.test(privateRule[1])) {
  console.error('Private shop data must remain protected by the owner UID/license rule.');
  process.exitCode = 1;
}
const staffRule = rules.match(/match \/shopMembers\/\{memberUid\} \{([\s\S]*?)\n\s*\}/);
if (!staffRule || !/allow write: if false/.test(staffRule[1])) {
  console.error('Staff membership documents must only be writable by trusted Cloud Functions.');
  process.exitCode = 1;
}
if (!/request\.auth\.uid == uid/.test(rules)) {
  console.error('Private shop access must be bound to the authenticated UID.');
  process.exitCode = 1;
}
if (!process.exitCode) console.log('Firestore owner-only private data and trusted staff membership guards OK.');

if (!functionsSource.includes('paymentReferences') || !functionsSource.includes('tx.create(referenceRef')) {
  console.error('Subscription approval must prevent reuse of a KBZPay transaction reference.');
  process.exitCode = 1;
}
const restoreStart = functionsSource.indexOf('exports.restoreCloudBackup =');
const restoreEnd = functionsSource.indexOf('exports.publishGlobalAnnouncement =', restoreStart);
const restoreSource = restoreStart >= 0 ? functionsSource.slice(restoreStart, restoreEnd > restoreStart ? restoreEnd : undefined) : '';
if (!restoreSource.includes('db.runTransaction') ||
    !restoreSource.includes('tx.set(appRef') ||
    !restoreSource.includes('tx.delete(centerRef')) {
  console.error('Cloud restore must atomically restore appData and remove stale center data when absent.');
  process.exitCode = 1;
}
