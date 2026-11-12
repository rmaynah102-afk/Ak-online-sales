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
  Timestamp,
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

  it('allows a staff member to read their own membership, but not another member record', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'shopMembers', 'staff-a'), {
        shopId: 'shop-a',
        role: 'cashier',
      });
      await setDoc(doc(context.firestore(), 'shopMembers', 'staff-b'), {
        shopId: 'shop-b',
        role: 'cashier',
      });
    });

    const db = testEnv.authenticatedContext('staff-a', {
      email: 'staff-a@example.com',
      email_verified: true,
    }).firestore();
    await assertSucceeds(getDoc(doc(db, 'shopMembers', 'staff-a')));
    await assertFails(getDoc(doc(db, 'shopMembers', 'staff-b')));
  });
});
