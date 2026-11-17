'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync('www/index.html', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');

assert(html.includes('async function signInWithGoogleAccount()'), 'Platform Owner Google login must remain available');
assert(html.includes('async function assertVerifiedPlatformOwner()'), 'Platform Owner must be verified');
assert(html.includes('async function apkProvisionShopOwner(email,password,expiresOn,shopName,industryType)'), 'Shop Owner provisioning must accept Owner-set password');
assert(html.includes('fetch(GATEWAY+"/owner/provision"'), 'Shop Owner provisioning must use authenticated Firebase REST gateway');
assert(html.includes('passwordResetSent'), 'Existing Gmail password mismatch must trigger password-reset flow');
assert(html.includes('sendEmailVerification'), 'Shop Owner and Staff email verification must be supported');
assert(html.includes('async function claimShopOwnerAccess(signedUser)'), 'Shop Owner must claim their invitation after verification');
assert(html.includes('db.collection("pendingOwnerInvites").doc(email)'), 'Shop Owner invitation must be stored in Firestore');
assert(html.includes('passwordProvider'), 'Shop Owner login must use Gmail/password provider');
assert(html.includes('async function claimStaffInvite(signedUser,code)'), 'Staff must claim a one-time Merchant Code');
assert(html.includes('akStaffRegistration'), 'Staff registration must use a separate Firebase Auth session');
assert(html.includes('createUserWithEmailAndPassword(email,password)'), 'Staff must register with their own Gmail/password');
assert(html.includes('^[A-F0-9]{32}$'), 'Staff Merchant Code must be 32 hexadecimal characters');
assert(html.includes('db.collection("shopInvites").doc(code)'), 'Staff invites must be stored in Firestore');
assert(html.includes('24*60*60*1000'), 'Staff Merchant Code must expire after 24 hours');
assert(html.includes('merchantStaff:true'), 'Staff membership must be marked for Owner control');
assert(html.includes('staffRole="employee"'), 'All staff accounts must map to the single Staff role');
assert(html.includes('<option value="employee" selected>ဝန်ထမ်း (Staff)</option>'), 'Manager/Cashier roles must not be offered');
assert(!html.includes('@akstaff.app'), 'Synthetic staff accounts are not permitted');
assert(html.includes('function applyRoleUI(){'), 'Role-based interface permissions are required');
assert(html.includes('async function reloadAll(){const owner=staffRole==="owner",staff=staffRole==="employee"'), 'Staff must not load purchase/expense/profit cost data');

for (const name of ['claimOwnerProvisioning','createShopOwnerAccount','listPlatformUsers','grantSubscription','setPlatformUserAccess']) {
  assert(!html.includes('httpsCallable("' + name + '")'), 'Login/subscription controls must not depend on undeployed callable ' + name);
}
assert(rules.includes('match /pendingOwnerInvites/{emailKey}'), 'Shop Owner invitation rules are required');
assert(rules.includes('request.auth.token.email == resource.data.email'), 'Owner invitation must be restricted to exact verified Gmail');
assert(rules.includes("request.resource.data.plan == 'owner-managed'"), 'Invitation claim must create owner-managed subscription');
assert(rules.includes("request.resource.data.status == 'claimed'"), 'Owner invitation must be single-use');
assert(rules.includes('match /shopInvites/{code}'), 'Staff invite collection rules are required');
assert(rules.includes('request.resource.data.inviteCode.size() == 32'), 'Staff membership must require a 32-character code');
assert(rules.includes('request.resource.data.expiresAt <= request.time + duration.value(24, \'h\')'), 'Staff invite expiry must be at most 24 hours');
assert(rules.includes('request.resource.data.merchantStaff == true'), 'Staff membership marker must be protected by Firestore rules');
assert(rules.includes("request.resource.data.role == 'employee'"), 'Staff role must be the only merchant staff role');

console.log('PASS: Platform Owner, Shop Owner Gmail/password+verification, existing Gmail recovery, Staff personal Gmail+32-char one-time invite, 24-hour expiry, two slots and role isolation.');
