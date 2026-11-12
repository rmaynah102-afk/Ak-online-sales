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

  it('allows only the verified Platform Owner to issue a customer license', async () => {
    const db = testEnv.authenticatedContext('platform-owner-uid', {
      email: 'painglin102@gmail.com',
      email_verified: true,
    }).firestore();
    await assertSucceeds(setDoc(doc(db, 'licenses', 'shop-a'), {
      uid: 'shop-a',
      status: 'active',
      expiresAt: futureTimestamp(30),
      plan: '30-days',
    }));
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

  it('keeps product and sale cost fields out of cashier-readable documents', async () => {
    await seedLicense('shop-a');
    await seedMember('cashier-a', 'shop-a', 'cashier');
    await seedMember('manager-a', 'shop-a', 'manager');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'shops', 'shop-a', 'pos', 'products', 'records', 'secret-product'), {
        name: 'Drill', cost: 15000, retail: 20000,
      });
      await setDoc(doc(context.firestore(), 'shops', 'shop-a', 'pos', 'productCosts', 'records', 'p1'), {
        productId: 'secret-product', cost: 15000,
      });
    });
    const cashier = testEnv.authenticatedContext('cashier-a', {
      email: 'cashier-a@example.com', email_verified: true,
    }).firestore();
    const manager = testEnv.authenticatedContext('manager-a', {
      email: 'manager-a@example.com', email_verified: true,
    }).firestore();
    await assertFails(getDoc(doc(cashier, 'shops', 'shop-a', 'pos', 'products', 'records', 'secret-product')));
    await assertFails(getDoc(doc(cashier, 'shops', 'shop-a', 'pos', 'productCosts', 'records', 'p1')));
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
});
