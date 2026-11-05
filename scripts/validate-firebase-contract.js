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
const cloudSyncStart = html.indexOf('function startAkCloudSync()');
const cloudSyncEnd = html.indexOf('async function cloudLoad()', cloudSyncStart);
const cloudSyncSource = cloudSyncStart >= 0 ? html.slice(cloudSyncStart, cloudSyncEnd) : '';
for (const required of [
  'revision:committedRevision',
  'current!==expectedRevision',
  'akCloudConflict',
  'if(akLocalDirty)',
  'akCloudSaveInFlight'
]) {
  if (!cloudSyncSource.includes(required)) {
    console.error('Cloud sync must protect against silent concurrent-device overwrites; missing:', required);
    process.exitCode = 1;
  }
}
if (!cloudSyncSource.includes('tx.set(ref') || !cloudSyncSource.includes('runTransaction')) {
  console.error('Cloud saves must use a Firestore transaction with a revision check.');
  process.exitCode = 1;
}
if (!html.includes('const authGeneration=++akAuthGeneration')) {
  console.error('Authentication callbacks must ignore stale async work after account switching.');
  process.exitCode = 1;
}
if (!html.includes('akCloudRevision=snap.exists&&Number.isSafeInteger(snap.data().revision)')) {
  console.error('Initial Cloud load must initialize the revision before enabling synchronization.');
  process.exitCode = 1;
}
if (!html.includes('akCloudConflict=false;akLocalDirty=false;')) {
  console.error('Explicit Cloud Load must clear conflict state only after replacing local data.');
  process.exitCode = 1;
}
if (!serverCallables.has('createPaymentRequest') || !clientCallables.has('createPaymentRequest')) {
  console.error('Payment submissions must use the trusted createPaymentRequest callable.');
  process.exitCode = 1;
}
if (!functionsSource.includes('!screenshotUrl') || !html.includes('KPay ငွေလွှဲ Screenshot မဖြစ်မနေ တင်ပါ')) {
  console.error('KPay payment requests must require a screenshot proof.');
  process.exitCode = 1;
}
if (!functionsSource.includes('paymentReferences') ||
    !functionsSource.includes('status: "pending"') ||
    !functionsSource.includes('paymentRequestId: requestRef.id')) {
  console.error('Payment submission must atomically reserve a unique transaction reference.');
  process.exitCode = 1;
}
if ((functionsSource.match(/update\("KBZPay:" \+ normalizedReference\)/g) || []).length < 2 ||
    !functionsSource.includes('replace(/\\s+/g, "").toUpperCase()')) {
  console.error('KBZPay references must use the same whitespace/case normalization at submission and approval.');
  process.exitCode = 1;
}
const paymentRule = rules.match(/match \/paymentRequests\/\{requestId\} \{([\s\S]*?)\n\s*\}/);
if (!paymentRule || !/allow create, update, delete: if false/.test(paymentRule[1])) {
  console.error('Clients must not write payment requests directly.');
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
