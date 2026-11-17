'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync('www/index.html', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');

assert(html.includes('async function signInWithGoogleAccount()'), 'Google sign-in helper is required');
assert(html.includes('async function claimShopOwnerAccess(signedUser)'), 'Shop-owner claim flow must exist');
assert(html.includes('async function apkProvisionShopOwner(email,expiresOn,shopName,industryType)'), 'Owner invitation flow must exist');
assert(html.includes('db.collection("pendingOwnerInvites").doc(email)'), 'Owner must issue a Firestore Gmail invitation');
assert(html.includes('member.merchantStaff!==true') && html.includes('member.status!=="active"'), 'Staff login must validate active membership');
assert(html.includes('String(member.email||"").toLowerCase()!==String(u.email||"").toLowerCase()'), 'Staff login must match the authenticated synthetic email');
assert(html.includes('staffRole="employee"'), 'All staff accounts must map to the single Staff role');
assert(html.includes('<option value="employee" selected>ဝန်ထမ်း (Staff)</option>'), 'Manager/Cashier account types must not be offered');
assert(html.includes('async function applyRoleUI()') || html.includes('function applyRoleUI(){'), 'Role-based interface permissions are required');
assert(html.includes('async function reloadAll(){const owner=staffRole==="owner",staff=staffRole==="employee"'), 'Staff must not load purchase/expense/profit cost data');

for (const name of ['claimOwnerProvisioning','createShopOwnerAccount','listPlatformUsers','grantSubscription','setPlatformUserAccess']) {
  assert(!html.includes('httpsCallable("' + name + '")'), 'Login and subscription controls must not depend on undeployed callable ' + name);
}
assert(rules.includes('match /pendingOwnerInvites/{emailKey}'), 'Firestore invitation rules are required');
assert(rules.includes('request.auth.token.email == resource.data.email'), 'Invitation must be restricted to exact verified Gmail');
assert(rules.includes('request.resource.data.claimedUid == request.auth.uid'), 'Only the authenticating UID may claim the invitation');
assert(rules.includes("request.resource.data.plan == 'owner-managed'"), 'Invitation claim must create owner-managed subscription');
assert(rules.includes("request.resource.data.status == 'claimed'"), 'Invitation must be single-use');
assert(rules.includes("hasShopMemberRole(shopId, ['manager','cashier','employee'])"), 'Staff sales access must be covered by Firestore rules');

console.log('PASS: Google Owner/Shop Owner login, one-time verified Gmail invitation, direct Spark-plan Firestore controls, single Staff role and tenant permissions.');
