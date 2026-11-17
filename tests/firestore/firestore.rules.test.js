const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
  serverTimestamp,
} = require('firebase/firestore');

const PROJECT_ID = 'demo-ak-sale-rules';
let testEnv;

function futureTimestamp(days = 30) {
  return Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function seedLicense(uid, days = 30) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'licenses', uid), {
      uid,
      status: 'active',
      expiresAt: futureTimestamp(days),
      plan: '30-days',
    });
  });
}

async function seedPrivateData(uid) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', uid, 'private', 'posData'), {
      marker: uid,
      updatedAt: Timestamp.now(),
    });
  });
}

describe('AK Sale Firestore security baseline', function () {
  this.timeout(30000);

  before(async () => {
    const rules = fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules },
    });
  });

  after(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('gives Staff sales access but blocks purchases, expenses, costs and price edits', async () => {
    await seedLicense('shop-a');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'shopMembers', 'staff-a'), {
        shopId: 'shop-a', role: 'employee', status: 'active',
        email: 'staff@example.com', merchantStaff: true,
      });
      await setDoc(doc(db, 'shops', 'shop-a', 'pos', 'products', 'records', 'item-a'), {
        name: 'Hammer', retail: 5000, wholesale: 4500, stock: 10,
      });
      await setDoc(doc(db, 'shops', 'shop-a', 'pos', 'productCosts', 'records', 'item-a'), {
        cost: 3000,
      });
    });
    const staffDb = testEnv.authenticatedContext('staff-a', {
      email: 'staff@example.com', email_verified: true,
    }).firestore();
    await assertSucceeds(getDoc(doc(staffDb, 'shops', 'shop-a', 'pos', 'products', 'records', 'item-a')));
    await assertSucceeds(setDoc(doc(staffDb, 'shops', 'shop-a', 'pos', 'sales', 'records', 'sale-a'), {
      total: 5000, paid: 5000, due: 0, productName: 'Hammer', qty: 1,
    }));
    await assertSucceeds(setDoc(doc(staffDb, 'shops', 'shop-a', 'pos', 'products', 'records', 'item-a'), {
      name: 'Hammer', retail: 5000, wholesale: 4500, stock: 9,
    }));
    await assertFails(setDoc(doc(staffDb, 'shops', 'shop-a', 'pos', 'products', 'records', 'item-a'), {
      name: 'Hammer', retail: 7000, wholesale: 6500, stock: 9,
    }));
    await assertFails(getDoc(doc(staffDb, 'shops', 'shop-a', 'pos', 'productCosts', 'records', 'item-a')));
    await assertFails(getDoc(doc(staffDb, 'shops', 'shop-a', 'pos', 'purchases', 'records', 'purchase-a')));
    await assertFails(getDoc(doc(staffDb, 'shops', 'shop-a', 'pos', 'expenses', 'records', 'expense-a')));
  });

  it('allows only the exact invited, verified Gmail to claim a shop-owner license once', async () => {
    const ownerDb = testEnv.authenticatedContext('platform-owner-uid', {
      email: 'painglin102@gmail.com', email_verified: true,
    }).firestore();
    const inviteRef = doc(ownerDb, 'pendingOwnerInvites', 'shop@example.com');
    await assertSucceeds(setDoc(inviteRef, {
      email: 'shop@example.com', shopName: 'AK Hardware', industryType: 'hardware',
      status: 'pending', invitedBy: 'platform-owner-uid',
      createdAt: serverTimestamp(), expiresAt: futureTimestamp(30),
    }));

    const uninvited = testEnv.authenticatedContext('other-user', {
      email: 'other@example.com', email_verified: true,
    }).firestore();
    await assertFails(getDoc(doc(uninvited, 'pendingOwnerInvites', 'shop@example.com')));

    const unverified = testEnv.authenticatedContext('unverified-user', {
      email: 'shop@example.com', email_verified: false,
    }).firestore();
    await assertFails(getDoc(doc(unverified, 'pendingOwnerInvites', 'shop@example.com')));

    const invitee = testEnv.authenticatedContext('shop-owner-uid', {
      email: 'shop@example.com', email_verified: true,
    }).firestore();
    const readable = await assertSucceeds(getDoc(doc(invitee, 'pendingOwnerInvites', 'shop@example.com')));
    assert.equal(readable.data().status, 'pending');

    const batch = writeBatch(invitee);
    batch.set(doc(invitee, 'licenses', 'shop-owner-uid'), {
      uid: 'shop-owner-uid', email: 'shop@example.com', shopName: 'AK Hardware',
      industryType: 'hardware', status: 'active', plan: 'owner-managed',
      expiresAt: futureTimestamp(30), provisionedBy: 'platform-owner-uid',
      provisionedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    batch.update(doc(invitee, 'pendingOwnerInvites', 'shop@example.com'), {
      status: 'claimed', claimedUid: 'shop-owner-uid', claimedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());

    const secondClaim = writeBatch(invitee);
    secondClaim.set(doc(invitee, 'licenses', 'shop-owner-uid-2'), {
      uid: 'shop-owner-uid-2', email: 'shop@example.com', shopName: 'Hijack',
      industryType: 'general', status: 'active', plan: 'owner-managed',
      expiresAt: futureTimestamp(30), provisionedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    secondClaim.update(doc(invitee, 'pendingOwnerInvites', 'shop@example.com'), {
      status: 'claimed', claimedUid: 'shop-owner-uid-2', claimedAt: serverTimestamp(),
    });
    await assertFails(secondClaim.commit());
  });

  it('allows only Platform Owner to create and manage Gmail invitations', async () => {
    const ownerDb = testEnv.authenticatedContext('platform-owner-uid', {
      email: 'painglin102@gmail.com', email_verified: true,
    }).firestore();
    const invite = doc(ownerDb, 'pendingOwnerInvites', 'shop@example.com');
    await assertSucceeds(setDoc(invite, {
      email: 'shop@example.com', shopName: 'Shop A', industryType: 'general',
      status: 'pending', invitedBy: 'platform-owner-uid',
      createdAt: serverTimestamp(), expiresAt: futureTimestamp(30),
    }));
    const customerDb = testEnv.authenticatedContext('shop-a', {
      email: 'shop-a@example.com', email_verified: true,
    }).firestore();
    await assertFails(setDoc(doc(customerDb, 'pendingOwnerInvites', 'other@example.com'), {
      email: 'other@example.com', shopName: 'Fake', industryType: 'general',
      status: 'pending', invitedBy: 'shop-a',
      createdAt: serverTimestamp(), expiresAt: futureTimestamp(30),
    }));
    await assertFails(setDoc(doc(customerDb, 'pendingOwnerInvites', 'shop@example.com'), {
      email: 'shop@example.com', shopName: 'Hijack', industryType: 'general',
      status: 'pending', invitedBy: 'shop-a',
      createdAt: serverTimestamp(), expiresAt: futureTimestamp(365),
    }));
  });

  it('allows an authenticated user to check their own missing staff membership', async () => {
    const db = testEnv.authenticatedContext('new-user', {
      email: 'new-user@example.com', email_verified: true,
    }).firestore();
    await assertSucceeds(getDoc(doc(db, 'shopMembers', 'new-user')));
    await assertFails(getDoc(doc(db, 'shopMembers', 'another-user')));
  });

  it('denies anonymous access to private POS data', async () => {
    await seedPrivateData('shop-a');
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'users', 'shop-a', 'private', 'posData')));
  });

  it('allows an active licensed shop owner to access their own private POS data', async () => {
    await seedLicense('shop-a');
    await seedPrivateData('shop-a');
    const db = testEnv.authenticatedContext('shop-a', {
      email: 'shop-a@example.com',
      email_verified: true,
    }).firestore();

    await assertSucceeds(getDoc(doc(db, 'users', 'shop-a', 'private', 'posData')));
    await assertSucceeds(setDoc(doc(db, 'users', 'shop-a', 'private', 'posData'), {
      marker: 'shop-a',
      updatedAt: Timestamp.now(),
    }));
  });

  it('denies access when the shop license is expired', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'licenses', 'shop-a'), {
        uid: 'shop-a',
        status: 'active',
        expiresAt: Timestamp.fromMillis(Date.now() - 60_000),
        plan: '30-days',
      });
      await setDoc(doc(context.firestore(), 'users', 'shop-a', 'private', 'posData'), {
        marker: 'shop-a',
      });
    });

    const db = testEnv.authenticatedContext('shop-a', {
      email: 'shop-a@example.com',
      email_verified: true,
    }).firestore();
    await assertFails(getDoc(doc(db, 'users', 'shop-a', 'private', 'posData')));
  });

  it('prevents one shop from reading another shop private POS data', async () => {
    await seedLicense('shop-a');
    await seedLicense('shop-b');
    await seedPrivateData('shop-b');
    const db = testEnv.authenticatedContext('shop-a', {
      email: 'shop-a@example.com',
      email_verified: true,
    }).firestore();
    await assertFails(getDoc(doc(db, 'users', 'shop-b', 'private', 'posData')));
  });

  it('prevents a customer from issuing or changing their own license', async () => {
    const db = testEnv.authenticatedContext('shop-a', {
      email: 'shop-a@example.com',
      email_verified: true,
    }).firestore();
    const license = doc(db, 'licenses', 'shop-a');
    await assertFails(setDoc(license, {
      uid: 'shop-a',
      status: 'active',
      expiresAt: futureTimestamp(365),
      plan: '365-days',
    }));
  });

  it('requires a verified Gmail before creating a subscription access request', async () => {
    const unverified = testEnv.authenticatedContext('shop-a', {
      email: 'shop-a@example.com', email_verified: false,
    }).firestore();
    const requestData = {
      uid: 'shop-a', email: 'shop-a@example.com', days: 30, status: 'pending',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(unverified, 'subscriptionAccessRequests', 'shop-a'), requestData));
    const verified = testEnv.authenticatedContext('shop-b', {
      email: 'shop-b@example.com', email_verified: true,
    }).firestore();
    await assertSucceeds(setDoc(doc(verified, 'subscriptionAccessRequests', 'shop-b'), {
      ...requestData, uid: 'shop-b', email: 'shop-b@example.com',
    }));
  });

  it('allows the Platform Owner to issue a license with an atomic capacity increment', async () => {
    const db = testEnv.authenticatedContext('platform-owner-uid', {
      email: 'painglin102@gmail.com',
      email_verified: true,
    }).firestore();
    const counter = doc(db, 'platformMeta', 'shopCapacity');
    await assertSucceeds(setDoc(counter, { activeShopCount: 0, updatedAt: serverTimestamp() }));
    const license = doc(db, 'licenses', 'shop-a');
    await assertFails(setDoc(license, {
      uid: 'shop-a', status: 'active', expiresAt: futureTimestamp(30), plan: '30-days',
    }));
    const batch = writeBatch(db);
    batch.set(license, {
      uid: 'shop-a', status: 'active', expiresAt: futureTimestamp(30), plan: '30-days',
    });
    batch.update(counter, {
      activeShopCount: 1, lastIssuedUid: 'shop-a', updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  it('allows only the verified Platform Owner to reconcile a stale shop-capacity counter', async () => {
    const ownerDb = testEnv.authenticatedContext('platform-owner-uid', {
      email: 'painglin102@gmail.com', email_verified: true,
    }).firestore();
    const counter = doc(ownerDb, 'platformMeta', 'shopCapacity');
    await assertSucceeds(setDoc(counter, { activeShopCount: 4, updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(counter, { activeShopCount: 2, updatedAt: serverTimestamp() }, { merge: true }));

    const unverifiedOwnerDb = testEnv.authenticatedContext('platform-owner-uid', {
      email: 'painglin102@gmail.com', email_verified: false,
    }).firestore();
    await assertFails(setDoc(doc(unverifiedOwnerDb, 'platformMeta', 'shopCapacity'), {
      activeShopCount: 3, updatedAt: serverTimestamp(),
    }, { merge: true }));

    const customerDb = testEnv.authenticatedContext('shop-a', {
      email: 'shop-a@example.com', email_verified: true,
    }).firestore();
    await assertFails(setDoc(doc(customerDb, 'platformMeta', 'shopCapacity'), {
      activeShopCount: 3, updatedAt: serverTimestamp(),
    }, { merge: true }));
  });

  it('denies Platform Owner administration to an unverified account using the Owner email', async () => {
    const db = testEnv.authenticatedContext('platform-owner-uid', {
      email: 'painglin102@gmail.com',
      email_verified: false,
    }).firestore();
    await assertFails(setDoc(doc(db, 'platformMeta', 'shopCapacity'), {
      activeShopCount: 0, updatedAt: serverTimestamp(),
    }));
    await assertFails(getDoc(doc(db, 'licenses', 'shop-a')));
    await assertFails(getDoc(doc(db, 'shops', 'platform-owner-uid', 'pos', 'products', 'records', 'item-1')));
  });

  it('requires each Owner Free Beta slot to be atomically paired with a new profile and one-time claim', async () => {
    const db = testEnv.authenticatedContext('platform-owner-uid', {
      email: 'painglin102@gmail.com', email_verified: true,
    }).firestore();
    const capacity = doc(db, 'freeBetaCapacity', 'slots');
    const addBetaShop = (batch, uid, email, count, createCapacity = false) => {
      const now = serverTimestamp();
      batch.set(doc(db, 'freeBetaUsers', uid), {
        uid, email, shopName: 'Beta Shop', status: 'active', plan: 'free-beta',
        createdAt: now, lastLoginAt: now,
      });
      batch.set(doc(db, 'freeTrialClaims', email), { uid, email, createdAt: now });
      if (createCapacity) batch.set(capacity, { count, updatedAt: now, lastIssuedUid: uid });
      else batch.update(capacity, { count, updatedAt: now, lastIssuedUid: uid });
    };
    const first = writeBatch(db);
    addBetaShop(first, 'beta-1', 'beta-1@example.com', 1, true);
    await assertSucceeds(first.commit());

    await assertFails(setDoc(capacity, {
      count: 2, updatedAt: serverTimestamp(), lastIssuedUid: 'beta-2',
    }, { merge: true }));

    const second = writeBatch(db);
    addBetaShop(second, 'beta-2', 'beta-2@example.com', 2);
    await assertSucceeds(second.commit());

    await assertFails(setDoc(capacity, {
      count: 101, updatedAt: serverTimestamp(), lastIssuedUid: 'beta-101',
    }, { merge: true }));
  });

  it('allows paid shop issuance after 100 free-beta slots while rejecting counter-only increments', async () => {
    const db = testEnv.authenticatedContext('platform-owner-uid', {
      email: 'painglin102@gmail.com', email_verified: true,
    }).firestore();
    const counter = doc(db, 'platformMeta', 'shopCapacity');
    await assertSucceeds(setDoc(counter, { activeShopCount: 100, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(counter, {
      activeShopCount: 101, lastIssuedUid: 'shop-101', updatedAt: serverTimestamp(),
    }, { merge: true }));
    const batch = writeBatch(db);
    batch.set(doc(db, 'licenses', 'shop-101'), {
      uid: 'shop-101', status: 'active', expiresAt: futureTimestamp(30), plan: '30-days',
    });
    batch.update(counter, {
      activeShopCount: 101, lastIssuedUid: 'shop-101', updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  it('allows shop owner to read workspace metadata but denies direct workspace writes', async () => {
    await seedLicense('shop-a');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'shops', 'shop-a', 'workspace', 'current'), {
        revision: 1,
      });
    });

    const db = testEnv.authenticatedContext('shop-a', {
      email: 'shop-a@example.com',
      email_verified: true,
    }).firestore();
    await assertSucceeds(getDoc(doc(db, 'shops', 'shop-a', 'workspace', 'current')));
    await assertFails(setDoc(doc(db, 'shops', 'shop-a', 'workspace', 'current'), {
      revision: 2,
    }));
  });

  async function seedInvite(shopId, code, role = 'cashier', days = 1) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'shopInvites', code), {
        shopId, role, status: 'open', createdAt: Timestamp.now(),
        expiresAt: futureTimestamp(days), createdBy: shopId,
      });
    });
  }

  async function claimInvite(staffUid, email, shopId, code, slot = 1, role = 'cashier') {
    const db = testEnv.authenticatedContext(staffUid, {
      email, email_verified: true,
    }).firestore();
    const slotId = shopId + '_' + slot;
    const batch = writeBatch(db);
    batch.set(doc(db, 'shopMembers', staffUid), {
      shopId, role, status: 'active', email, createdAt: serverTimestamp(),
      createdBy: shopId, inviteCode: code, slotId, canPrint: false,
    });
    batch.set(doc(db, 'shopStaffSlots', slotId), {
      shopId, uid: staffUid, slot, inviteCode: code, createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'shopInvites', code), {
      status: 'claimed', claimedBy: staffUid, claimedAt: serverTimestamp(),
    });
    await batch.commit();
    return db;
  }

  it('allows a shop owner to create and advance workspace revision metadata only', async () => {
    await seedLicense('shop-a');
    const ownerDb = testEnv.authenticatedContext('shop-a', {
      email: 'shop-a@example.com', email_verified: true,
    }).firestore();
    const meta = doc(ownerDb, 'shops', 'shop-a', 'workspace', 'current');
    await assertSucceeds(setDoc(meta, { revision: 1, updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(meta, { revision: 2, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(meta, { revision: 4, updatedAt: serverTimestamp() }));
    const otherDb = testEnv.authenticatedContext('other-shop', {
      email: 'other@example.com', email_verified: true,
    }).firestore();
    await assertFails(getDoc(doc(otherDb, 'shops', 'shop-a', 'workspace', 'current')));
  });

  it('allows a licensed shop owner to create an invite and a verified code holder to read it', async () => {
    await seedLicense('shop-a');
    const ownerDb = testEnv.authenticatedContext('shop-a', {
      email: 'shop-a@example.com', email_verified: true,
    }).firestore();
    const inviteRef = doc(ownerDb, 'shopInvites', 'ABCDEF0123456789ABCDEF0123456789');
    await assertSucceeds(setDoc(inviteRef, {
      shopId: 'shop-a', role: 'cashier', status: 'open',
      createdAt: serverTimestamp(), expiresAt: futureTimestamp(1), createdBy: 'shop-a',
    }));
    const strangerDb = testEnv.authenticatedContext('random-user', {
      email: 'random@example.com', email_verified: true,
    }).firestore();
    await assertSucceeds(getDoc(doc(strangerDb, 'shopInvites', 'ABCDEF0123456789ABCDEF0123456789')));
  });

  it('allows the verified Platform Owner to create staff invites in their own workspace without a customer license', async () => {
    const ownerDb = testEnv.authenticatedContext('platform-owner', {
      email: 'painglin102@gmail.com', email_verified: true,
    }).firestore();
    const inviteRef = doc(ownerDb, 'shopInvites', 'FEDCBA9876543210FEDCBA9876543210');
    await assertSucceeds(setDoc(inviteRef, {
      shopId: 'platform-owner', role: 'cashier', status: 'open',
      createdAt: serverTimestamp(), expiresAt: futureTimestamp(1), createdBy: 'platform-owner',
    }));
  });

  it('allows staff to claim a one-time invite atomically without custom claims', async () => {
    await seedLicense('shop-a');
    await seedInvite('shop-a', '0123456789ABCDEF0123456789ABCDEF');
    const db = await claimInvite('staff-a', 'staff-a@example.com', 'shop-a',
      '0123456789ABCDEF0123456789ABCDEF');
    await assertSucceeds(getDoc(doc(db, 'shopMembers', 'staff-a')));
    await assertSucceeds(getDoc(doc(db, 'shops', 'shop-a', 'workspace', 'current')));
  });

  it('denies reading an expired invite code', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'shopInvites', 'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE'), {
        shopId: 'shop-a', role: 'cashier', status: 'open',
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(Date.now() - 60_000),
        createdBy: 'shop-a',
      });
    });
    const staffDb = testEnv.authenticatedContext('staff-a', {
      email: 'staff-a@example.com', email_verified: true,
    }).firestore();
    await assertFails(getDoc(doc(staffDb, 'shopInvites', 'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE')));
  });

  it('prevents staff from changing their own role or deleting their membership', async () => {
    await seedLicense('shop-a');
    await seedInvite('shop-a', '0123456789ABCDEF0123456789ABCDEF');
    const db = await claimInvite('staff-a', 'staff-a@example.com', 'shop-a',
      '0123456789ABCDEF0123456789ABCDEF');
    await assertFails(setDoc(doc(db, 'shopMembers', 'staff-a'), {
      shopId: 'shop-a', role: 'manager', status: 'active',
      email: 'staff-a@example.com', createdAt: serverTimestamp(),
      createdBy: 'shop-a', inviteCode: '0123456789ABCDEF0123456789ABCDEF',
      slotId: 'shop-a_1', canPrint: true,
    }));
    await assertFails(deleteDoc(doc(db, 'shopMembers', 'staff-a')));
  });

  it('denies a second claim using an already claimed invite', async () => {
    await seedLicense('shop-a');
    await seedInvite('shop-a', '0123456789ABCDEF0123456789ABCDEF');
    await claimInvite('staff-a', 'staff-a@example.com', 'shop-a',
      '0123456789ABCDEF0123456789ABCDEF');
    await assertFails(claimInvite('staff-b', 'staff-b@example.com', 'shop-a',
      '0123456789ABCDEF0123456789ABCDEF', 2));
  });

  it('denies staff invite claims when the shop license is expired', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'licenses', 'shop-a'), {
        uid: 'shop-a', status: 'active',
        expiresAt: Timestamp.fromMillis(Date.now() - 60_000), plan: '30-days',
      });
      await setDoc(doc(context.firestore(), 'shopInvites', '0123456789ABCDEF0123456789ABCDEF'), {
        shopId: 'shop-a', role: 'cashier', status: 'open',
        createdAt: Timestamp.now(), expiresAt: futureTimestamp(), createdBy: 'shop-a',
      });
    });
    await assertFails(claimInvite('staff-a', 'staff-a@example.com', 'shop-a',
      '0123456789ABCDEF0123456789ABCDEF'));
  });

  it('enforces the three staff slot maximum', async () => {
    await seedLicense('shop-a');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      for (let n = 1; n <= 3; n++) {
        await setDoc(doc(db, 'shopStaffSlots', 'shop-a_' + n), {
          shopId: 'shop-a', uid: 'existing-' + n, slot: n,
          inviteCode: 'seed' + n, createdAt: Timestamp.now(),
        });
      }
    });
    const ownerDb = testEnv.authenticatedContext('shop-a', {
      email: 'shop-a@example.com', email_verified: true,
    }).firestore();
    await assertFails(setDoc(doc(ownerDb, 'shopInvites', 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'), {
      shopId: 'shop-a', role: 'cashier', status: 'open',
      createdAt: serverTimestamp(), expiresAt: futureTimestamp(1), createdBy: 'shop-a',
    }));
  });

  it('denies unverified email and cross-tenant staff membership access', async () => {
    await seedLicense('shop-a');
    await seedLicense('shop-b');
    await seedInvite('shop-a', '0123456789ABCDEF0123456789ABCDEF');
    const unverified = testEnv.authenticatedContext('staff-a', {
      email: 'staff-a@example.com', email_verified: false,
    }).firestore();
    await assertFails(setDoc(doc(unverified, 'shopMembers', 'staff-a'), {
      shopId: 'shop-a', role: 'cashier', status: 'active',
      email: 'staff-a@example.com', createdAt: Timestamp.now(),
      createdBy: 'shop-a', inviteCode: '0123456789ABCDEF0123456789ABCDEF',
      slotId: 'shop-a_1', canPrint: false,
    }));
    const db = await claimInvite('staff-a', 'staff-a@example.com', 'shop-a',
      '0123456789ABCDEF0123456789ABCDEF');
    await assertFails(getDoc(doc(db, 'shopMembers', 'staff-b')));
    await assertFails(getDoc(doc(db, 'shops', 'shop-b', 'workspace', 'current')));
  });

  async function seedMember(uid, shopId, role, canPrint = false) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'shopMembers', uid), {
        shopId, role, status: 'active', email: uid + '@example.com',
        createdAt: Timestamp.now(), createdBy: shopId,
        inviteCode: 'ABCDEF0123456789ABCDEF0123456789',
        slotId: shopId + '_1', canPrint,
      });
    });
  }

  it('enforces cashier permissions on tenant-scoped POS collections', async () => {
    await seedLicense('shop-a');
    await seedMember('cashier-a', 'shop-a', 'cashier');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'shops', 'shop-a', 'pos', 'products', 'records', 'p1'), {
        name: 'Hammer', retail: 5000,
      });
    });
    const db = testEnv.authenticatedContext('cashier-a', {
      email: 'cashier-a@example.com', email_verified: true,
    }).firestore();
    await assertSucceeds(getDoc(doc(db, 'shops', 'shop-a', 'pos', 'products', 'records', 'p1')));
    await assertFails(setDoc(doc(db, 'shops', 'shop-a', 'pos', 'products', 'records', 'p1'), { name: 'Hammer' }));
    await assertSucceeds(setDoc(doc(db, 'shops', 'shop-a', 'pos', 'sales', 'records', 's1'), { total: 1000 }));
    await assertFails(setDoc(doc(db, 'shops', 'shop-a', 'pos', 'expenses', 'records', 'e1'), { amount: 500 }));
    await assertFails(setDoc(doc(db, 'shops', 'shop-a', 'pos', 'settings', 'records', 'main'), { currency: 'MMK' }));
  });

  it('keeps product and sale costs in manager-only collections while allowing cashier list queries', async () => {
    await seedLicense('shop-a');
    await seedMember('cashier-a', 'shop-a', 'cashier');
    await seedMember('manager-a', 'shop-a', 'manager');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'shops', 'shop-a', 'pos', 'products', 'records', 'p1'), {
        name: 'Drill', retail: 20000, stock: 5,
      });
      await setDoc(doc(adminDb, 'shops', 'shop-a', 'pos', 'productCosts', 'records', 'p1'), {
        productId: 'p1', cost: 15000,
      });
      await setDoc(doc(adminDb, 'shops', 'shop-a', 'pos', 'sales', 'records', 's1'), { total: 20000 });
      await setDoc(doc(adminDb, 'shops', 'shop-a', 'pos', 'saleCosts', 'records', 's1'), {
        cost: 15000, profit: 5000,
      });
    });
    const cashier = testEnv.authenticatedContext('cashier-a', {
      email: 'cashier-a@example.com', email_verified: true,
    }).firestore();
    const manager = testEnv.authenticatedContext('manager-a', {
      email: 'manager-a@example.com', email_verified: true,
    }).firestore();
    await assertSucceeds(getDoc(doc(cashier, 'shops', 'shop-a', 'pos', 'products', 'records', 'p1')));
    await assertSucceeds(getDocs(collection(cashier, 'shops', 'shop-a', 'pos', 'products', 'records')));
    await assertSucceeds(getDoc(doc(cashier, 'shops', 'shop-a', 'pos', 'sales', 'records', 's1')));
    await assertFails(getDoc(doc(cashier, 'shops', 'shop-a', 'pos', 'productCosts', 'records', 'p1')));
    await assertFails(getDoc(doc(cashier, 'shops', 'shop-a', 'pos', 'saleCosts', 'records', 's1')));
    await assertSucceeds(getDoc(doc(manager, 'shops', 'shop-a', 'pos', 'productCosts', 'records', 'p1')));
    await assertFails(setDoc(doc(manager, 'shops', 'shop-a', 'pos', 'products', 'records', 'p2'), {
      name: 'Saw', cost: 10000, retail: 14000,
    }));
  });

  it('allows manager inventory and expense writes but denies cross-tenant access', async () => {
    await seedLicense('shop-a');
    await seedLicense('shop-b');
    await seedMember('manager-a', 'shop-a', 'manager');
    const db = testEnv.authenticatedContext('manager-a', {
      email: 'manager-a@example.com', email_verified: true,
    }).firestore();
    await assertSucceeds(setDoc(doc(db, 'shops', 'shop-a', 'pos', 'products', 'records', 'p1'), { name: 'Hammer' }));
    await assertSucceeds(setDoc(doc(db, 'shops', 'shop-a', 'pos', 'expenses', 'records', 'e1'), { amount: 500 }));
    await assertFails(getDoc(doc(db, 'shops', 'shop-b', 'pos', 'products', 'records', 'p1')));
    await assertFails(setDoc(doc(db, 'shops', 'shop-a', 'pos', 'settings', 'records', 'main'), { currency: 'MMK' }));
  });

  it('denies POS collection access to staff after shop license expiry', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'licenses', 'shop-a'), {
        uid: 'shop-a', status: 'active',
        expiresAt: Timestamp.fromMillis(Date.now() - 60_000), plan: '30-days',
      });
      await setDoc(doc(context.firestore(), 'shopMembers', 'cashier-a'), {
        shopId: 'shop-a', role: 'cashier', status: 'active',
        email: 'cashier-a@example.com', createdAt: Timestamp.now(),
        createdBy: 'shop-a', inviteCode: 'ABCDEF0123456789ABCDEF0123456789',
        slotId: 'shop-a_1', canPrint: false,
      });
    });
    const db = testEnv.authenticatedContext('cashier-a', {
      email: 'cashier-a@example.com', email_verified: true,
    }).firestore();
    await assertFails(getDoc(doc(db, 'shops', 'shop-a', 'pos', 'products', 'records', 'p1')));
    await assertFails(setDoc(doc(db, 'shops', 'shop-a', 'pos', 'sales', 'records', 's1'), { total: 1000 }));
  });

  it('allows shop owner to revoke a staff member and release their slot', async () => {
    await seedLicense('shop-a');
    await seedInvite('shop-a', '0123456789ABCDEF0123456789ABCDEF');
    await claimInvite('staff-a', 'staff-a@example.com', 'shop-a',
      '0123456789ABCDEF0123456789ABCDEF');
    const ownerDb = testEnv.authenticatedContext('shop-a', {
      email: 'shop-a@example.com', email_verified: true,
    }).firestore();
    await assertSucceeds(deleteDoc(doc(ownerDb, 'shopMembers', 'staff-a')));
    await assertSucceeds(deleteDoc(doc(ownerDb, 'shopStaffSlots', 'shop-a_1')));
  });

  it('allows Merchant Code staff claims to read their shop license and cashier stock-only updates', async () => {
    await seedLicense('shop-a');
    await seedLicense('shop-b');
    await seedMember('merchant-cashier', 'shop-a', 'cashier');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'shops', 'shop-a', 'pos', 'products', 'records', 'p1'), {
        name: 'Hammer', stock: 8, retail: 5000,
      });
    });
    const db = testEnv.authenticatedContext('merchant-cashier', {
      email: 'staff.abc@akstaff.app', email_verified: true,
    }).firestore();
    await assertSucceeds(getDoc(doc(db, 'licenses', 'shop-a')));
    await assertFails(getDoc(doc(db, 'licenses', 'shop-b')));
    await assertSucceeds(setDoc(doc(db, 'shops', 'shop-a', 'pos', 'products', 'records', 'p1'), {
      stock: 7,
    }, { merge: true }));
    await assertFails(setDoc(doc(db, 'shops', 'shop-a', 'pos', 'products', 'records', 'p1'), {
      retail: 4000,
    }, { merge: true }));
  });

  it('supports Worker-created Merchant Code staff and owner slot probes without Firebase Functions', async () => {
    await seedLicense('shop-a');
    const ownerDb = testEnv.authenticatedContext('shop-a', {
      email: 'shop-a@example.com', email_verified: true,
    }).firestore();
    const emptySlot = await assertSucceeds(getDoc(doc(ownerDb, 'shopStaffSlots', 'shop-a_1')));
    assert.equal(emptySlot.exists(), false);
    const createdAt = Timestamp.now();
    const batch = writeBatch(ownerDb);
    batch.set(doc(ownerDb, 'shopMembers', 'staff-uid-001'), {
      shopId: 'shop-a', role: 'cashier', status: 'active',
      email: 'staff.0123456789ab@akstaff.app', createdAt,
      createdBy: 'shop-a', merchantStaff: true, name: 'Cashier One',
      merchantCodeHash: 'a'.repeat(64), slotId: 'shop-a_1', canPrint: false,
    });
    batch.set(doc(ownerDb, 'shopStaffSlots', 'shop-a_1'), {
      shopId: 'shop-a', uid: 'staff-uid-001', slot: 1,
      createdAt, merchantStaff: true,
    });
    await assertSucceeds(batch.commit());
    const staffDb = testEnv.authenticatedContext('staff-uid-001', {
      email: 'staff.0123456789ab@akstaff.app', email_verified: true,
    }).firestore();
    const member = await assertSucceeds(getDoc(doc(staffDb, 'shopMembers', 'staff-uid-001')));
    assert.equal(member.data().shopId, 'shop-a');
    assert.equal(member.data().merchantStaff, true);
    const revoke = writeBatch(ownerDb);
    revoke.update(doc(ownerDb, 'shopMembers', 'staff-uid-001'), {
      status: 'suspended', revokedAt: Timestamp.now(),
    });
    revoke.delete(doc(ownerDb, 'shopStaffSlots', 'shop-a_1'));
    await assertSucceeds(revoke.commit());
    await assertFails(getDoc(doc(staffDb, 'shopMembers', 'staff-uid-001')));
  });


});
