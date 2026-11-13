const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
// Sole platform owner; fixed allowlist, never client-configurable.
const OWNER_EMAIL = "painglin102@gmail.com";

admin.initializeApp();
const db = admin.firestore();

exports.startTrial = functions.auth.user().onCreate(async (user) => {
  const ref = db.collection("licenses").doc(user.uid);
  const snap = await ref.get();
  if (snap.exists) return null;

  // New accounts stay locked until the owner verifies payment and approves.
  await ref.create({
    uid: user.uid,
    email: user.email || "",
    status: "pending_payment",
    plan: "awaiting-owner-approval",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return null;
});


async function enforceCustomerShopCapacity(tx, uid, currentLicenseSnap) {
  // A shared lock document serializes every new activation/renewal across shops.
  // The active license query is re-counted inside the same transaction so expired
  // and suspended shops release capacity automatically.
  const capacityRef = db.collection("platformControls").doc("shopCapacity");
  const activeQuery = db.collection("licenses").where("status", "==", "active");
  const [capacitySnap, activeSnap] = await Promise.all([
    tx.get(capacityRef),
    tx.get(activeQuery)
  ]);
  const now = Date.now();
  const activeOwners = activeSnap.docs.filter(doc => {
    const item = doc.data() || {};
    const email = String(item.email || "").trim().toLowerCase();
    const expiry = item.expiresAt && typeof item.expiresAt.toMillis === "function"
      ? item.expiresAt.toMillis() : 0;
    return email !== OWNER_EMAIL && expiry > now;
  });
  const targetAlreadyActive = activeOwners.some(doc => doc.id === uid);
  if (!targetAlreadyActive && activeOwners.length >= 30) {
    throw new functions.https.HttpsError("resource-exhausted",
      "Platform Owner က ခွင့်ပြုထားသော ဆိုင် ၃၀ ဆိုင် ပြည့်နေပါပြီ။ ဆိုင်ဟောင်းတစ်ဆိုင်ကို Suspend လုပ်ခြင်း သို့မဟုတ် သက်တမ်းကုန်ပြီးမှ အသစ်ဖွင့်နိုင်ပါမည်။");
  }
  tx.set(capacityRef, {
    activeCount: activeOwners.length + (targetAlreadyActive ? 0 : 1),
    limit: 30,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastActivatedUid: uid
  }, { merge: true });
}

function requireAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login လိုအပ်သည်။");
  }
  const callerEmail = String(context.auth.token.email || "").trim().toLowerCase();
  const emailVerified = context.auth.token.email_verified === true;
  if (callerEmail !== OWNER_EMAIL || !emailVerified) {
    throw new functions.https.HttpsError("permission-denied", "Admin ခွင့်ပြုချက်မရှိပါ။");
  }
  return callerEmail;
}

async function requireActiveShop(context) {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login လိုအပ်သည်။");
  const uid = context.auth.uid;
  const email = String(context.auth.token.email || "").trim().toLowerCase();
  // The sole verified Platform Owner may administer their own shop without a paid license.
  if (email === OWNER_EMAIL && context.auth.token.email_verified === true) return uid;
  const snap = await db.collection("licenses").doc(uid).get();
  const license = snap.data() || {};
  if (!snap.exists || license.status !== "active" || !license.expiresAt ||
      license.expiresAt.toMillis() <= Date.now()) {
    throw new functions.https.HttpsError("permission-denied", "ငွေပေးချေမှုအတည်ပြုထားသော Subscription လိုအပ်သည်။");
  }
  return uid;
}

exports.claimShopDevice = functions.https.onCall(async (data, context) => {
  const uid = await requireActiveShop(context);
  const deviceId = String(data.deviceId || "").trim();
  const label = String(data.label || "Device").slice(0, 110);
  if (!/^akd_[a-zA-Z0-9_-]{8,100}$/.test(deviceId)) {
    throw new functions.https.HttpsError("invalid-argument", "Device ID မမှန်ပါ။");
  }
  const devices = db.collection("users").doc(uid).collection("devices");
  const ref = devices.doc(deviceId);
  return db.runTransaction(async tx => {
    const [ownSnap, allSnap] = await Promise.all([tx.get(ref), tx.get(devices)]);
    if (!ownSnap.exists && allSnap.size >= 5) {
      throw new functions.https.HttpsError("resource-exhausted", "ဖုန်း ၅ လုံး ပြည့်နေပါသည်။ Owner က စက်ဟောင်းကို အရင်ဖြုတ်ပါ။");
    }
    tx.set(ref, {
      deviceId, label, createdAt: ownSnap.exists ? ownSnap.data().createdAt : admin.firestore.FieldValue.serverTimestamp(),
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { ok: true, count: ownSnap.exists ? allSnap.size : allSnap.size + 1, limit: 5 };
  });
});

exports.listShopDevices = functions.https.onCall(async (data, context) => {
  const uid = await requireActiveShop(context);
  const snap = await db.collection("users").doc(uid).collection("devices").orderBy("lastSeenAt", "desc").limit(5).get();
  return { devices: snap.docs.map(doc => {
    const x = doc.data();
    return { deviceId: doc.id, label: x.label || "Device",
      lastSeen: x.lastSeenAt && x.lastSeenAt.toDate ? x.lastSeenAt.toDate().toISOString() : "" };
  }) };
});

exports.revokeShopDevice = functions.https.onCall(async (data, context) => {
  const uid = await requireActiveShop(context);
  const deviceId = String(data.deviceId || "").trim();
  if (!/^akd_[a-zA-Z0-9_-]{8,100}$/.test(deviceId)) {
    throw new functions.https.HttpsError("invalid-argument", "Device ID မမှန်ပါ။");
  }
  await db.collection("users").doc(uid).collection("devices").doc(deviceId).delete();
  return { ok: true };
});


// Automatically publish only the shop's public-facing profile from its private app data.
// Sales, stock, cost, customers, debts, and address are never copied to the public directory.
exports.syncPublicShopProfile = functions.https.onCall(async (data, context) => {
  const uid = await requireActiveShop(context);
  const appSnap = await db.collection("users").doc(uid).collection("private").doc("appData").get();
  if (!appSnap.exists || !appSnap.data().data) {
    throw new functions.https.HttpsError("failed-precondition", "ဆိုင်ဒေတာ မတွေ့ပါ။");
  }
  const shop = appSnap.data().data.shop || {};
  const shopName = String(shop.name || "").trim().slice(0, 90);
  if (shopName.length < 2) {
    throw new functions.https.HttpsError("failed-precondition", "ဆိုင်အမည်ကို အရင်သတ်မှတ်ပါ။");
  }
  const city = String(shop.city || "").trim().slice(0, 80);
  const township = String(shop.township || "").trim().slice(0, 80);
  const logo = String(shop.logo || "").trim();
  const safeLogo = /^https:\/\//i.test(logo) ? logo.slice(0, 1000) : "";
  await db.collection("publicShops").doc(uid).set({
    ownerUid: uid, shopName, category: "အထွေထွေ",
    city, township, logo: safeLogo,
    about: "AK Sale Software အသုံးပြုသော ဆိုင်",
    status: "approved", autoListed: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true, shopName };
});

exports.listPendingShopProfiles = functions.https.onCall(async (data, context) => {
  requireAdmin(context);
  const snap = await db.collection("publicShopSubmissions").where("status","==","pending").limit(100).get();
  return { shops: snap.docs.map(doc => { const x=doc.data(); return {
    ownerUid:doc.id, shopName:x.shopName||"", category:x.category||"အခြား",
    city:x.city||"", township:x.township||"", phone:x.phone||"", link:x.link||"", about:x.about||""
  }; }) };
});

exports.reviewShopProfile = functions.https.onCall(async (data, context) => {
  const reviewer = requireAdmin(context);
  const ownerUid = String(data.ownerUid||"").trim();
  const decision = String(data.decision||"");
  if (!ownerUid || ownerUid.length > 128 || !["approved","rejected"].includes(decision)) {
    throw new functions.https.HttpsError("invalid-argument","ဆိုင်အချက်အလက် မမှန်ပါ။");
  }
  const submissionRef = db.collection("publicShopSubmissions").doc(ownerUid);
  const publicRef = db.collection("publicShops").doc(ownerUid);
  await db.runTransaction(async tx => {
    const snap = await tx.get(submissionRef);
    if (!snap.exists || snap.data().status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition","Pending ဆိုင်စာရင်း မတွေ့ပါ။");
    }
    const x=snap.data();
    tx.update(submissionRef,{status:decision,reviewedBy:reviewer,reviewedAt:admin.firestore.FieldValue.serverTimestamp()});
    if (decision === "approved") tx.set(publicRef,{
      ownerUid, shopName:x.shopName, category:x.category||"အခြား", city:x.city||"",
      township:x.township||"", phone:x.phone||"", link:x.link||"", about:x.about||"",
      status:"approved", updatedAt:admin.firestore.FieldValue.serverTimestamp()
    });
    else tx.delete(publicRef);
  });
  return {ok:true,status:decision};
});

exports.listPendingAds = functions.https.onCall(async (data, context) => {
  requireAdmin(context);
  const snap = await db.collection("sponsoredAds").where("status", "==", "pending").limit(100).get();
  return { ads: snap.docs.map(doc => { const x=doc.data(); return {
    id:doc.id, ownerUid:x.ownerUid||"", email:x.email||"", shopName:x.shopName||"",
    title:x.title||"", text:x.text||"", url:x.url||""
  }; }) };
});

exports.reviewSponsoredAd = functions.https.onCall(async (data, context) => {
  const reviewer = requireAdmin(context);
  const adId = String(data.adId || "").trim();
  const decision = String(data.decision || "");
  if (!adId || adId.length > 150 || !["approved","rejected"].includes(decision)) {
    throw new functions.https.HttpsError("invalid-argument", "ကြော်ငြာအချက်အလက် မမှန်ပါ။");
  }
  const ref = db.collection("sponsoredAds").doc(adId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "Pending ကြော်ငြာ မတွေ့ပါ။");
    }
    tx.update(ref, { status:decision, reviewedBy:reviewer,
      reviewedAt:admin.firestore.FieldValue.serverTimestamp() });
  });
  return { ok:true, status:decision };
});

// Fixed single KBZPay receiving account. Destination changes require a code review.
function normalizePaymentReference(value) {
  return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
}

// Platform owner confirmed this KBZPay receiving account.
const AK_KPAY_ACCOUNT = Object.freeze({
  enabled: true,
  method: "KBZPay",
  bankName: "KBZPay",
  accountName: "NiNiWin",
  accountNumber: "09774033661",
  instructions: "KBZPay သို့ ငွေလွှဲပြီး Transaction ID ကို ထည့်ပါ။ Owner က KBZPay ထဲတွင် ငွေဝင်မှုကို စစ်ဆေးပြီးမှ အတည်ပြုမည်။ Screenshot တစ်ခုတည်းဖြင့် အတည်မပြုပါ။"
});

exports.createPaymentRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login လိုအပ်သည်။");
  const uid = context.auth.uid;
  const email = String(context.auth.token.email || "").trim().toLowerCase();
  const days = Number(data.days);
  const amount = Number(data.amount);
  const method = String(data.method || "");
  const reference = String(data.reference || "").trim();
  const normalizedReference = normalizePaymentReference(reference);
  const screenshotUrl = String(data.screenshotUrl || "");
  const expectedAmounts = { 30: 30000, 90: 90000, 180: 180000, 365: 360000 };
  if (!Object.prototype.hasOwnProperty.call(expectedAmounts, days) ||
      amount !== expectedAmounts[days] || method !== "KBZPay" ||
      normalizedReference.length < 3 || normalizedReference.length > 100 ||
      !screenshotUrl || screenshotUrl.length > 2000) {
    throw new functions.https.HttpsError("invalid-argument", "Payment request အချက်အလက် မမှန်ပါ။");
  }
  if (!screenshotUrl.startsWith("https://firebasestorage.googleapis.com/") ||
      !screenshotUrl.includes(encodeURIComponent("paymentProofs/" + uid + "/"))) {
    throw new functions.https.HttpsError("invalid-argument", "Payment screenshot path မမှန်ပါ။");
  }
  const referenceKey = crypto.createHash("sha256")
    .update("KBZPay:" + normalizedReference)
    .digest("hex");
  const referenceRef = db.collection("paymentReferences").doc(referenceKey);
  const requestRef = db.collection("paymentRequests").doc();
  const settings = AK_KPAY_ACCOUNT;
  if (!settings.enabled || settings.method !== method) {
    throw new functions.https.HttpsError("failed-precondition", "KBZPay လက်ခံမှုကို ယာယီပိတ်ထားသည်။");
  }
  await db.runTransaction(async tx => {
    const referenceSnap = await tx.get(referenceRef);
    if (referenceSnap.exists) {
      throw new functions.https.HttpsError("already-exists", "ဤ KBZPay Transaction ID ကို ယခင်က တင်ပြပြီးဖြစ်သည်။");
    }
    tx.create(referenceRef, {
      referenceHash: referenceKey, paymentRequestId: requestRef.id, uid,
      method: "KBZPay", amount, days, status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    tx.create(requestRef, {
      uid, email, days, amount, method, bankName: settings.bankName,
      reference, screenshotUrl, status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  return { ok: true, requestId: requestRef.id };
});

exports.getPaymentAccountSettings = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login လိုအပ်သည်။");
  return AK_KPAY_ACCOUNT;
});

// Only the verified platform Owner may request settings refresh.
// Client-supplied destination details are deliberately ignored.
exports.setPaymentAccountSettings = functions.https.onCall(async (data, context) => {
  requireAdmin(context);
  return { ok: true, ...AK_KPAY_ACCOUNT };
});
exports.listPendingPayments = functions.https.onCall(async (data, context) => {
  requireAdmin(context);
  const snap = await db.collection("paymentRequests")
    .where("status", "==", "pending")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  return {
    requests: snap.docs.map(doc => {
      const x = doc.data();
      return {
        id: doc.id,
        uid: x.uid || "",
        email: x.email || "",
        days: Number(x.days || 0),
        reference: String(x.reference || ""),
        method: String(x.method || ""),
        amount: Number(x.amount || 0),
        screenshotUrl: String(x.screenshotUrl || ""),
        bankName: String(x.bankName || ""),
        status: String(x.status || ""),
        createdAt: x.createdAt && x.createdAt.toDate
          ? x.createdAt.toDate().toISOString()
          : ""
      };
    })
  };
});



// Owner-only customer account controls. Every Gmail other than the fixed verified
// platform owner is a customer; client role labels never grant platform privileges.
exports.listPlatformUsers = functions.https.onCall(async (data, context) => {
  requireAdmin(context);
  const pageToken = String(data.pageToken || "").trim() || undefined;
  const page = await admin.auth().listUsers(100, pageToken);
  const refs = page.users.map(u => db.collection("licenses").doc(u.uid));
  const licenseSnaps = refs.length ? await db.getAll(...refs) : [];
  const byUid = new Map(licenseSnaps.map(s => [s.id, s.exists ? s.data() : {}]));
  return {
    users: page.users.map(u => {
      const license = byUid.get(u.uid) || {};
      return {
        uid: u.uid, email: u.email || "", emailVerified: !!u.emailVerified,
        disabled: !!u.disabled, status: String(license.status || "pending_payment"),
        plan: String(license.plan || ""), expiresAt: license.expiresAt && license.expiresAt.toDate
          ? license.expiresAt.toDate().toISOString() : ""
      };
    }).filter(u => u.email.toLowerCase() !== OWNER_EMAIL),
    nextPageToken: page.pageToken || ""
  };
});

// A customer asks for access after registering. Payment is handled outside the app;
// this callable only records the request and never grants POS access.
exports.requestSubscriptionAccess = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.email_verified !== true) {
    throw new functions.https.HttpsError("unauthenticated", "Gmail ဖြင့် Login ဝင်ပြီး Email အတည်ပြုပါ။");
  }
  const uid = context.auth.uid;
  const email = String(context.auth.token.email || "").trim().toLowerCase();
  if (!email || email === OWNER_EMAIL) {
    throw new functions.https.HttpsError("permission-denied", "ဤအကောင့်အတွက် Customer Access Request မလိုအပ်ပါ။");
  }
  const ref = db.collection("licenses").doc(uid);
  const snap = await ref.get();
  const license = snap.data() || {};
  if (license.status === "suspended") {
    throw new functions.https.HttpsError("permission-denied", "ဤအကောင့်ကို Owner က ရပ်ဆိုင်းထားသည်။ Owner ထံ ဆက်သွယ်ပါ။");
  }
  if (license.status === "active" && license.expiresAt &&
      typeof license.expiresAt.toMillis === "function" && license.expiresAt.toMillis() > Date.now()) {
    return { ok: true, status: "active", message: "အသုံးပြုခွင့် ရှိပြီးဖြစ်သည်။" };
  }
  await ref.set({
    uid, email, status: "pending_payment", plan: "awaiting-owner-approval",
    accessRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  await db.collection("platformAuditLogs").add({
    action: "subscription_access_requested", targetUid: uid, targetEmail: email,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true, status: "pending_payment", message: "Owner အတည်ပြုရန် တောင်းဆိုချက် ပို့ပြီးပါပြီ။" };
});

// Manual subscription activation: the Platform Owner verifies external payment
// independently, then grants a fixed duration from the Owner Dashboard.
exports.grantSubscription = functions.https.onCall(async (data, context) => {
  const actor = requireAdmin(context);
  const uid = String(data.uid || "").trim();
  const days = Number(data.days);
  if (!uid || uid.length > 128 || ![30, 90, 180, 365].includes(days)) {
    throw new functions.https.HttpsError("invalid-argument", "Customer အကောင့် သို့မဟုတ် သက်တမ်းကာလ မမှန်ပါ။");
  }
  if (uid === context.auth.uid) {
    throw new functions.https.HttpsError("permission-denied", "Platform Owner ကို Customer License မပေးနိုင်ပါ။");
  }
  const user = await admin.auth().getUser(uid);
  const email = String(user.email || "").trim().toLowerCase();
  if (!email || email === OWNER_EMAIL || !user.emailVerified || user.disabled) {
    throw new functions.https.HttpsError("failed-precondition", "Customer Gmail အတည်ပြုထားပြီး အကောင့်ဖွင့်ထားရန် လိုအပ်သည်။");
  }
  const ref = db.collection("licenses").doc(uid);
  const result = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const old = snap.data() || {};
    await enforceCustomerShopCapacity(tx, uid, snap);
    const oldExpiry = old.expiresAt && typeof old.expiresAt.toMillis === "function"
      ? old.expiresAt.toMillis() : 0;
    const expiresAt = admin.firestore.Timestamp.fromMillis(Math.max(Date.now(), oldExpiry) + days * 86400000);
    tx.set(ref, {
      uid, email, status: "active", plan: days + "-days",
      expiresAt, grantedBy: actor, grantedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return expiresAt;
  });
  await db.collection("platformAuditLogs").add({
    action: "subscription_manually_granted", targetUid: uid, targetEmail: email,
    days, expiresAt: result, actor,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true, uid, email, days, expiresAt: result.toDate().toISOString() };
});

exports.setPlatformUserAccess = functions.https.onCall(async (data, context) => {
  const actor = requireAdmin(context);
  const uid = String(data.uid || "").trim();
  const action = String(data.action || "").trim();
  if (!uid || uid.length > 128 || !["suspend", "reactivate"].includes(action)) {
    throw new functions.https.HttpsError("invalid-argument", "အသုံးပြုသူ သို့မဟုတ် လုပ်ဆောင်ချက် မမှန်ပါ။");
  }
  if (uid === context.auth.uid) {
    throw new functions.https.HttpsError("permission-denied", "Owner အကောင့်ကို ဒီနေရာမှ ပိတ်၍မရပါ။");
  }
  const target = await admin.auth().getUser(uid);
  if (String(target.email || "").trim().toLowerCase() === OWNER_EMAIL ||
      target.customClaims?.platformAdmin === true) {
    throw new functions.https.HttpsError("permission-denied", "ဤအကောင့်ကို Customer အဖြစ် မစီမံနိုင်ပါ။");
  }
  const licenseRef = db.collection("licenses").doc(uid);
  await db.runTransaction(async tx => {
    const snap = await tx.get(licenseRef);
    if (action === "suspend") {
      tx.set(licenseRef, {
        uid, email: target.email || "", status: "suspended",
        suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
        suspendedBy: actor, updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } else {
      const license = snap.data() || {};
      const expiry = license.expiresAt;
      if (!snap.exists || !expiry || typeof expiry.toMillis !== "function" || expiry.toMillis() <= Date.now()) {
        throw new functions.https.HttpsError("failed-precondition", "Subscription သက်တမ်းကုန်နေသည်။ သက်တမ်းတိုးပြီးမှ ပြန်ဖွင့်ပါ။");
      }
      await enforceCustomerShopCapacity(tx, uid, snap);
      tx.update(licenseRef, {
        status: "active", reactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
        reactivatedBy: actor, updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });
  await db.collection("platformAuditLogs").add({
    action: action === "suspend" ? "customer_suspended" : "customer_reactivated",
    targetUid: uid, targetEmail: target.email || "", actor,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true, uid, action };
});

exports.rejectPaymentRequest = functions.https.onCall(async (data, context) => {
  const actor = requireAdmin(context);
  const requestId = String(data.requestId || "").trim();
  const reason = String(data.reason || "").trim().slice(0, 240);
  if (!requestId || requestId.length > 150) {
    throw new functions.https.HttpsError("invalid-argument", "Payment request ID မမှန်ပါ။");
  }
  const requestRef = db.collection("paymentRequests").doc(requestId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(requestRef);
    if (!snap.exists || snap.data().status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "Pending တောင်းဆိုချက် မတွေ့ပါ။");
    }
    const payment = snap.data();
    const referenceKey = crypto.createHash("sha256")
      .update("KBZPay:" + normalizePaymentReference(payment.reference))
      .digest("hex");
    const referenceRef = db.collection("paymentReferences").doc(referenceKey);
    const referenceSnap = await tx.get(referenceRef);
    tx.update(requestRef, {
      status: "rejected", rejectionReason: reason, reviewedBy: actor,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    if (referenceSnap.exists && referenceSnap.data().paymentRequestId === requestId &&
        referenceSnap.data().status === "pending") {
      tx.update(referenceRef, { status: "rejected", reviewedBy: actor,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  });
  await db.collection("platformAuditLogs").add({
    action: "payment_rejected", requestId, reason, actor,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true, status: "rejected" };
});

exports.approveSubscription = functions.https.onCall(async (data, context) => {
  const callerEmail = requireAdmin(context);
  const requestId = String(data.requestId || "").trim();
  if (!requestId || requestId.length > 150) {
    throw new functions.https.HttpsError("invalid-argument", "Payment request ID မမှန်ပါ။");
  }

  const requestRef = db.collection("paymentRequests").doc(requestId);
  const result = await db.runTransaction(async tx => {
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists) {
      throw new functions.https.HttpsError("not-found", "ငွေပေးချေမှုတောင်းဆိုချက် မတွေ့ပါ။");
    }
    const payment = requestSnap.data();
    const uid = String(payment.uid || "");
    const days = Number(payment.days);
    const reference = String(payment.reference || "").trim();
    const normalizedReference = normalizePaymentReference(reference);
    const expectedAmounts = { 30: 30000, 90: 90000, 180: 180000, 365: 360000 };
    if (payment.status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "ဤတောင်းဆိုချက်ကို ယခင်က စီမံပြီးပါပြီ။");
    }
    if (!uid || !Object.prototype.hasOwnProperty.call(expectedAmounts, days) || normalizedReference.length < 3 || Number(payment.amount) !== expectedAmounts[days] || String(payment.method || "") !== "KBZPay" || String(payment.bankName || "") !== "KBZPay") {
      throw new functions.https.HttpsError("failed-precondition", "Payment request data / package amount မမှန်ပါ။");
    }

    // A KBZPay transaction reference can only be used once, even if a user
    // submits multiple payment requests with the same reference.
    const referenceKey = crypto.createHash("sha256")
      .update("KBZPay:" + normalizedReference)
      .digest("hex");
    const referenceRef = db.collection("paymentReferences").doc(referenceKey);
    const referenceSnap = await tx.get(referenceRef);
    if (referenceSnap.exists &&
        (referenceSnap.data().paymentRequestId !== requestId || referenceSnap.data().status !== "pending")) {
      throw new functions.https.HttpsError("already-exists", "ဤ KBZPay Transaction ID ကို ယခင်က အသုံးပြုပြီးပါပြီ။");
    }

    const licenseRef = db.collection("licenses").doc(uid);
    const licenseSnap = await tx.get(licenseRef);
    await enforceCustomerShopCapacity(tx, uid, licenseSnap);
    const now = Date.now();
    const currentExpiry = licenseSnap.exists && licenseSnap.data().expiresAt
      ? licenseSnap.data().expiresAt.toMillis()
      : now;
    const nextExpiry = admin.firestore.Timestamp.fromMillis(
      Math.max(now, currentExpiry) + days * 86400000
    );
    if (referenceSnap.exists) {
      tx.update(referenceRef, {
        status: "approved", approvedBy: callerEmail,
        approvedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      tx.create(referenceRef, {
        referenceHash: referenceKey,
        paymentRequestId: requestId,
        uid,
        method: "KBZPay",
        amount: Number(payment.amount),
        days,
        status: "approved",
        approvedBy: callerEmail,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    tx.set(licenseRef, {
      uid,
      email: payment.email || "",
      status: "active",
      plan: days + "-days",
      expiresAt: nextExpiry,
      lastPaymentReference: reference,
      lastPaymentRequestId: requestId,
      lastApprovedBy: callerEmail,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    tx.update(requestRef, {
      status: "approved",
      approvedBy: callerEmail,
      approvedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { uid, expiresAt: nextExpiry };
  });

  return { uid: result.uid, expiresAt: result.expiresAt.toDate().toISOString() };
});

// Shop staff identity and role administration.
// Staff must already have registered with Firebase Authentication.
// This establishes trusted server-side roles; access to the monolithic appData
// document remains owner-only until the data model is split by permission.
const SHOP_STAFF_ROLES = ["manager", "cashier", "employee"];

exports.assignShopStaffRole = functions.https.onCall(async (data, context) => {
  const ownerUid = await requireActiveShop(context);
  const email = String(data.email || "").trim().toLowerCase();
  const role = String(data.role || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !SHOP_STAFF_ROLES.includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", "ဝန်ထမ်း Gmail သို့မဟုတ် ရာထူး မမှန်ပါ။");
  }
  if (email === OWNER_EMAIL) {
    throw new functions.https.HttpsError("permission-denied", "CEO အကောင့်ကို ဆိုင်ဝန်ထမ်းအဖြစ် မသတ်မှတ်နိုင်ပါ။");
  }
  let staff;
  try {
    staff = await admin.auth().getUserByEmail(email);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      throw new functions.https.HttpsError("not-found", "ဝန်ထမ်းသည် Gmail ဖြင့် အရင် Account ဖွင့်ထားရန် လိုအပ်သည်။");
    }
    throw err;
  }
  if (!staff.emailVerified) {
    throw new functions.https.HttpsError("failed-precondition", "ဝန်ထမ်းသည် Gmail ကို အရင် Email အတည်ပြုထားရန် လိုအပ်သည်။");
  }
  if (staff.uid === ownerUid || staff.customClaims?.platformAdmin === true) {
    throw new functions.https.HttpsError("permission-denied", "ဤအကောင့်ကို ဝန်ထမ်းအဖြစ် သတ်မှတ်ခွင့်မရှိပါ။");
  }
  const existingShop = staff.customClaims?.shopId;
  if (existingShop && existingShop !== ownerUid) {
    throw new functions.https.HttpsError("already-exists", "ဤ Gmail ကို အခြားဆိုင်တွင် ချိတ်ဆက်ထားပြီးဖြစ်သည်။");
  }
  // Each shop supports one owner plus up to three staff accounts.
  const memberRef = db.collection("shopMembers").doc(staff.uid);
  const membershipControlRef = db.collection("shops").doc(ownerUid).collection("controls").doc("staff");
  await db.runTransaction(async tx => {
    const membersQuery = db.collection("shopMembers").where("shopId", "==", ownerUid);
    const [controlSnap, membersSnap, memberSnap] = await Promise.all([
      tx.get(membershipControlRef), tx.get(membersQuery), tx.get(memberRef)
    ]);
    if (memberSnap.exists && memberSnap.data().shopId !== ownerUid) {
      throw new functions.https.HttpsError("already-exists", "ဤ Gmail ကို အခြားဆိုင်တွင် ချိတ်ဆက်ထားပြီးဖြစ်သည်။");
    }
    const alreadyMember = memberSnap.exists && memberSnap.data().shopId === ownerUid;
    if (!alreadyMember && membersSnap.size >= 3) {
      throw new functions.https.HttpsError("resource-exhausted", "ဆိုင်တစ်ဆိုင်လျှင် ဝန်ထမ်း ၃ ဦးအထိသာ ခွင့်ပြုထားသည်။");
    }
    tx.set(membershipControlRef, {
      staffCount: membersSnap.size,
      staffLimit: 3,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(memberRef, {
      uid: staff.uid, shopId: ownerUid, email, role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: ownerUid
    }, { merge: true });
  });
  const claims = { ...(staff.customClaims || {}), shopId: ownerUid, shopRole: role };
  await admin.auth().setCustomUserClaims(staff.uid, claims);
  await db.collection("users").doc(ownerUid).collection("auditLogs").add({
    action: "staff_role_assigned", targetUid: staff.uid, email, role,
    actorUid: ownerUid, createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true, uid: staff.uid, email, role };
});

// One-time merchant invite codes: owner creates a role-bound code, staff claims it
// after signing in with their own verified Gmail. Codes expire after 24 hours.
exports.createShopInviteCode = functions.https.onCall(async (data, context) => {
  const ownerUid = await requireActiveShop(context);
  const role = String(data.role || "").trim().toLowerCase();
  if (!SHOP_STAFF_ROLES.includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", "ဝန်ထမ်းရာထူး မမှန်ပါ။");
  }
  const members = await db.collection("shopMembers").where("shopId", "==", ownerUid).get();
  if (members.size >= 3) {
    throw new functions.https.HttpsError("resource-exhausted", "ဝန်ထမ်း ၃ ဦး ပြည့်နေပါပြီ။");
  }
  const code = crypto.randomBytes(5).toString("hex").toUpperCase();
  const hash = crypto.createHash("sha256").update(code).digest("hex");
  await db.collection("shopInviteCodes").doc(hash).create({
    shopId: ownerUid, role, status: "pending",
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
    createdBy: ownerUid, createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true, code, role, expiresInHours: 24 };
});

exports.claimShopInviteCode = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.email_verified !== true) {
    throw new functions.https.HttpsError("unauthenticated", "ကိုယ်ပိုင် Gmail ဖြင့် Login ဝင်ပြီး Email အတည်ပြုပါ။");
  }
  const code = String(data.code || "").trim().toUpperCase();
  if (!/^[A-F0-9]{10}$/.test(code)) {
    throw new functions.https.HttpsError("invalid-argument", "Merchant Code မမှန်ပါ။");
  }
  const uid = context.auth.uid;
  const email = String(context.auth.token.email || "").trim().toLowerCase();
  if (!email || email === OWNER_EMAIL) {
    throw new functions.https.HttpsError("permission-denied", "ဤ Gmail ကို ဝန်ထမ်းအဖြစ် မချိတ်နိုင်ပါ။");
  }
  const hash = crypto.createHash("sha256").update(code).digest("hex");
  const inviteRef = db.collection("shopInviteCodes").doc(hash);
  const outcome = await db.runTransaction(async tx => {
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists) throw new functions.https.HttpsError("not-found", "Merchant Code မတွေ့ပါ။");
    const invite = inviteSnap.data();
    if (invite.status !== "pending" || !invite.expiresAt || invite.expiresAt.toMillis() <= Date.now()) {
      throw new functions.https.HttpsError("failed-precondition", "Code သက်တမ်းကုန်နေသည် သို့မဟုတ် အသုံးပြုပြီးဖြစ်သည်။");
    }
    const user = await admin.auth().getUser(uid);
    if (user.customClaims?.platformAdmin === true || (user.customClaims?.shopId && user.customClaims.shopId !== invite.shopId)) {
      throw new functions.https.HttpsError("already-exists", "ဤ Gmail ကို အခြားဆိုင်တွင် ချိတ်ထားပြီးဖြစ်သည်။");
    }
    const membersQuery = db.collection("shopMembers").where("shopId", "==", invite.shopId);
    const memberRef = db.collection("shopMembers").doc(uid);
    const membershipControlRef = db.collection("shops").doc(invite.shopId).collection("controls").doc("staff");
    const [controlSnap, membersSnap, memberSnap] = await Promise.all([
      tx.get(membershipControlRef), tx.get(membersQuery), tx.get(memberRef)
    ]);
    if (memberSnap.exists && memberSnap.data().shopId !== invite.shopId) {
      throw new functions.https.HttpsError("already-exists", "ဤ Gmail ကို အခြားဆိုင်တွင် ချိတ်ထားပြီးဖြစ်သည်။");
    }
    const already = memberSnap.exists && memberSnap.data().shopId === invite.shopId;
    if (!already && membersSnap.size >= 3) {
      throw new functions.https.HttpsError("resource-exhausted", "ဝန်ထမ်း ၃ ဦး ပြည့်နေပါပြီ။");
    }
    tx.set(membershipControlRef, {
      staffCount: membersSnap.size + (already ? 0 : 1),
      staffLimit: 3,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    tx.update(inviteRef, { status: "claimed", claimedBy: uid, claimedEmail: email, claimedAt: admin.firestore.FieldValue.serverTimestamp() });
    tx.set(memberRef, {
      uid, shopId: invite.shopId, email, role: invite.role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(), invitedBy: invite.createdBy
    }, { merge: true });
    return { shopId: invite.shopId, role: invite.role };
  });
  const staff = await admin.auth().getUser(uid);
  await admin.auth().setCustomUserClaims(uid, {
    ...(staff.customClaims || {}), shopId: outcome.shopId, shopRole: outcome.role
  });
  await db.collection("users").doc(outcome.shopId).collection("auditLogs").add({
    action: "staff_joined_by_merchant_code", targetUid: uid, email, role: outcome.role,
    actorUid: outcome.shopId, createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true, ...outcome };
});

exports.listShopStaff = functions.https.onCall(async (data, context) => {
  const ownerUid = await requireActiveShop(context);
  const snap = await db.collection("shopMembers").where("shopId", "==", ownerUid).limit(100).get();
  return { maxStaff: 3, totalAccounts: 1 + snap.size, members: snap.docs.map(doc => {
    const x = doc.data();
    return { uid: doc.id, email: x.email || "", role: x.role || "employee", canPrint: x.canPrint === true };
  }) };
});


// Owner-controlled receipt and report printing permission for each staff account.
exports.setShopStaffPrintPermission = functions.https.onCall(async (data, context) => {
  const ownerUid = await requireActiveShop(context);
  const memberUid = String(data.memberUid || "").trim();
  const canPrint = data.canPrint === true;
  if (!memberUid || memberUid === ownerUid || memberUid.length > 128) {
    throw new functions.https.HttpsError("invalid-argument", "ဝန်ထမ်းအကောင့် ID မမှန်ပါ။");
  }
  const memberRef = db.collection("shopMembers").doc(memberUid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists || memberSnap.data().shopId !== ownerUid) {
    throw new functions.https.HttpsError("not-found", "ဤဆိုင်၏ ဝန်ထမ်းအကောင့် မတွေ့ပါ။");
  }
  const staff = await admin.auth().getUser(memberUid);
  const claims = { ...(staff.customClaims || {}), shopId: ownerUid,
    shopRole: memberSnap.data().role || "employee", canPrint };
  await admin.auth().setCustomUserClaims(memberUid, claims);
  await memberRef.set({ canPrint, permissionsUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await db.collection("users").doc(ownerUid).collection("auditLogs").add({
    action: "staff_print_permission_changed", targetUid: memberUid, canPrint,
    actorUid: ownerUid, createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true, canPrint };
});

// Shop owner announcements are written/read through trusted callables so staff
// do not need direct access to the owner's private appData document.
exports.publishShopAnnouncement = functions.https.onCall(async (data, context) => {
  const ownerUid = await requireActiveShop(context);
  const title = String(data.title || "").trim().slice(0, 120);
  const message = String(data.message || "").trim().slice(0, 600);
  if (title.length < 2 || message.length < 2) {
    throw new functions.https.HttpsError("invalid-argument", "ကြေညာချက်ခေါင်းစဉ်နှင့် စာသားထည့်ပါ။");
  }
  const ref = await db.collection("shopAnnouncements").doc(ownerUid).collection("items").add({
    title, message, ownerUid, createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true, id: ref.id };
});

exports.listShopAnnouncements = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login လိုအပ်သည်။");
  const claims = context.auth.token || {};
  let ownerUid = "";
  if (claims.shopId) {
    ownerUid = String(claims.shopId);
    const member = await db.collection("shopMembers").doc(context.auth.uid).get();
    if (!member.exists || member.data().shopId !== ownerUid) {
      throw new functions.https.HttpsError("permission-denied", "ဆိုင်ဝန်ထမ်းခွင့်ပြုချက် မရှိပါ။");
    }
  } else {
    ownerUid = await requireActiveShop(context);
  }
  const snap = await db.collection("shopAnnouncements").doc(ownerUid).collection("items")
    .orderBy("createdAt", "desc").limit(20).get();
  return { announcements: snap.docs.map(doc => {
    const x = doc.data();
    return { id: doc.id, title: x.title || "", message: x.message || "",
      createdAt: x.createdAt && x.createdAt.toDate ? x.createdAt.toDate().toISOString() : "" };
  }) };
});

exports.removeShopStaff = functions.https.onCall(async (data, context) => {
  const ownerUid = await requireActiveShop(context);
  const memberUid = String(data.memberUid || "").trim();
  if (!memberUid || memberUid === ownerUid || memberUid.length > 128) {
    throw new functions.https.HttpsError("invalid-argument", "ဝန်ထမ်းအကောင့် ID မမှန်ပါ။");
  }
  const ref = db.collection("shopMembers").doc(memberUid);
  const membershipControlRef = db.collection("shops").doc(ownerUid).collection("controls").doc("staff");
  let removed = false;
  await db.runTransaction(async tx => {
    const membersQuery = db.collection("shopMembers").where("shopId", "==", ownerUid);
    const [controlSnap, membersSnap, snap] = await Promise.all([
      tx.get(membershipControlRef), tx.get(membersQuery), tx.get(ref)
    ]);
    if (!snap.exists || snap.data().shopId !== ownerUid) {
      throw new functions.https.HttpsError("not-found", "ဤဆိုင်၏ ဝန်ထမ်းအကောင့် မတွေ့ပါ။");
    }
    tx.delete(ref);
    tx.set(membershipControlRef, {
      staffCount: Math.max(0, membersSnap.size - 1),
      staffLimit: 3,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    removed = true;
  });
  if (!removed) throw new functions.https.HttpsError("internal", "ဝန်ထမ်းအကောင့် ဖယ်ရှားမရပါ။");
  const staff = await admin.auth().getUser(memberUid);
  const claims = { ...(staff.customClaims || {}) };
  if (claims.shopId === ownerUid) {
    delete claims.shopId;
    delete claims.shopRole;
    delete claims.canPrint;
    await admin.auth().setCustomUserClaims(memberUid, claims);
  }
  await db.collection("users").doc(ownerUid).collection("auditLogs").add({
    action: "staff_removed", targetUid: memberUid, actorUid: ownerUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true };
});



async function requireBackupShop(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login လိုအပ်သည်။");
  }
  const email = String(context.auth.token.email || "").trim().toLowerCase();
  if (email === OWNER_EMAIL && context.auth.token.email_verified === true) {
    return context.auth.uid;
  }
  return requireActiveShop(context);
}

// Owner-scoped cloud backups. Snapshots are created and restored only by trusted Functions.
// Keep the latest 10 snapshots per shop; reject oversized records before Firestore's 1 MiB limit.
exports.createCloudBackup = functions.https.onCall(async (data, context) => {
  const uid = await requireBackupShop(context);
  const appRef = db.collection("users").doc(uid).collection("private").doc("appData");
  const centerRef = db.collection("users").doc(uid).collection("private").doc("centerManagement");
  const [appSnap, centerSnap] = await Promise.all([appRef.get(), centerRef.get()]);
  if (!appSnap.exists || !appSnap.data().data) {
    throw new functions.https.HttpsError("failed-precondition", "Cloud အရောင်းဒေတာ မတွေ့ပါ။ အရင် Cloud သိမ်းပါ။");
  }
  const snapshot = {
    data: appSnap.data().data,
    centerManagement: centerSnap.exists ? (centerSnap.data().center || null) : null
  };
  const serialized = JSON.stringify(snapshot);
  if (Buffer.byteLength(serialized, "utf8") > 700000) {
    throw new functions.https.HttpsError("resource-exhausted", "Backup ဒေတာ 700KB ကျော်နေသည်။ ဓာတ်ပုံအရွယ်အစားလျှော့ပြီး JSON Backup ကို ဖုန်းထဲသိမ်းပါ။");
  }
  const backups = db.collection("users").doc(uid).collection("backups");
  const ref = backups.doc();
  await ref.set({
    data: snapshot.data,
    centerManagement: snapshot.centerManagement,
    sizeBytes: Buffer.byteLength(serialized, "utf8"),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: uid
  });
  const old = await backups.orderBy("createdAt", "desc").offset(10).limit(100).get();
  if (!old.empty) {
    const batch = db.batch();
    old.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  return { ok: true, backupId: ref.id, sizeBytes: Buffer.byteLength(serialized, "utf8") };
});

exports.listCloudBackups = functions.https.onCall(async (data, context) => {
  const uid = await requireBackupShop(context);
  const snap = await db.collection("users").doc(uid).collection("backups")
    .orderBy("createdAt", "desc").limit(10).get();
  return { backups: snap.docs.map(doc => {
    const x = doc.data();
    return {
      id: doc.id,
      sizeBytes: Number(x.sizeBytes || 0),
      createdAt: x.createdAt && x.createdAt.toDate ? x.createdAt.toDate().toISOString() : ""
    };
  }) };
});

exports.restoreCloudBackup = functions.https.onCall(async (data, context) => {
  const uid = await requireBackupShop(context);
  const backupId = String(data.backupId || "").trim();
  if (!/^[A-Za-z0-9]{10,40}$/.test(backupId)) {
    throw new functions.https.HttpsError("invalid-argument", "Backup ID မမှန်ပါ။");
  }

  const userRef = db.collection("users").doc(uid);
  const backupRef = userRef.collection("backups").doc(backupId);
  const appRef = userRef.collection("private").doc("appData");
  const centerRef = userRef.collection("private").doc("centerManagement");
  const preRestoreRef = userRef.collection("backups").doc();

  // Read and restore both private documents in one transaction. This prevents
  // a partial restore if the process fails between appData and centerManagement.
  await db.runTransaction(async tx => {
    const [backupSnap, currentAppSnap, currentCenterSnap] = await Promise.all([
      tx.get(backupRef), tx.get(appRef), tx.get(centerRef)
    ]);
    if (!backupSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Cloud Backup မတွေ့ပါ။");
    }

    const saved = backupSnap.data();
    if (!saved.data || !Array.isArray(saved.data.products) ||
        !Array.isArray(saved.data.sales)) {
      throw new functions.https.HttpsError("failed-precondition", "Backup ဒေတာပုံစံ မမှန်ပါ။");
    }
    const restorePayload = JSON.stringify({
      data: saved.data,
      centerManagement: saved.centerManagement || null
    });
    if (Buffer.byteLength(restorePayload, "utf8") > 700000) {
      throw new functions.https.HttpsError("resource-exhausted", "Backup ဒေတာအရွယ်အစား ကန့်သတ်ချက်ကျော်နေသည်။");
    }

    if (currentAppSnap.exists && currentAppSnap.data().data) {
      const currentData = currentAppSnap.data().data;
      const currentCenter = currentCenterSnap.exists
        ? (currentCenterSnap.data().center || null) : null;
      const currentSerialized = JSON.stringify({
        data: currentData,
        centerManagement: currentCenter
      });
      const currentSize = Buffer.byteLength(currentSerialized, "utf8");
      if (currentSize <= 700000) {
        tx.create(preRestoreRef, {
          data: currentData,
          centerManagement: currentCenter,
          sizeBytes: currentSize,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: uid,
          label: "Automatic pre-restore backup"
        });
      }
    }

    tx.set(appRef, {
      data: saved.data,
      updatedByDevice: "cloud-restore",
      restoredFromBackupId: backupId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    if (saved.centerManagement) {
      tx.set(centerRef, {
        center: saved.centerManagement,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } else {
      tx.delete(centerRef);
    }
  });

  return { ok: true, backupId };
});

// Platform owner announcements for all signed-in AK Sale customers.
exports.publishGlobalAnnouncement = functions.https.onCall(async (data, context) => {
  const ownerEmail = requireAdmin(context);
  const title = String(data.title || "").trim().slice(0, 120);
  const message = String(data.message || "").trim().slice(0, 800);
  if (title.length < 2 || message.length < 2) {
    throw new functions.https.HttpsError("invalid-argument", "ကြေညာချက်ခေါင်းစဉ်နှင့် စာသားထည့်ပါ။");
  }
  const ref = await db.collection("globalAnnouncements").add({
    title, message, ownerEmail, active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true, id: ref.id };
});

exports.listGlobalAnnouncements = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login လိုအပ်သည်။");
  const snap = await db.collection("globalAnnouncements").where("active", "==", true)
    .orderBy("createdAt", "desc").limit(15).get();
  return { announcements: snap.docs.map(doc => {
    const x = doc.data();
    return { id: doc.id, title: x.title || "", message: x.message || "",
      createdAt: x.createdAt && x.createdAt.toDate ? x.createdAt.toDate().toISOString() : "" };
  }) };
});


// Scalable shop workspace API. All shop POS data is partitioned by shopId,
// not by the staff member's personal UID. Client SDKs never write these paths.
const WORKSPACE_ARRAYS = ["products","sales","purchases","people","payments","expenses"];
const WORKSPACE_READ_ROLES = ["manager","cashier","employee"];
async function workspaceIdentity(context) {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated","Login လိုအပ်သည်။");
  const claims=context.auth.token||{};
  const email=String(context.auth.token.email||"").trim().toLowerCase();
  const isPlatformOwner=email===OWNER_EMAIL && context.auth.token.email_verified===true;
  if (isPlatformOwner) return {shopId:context.auth.uid,role:"owner",isOwner:true};
  if (claims.shopId && context.auth.token.email_verified === true &&
      WORKSPACE_READ_ROLES.includes(String(claims.shopRole||""))) {
    return {shopId:String(claims.shopId),role:String(claims.shopRole),isOwner:false};
  }
  // Any paid, licensed account without a shopId claim is the owner of its own shop.
  // This lets normal subscribing merchants use the same isolated workspace as their staff.
  const ownerUid=await requireActiveShop(context);
  return {shopId:ownerUid,role:"owner",isOwner:true};
}
async function verifyWorkspaceMember(context, identity) {
  if (identity.isOwner) return;
  const member=await db.collection("shopMembers").doc(context.auth.uid).get();
  if (!member.exists || member.data().shopId!==identity.shopId ||
      member.data().role!==identity.role) {
    throw new functions.https.HttpsError("permission-denied","ဆိုင်ဝန်ထမ်းအဖွဲ့ဝင်ခွင့် မမှန်ပါ။");
  }
  const license=await db.collection("licenses").doc(identity.shopId).get();
  const l=license.data()||{};
  if (!license.exists || l.status!=="active" || !l.expiresAt ||
      l.expiresAt.toMillis()<=Date.now()) {
    throw new functions.https.HttpsError("permission-denied","ဆိုင် Subscription သက်တမ်း မရှိပါ။");
  }
}
function workspaceCanWrite(role,key) {
  if (role==="owner") return true;
  if (role==="manager") return false;
  if (role==="cashier") return ["products","sales","payments","people"].includes(key);
  if (role==="employee") return ["products","sales","payments"].includes(key);
  return false;
}
function workspaceCanRead(role,key) {
  if (role==="owner" || role==="manager") return true;
  if (role==="cashier" || role==="employee") return ["products","sales","people","payments"].includes(key);
  return false;
}
function workspaceDocId(value,index) {
  const raw=String(value && value.id || ("row_"+index));
  return raw.replace(/[^A-Za-z0-9_-]/g,"_").slice(0,120) || ("row_"+index);
}
exports.loadShopWorkspace = functions.https.onCall(async (data,context)=>{
  const identity=await workspaceIdentity(context);
  await verifyWorkspaceMember(context,identity);
  const root=db.collection("shops").doc(identity.shopId).collection("workspace").doc("current");
  const metaSnap=await root.get();
  const meta=metaSnap.exists?metaSnap.data():{};
  const pointers=meta.collections||{};
  const result={shop:{},centerManagement:null};
  for (const key of WORKSPACE_ARRAYS) {
    if (!workspaceCanRead(identity.role,key)) continue;
    const version=pointers[key];
    if (!version) { result[key]=[]; continue; }
    const snap=await db.collection("shops").doc(identity.shopId)
      .collection("workspaceVersions").doc(version).collection(key).get();
    result[key]=snap.docs.map(d=>d.data().record);
  }
  if (identity.role==="owner"||identity.role==="manager") {
    result.shop=meta.shop||{};
    result.centerManagement=meta.centerManagement||null;
  }
  return {ok:true,shopId:identity.shopId,role:identity.role,revision:Number(meta.revision||0),data:result};
});

exports.saveShopWorkspace = functions.https.onCall(async (data,context)=>{
  const identity=await workspaceIdentity(context);
  await verifyWorkspaceMember(context,identity);
  const input=data && data.data;
  if (!input || typeof input!=="object" || Array.isArray(input)) {
    throw new functions.https.HttpsError("invalid-argument","Workspace ဒေတာပုံစံ မမှန်ပါ။");
  }
  const root=db.collection("shops").doc(identity.shopId).collection("workspace").doc("current");
  const before=await root.get();
  const oldMeta=before.exists?before.data():{};
  const expected=Number(data.expectedRevision||0);
  const actual=Number(oldMeta.revision||0);
  if (expected!==actual) throw new functions.https.HttpsError("aborted","ဆိုင်ဒေတာကို အခြားဖုန်းမှ ပြင်ထားသည်။ Cloud ပြန်ဖတ်ပြီးမှ ထပ်သိမ်းပါ။");
  const pointers={...(oldMeta.collections||{})};
  const changed={};
  for (const key of WORKSPACE_ARRAYS) {
    if (!workspaceCanWrite(identity.role,key) || !Object.prototype.hasOwnProperty.call(input,key)) continue;
    if (!Array.isArray(input[key])) throw new functions.https.HttpsError("invalid-argument",key+" စာရင်းပုံစံ မမှန်ပါ။");
    if (input[key].length>100000) throw new functions.https.HttpsError("resource-exhausted",key+" စာရင်းသည် လက်ရှိ request အရွယ်အစားထက် ကျော်နေသည်။");
    if (key==="products" && ["cashier","employee"].includes(identity.role)) {
      const oldVersion=pointers.products;
      const oldSnap=oldVersion?await db.collection("shops").doc(identity.shopId).collection("workspaceVersions").doc(oldVersion).collection("products").get():null;
      const oldProducts=new Map((oldSnap?oldSnap.docs:[]).map(doc=>{const record=doc.data().record;return [String(record.id||doc.id),record]}));
      if (input.products.length!==oldProducts.size) throw new functions.https.HttpsError("permission-denied","ဝန်ထမ်းသည် ပစ္စည်းအသစ်ထည့်ခြင်း/ဖျက်ခြင်း မလုပ်နိုင်ပါ။ ဆိုင်ရှင်ထံ ဆက်သွယ်ပါ။");
      const canonical=value=>JSON.stringify(Object.keys(value||{}).filter(k=>k!=="stock"&&k!=="photo").sort().map(k=>[k,value[k]]));
      for (const product of input.products) {
        const beforeProduct=oldProducts.get(String(product&&product.id||""));
        if (!beforeProduct || canonical(beforeProduct)!==canonical(product) ||
            !Number.isFinite(Number(product.stock)) || Number(product.stock)<0) {
          throw new functions.https.HttpsError("permission-denied","ဝန်ထမ်းသည် ပစ္စည်းဈေးနှုန်း/အချက်အလက်ကို ပြင်ခွင့်မရှိပါ။ လက်ကျန်ပမာဏသာ အရောင်းနှင့်အတူ ပြောင်းနိုင်သည်။");
        }
      }
    }
    changed[key]=input[key];
  }
  if (identity.role==="owner") {
    if (input.shop && typeof input.shop==="object") changed.shop=input.shop;
    if (input.centerManagement && typeof input.centerManagement==="object") changed.centerManagement=input.centerManagement;
  }
  if (!Object.keys(changed).length) throw new functions.https.HttpsError("permission-denied","ဤရာထူးတွင် ပြင်ဆင်သိမ်းဆည်းခွင့် မရှိပါ။");
  const version=Date.now().toString(36)+"_"+crypto.randomBytes(5).toString("hex");
  for (const key of WORKSPACE_ARRAYS) {
    if (!Object.prototype.hasOwnProperty.call(changed,key)) continue;
    const rows=changed[key];
    const versionRef=db.collection("shops").doc(identity.shopId).collection("workspaceVersions").doc(version);
    for (let start=0;start<rows.length;start+=400) {
      const batch=db.batch();
      rows.slice(start,start+400).forEach((record,index)=>{
        const absolute=start+index;
        if (!record || typeof record!=="object" || Array.isArray(record)) {
          throw new functions.https.HttpsError("invalid-argument",key+" ထဲတွင် မှတ်တမ်းပုံစံမမှန်ပါ။");
        }
        const serialized=JSON.stringify(record);
        if (Buffer.byteLength(serialized,"utf8")>850000) {
          throw new functions.https.HttpsError("resource-exhausted",key+" ထဲရှိ မှတ်တမ်းတစ်ခု အရွယ်အစားကြီးလွန်းသည်။ ဓာတ်ပုံကို Cloud Storage သို့ သီးခြားသိမ်းရန်လိုသည်။");
        }
        const id=workspaceDocId(record,absolute);
        batch.set(versionRef.collection(key).doc(id),{record,recordId:id});
      });
      await batch.commit();
    }
    pointers[key]=version;
  }
  const nextRevision=actual+1;
  await db.runTransaction(async tx=>{
    const latest=await tx.get(root);
    const latestRevision=latest.exists?Number(latest.data().revision||0):0;
    if (latestRevision!==actual) throw new functions.https.HttpsError("aborted","တစ်ချိန်တည်းတွင် အခြားစက်မှ ဒေတာသိမ်းနေသည်။ ထပ်ဖတ်ပြီး ပြန်လုပ်ပါ။");
    const patch={revision:nextRevision,collections:pointers,updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:context.auth.uid};
    if (changed.shop) patch.shop=changed.shop;
    if (changed.centerManagement) patch.centerManagement=changed.centerManagement;
    tx.set(root,patch,{merge:true});
  });
  await db.collection("shops").doc(identity.shopId).collection("auditLogs").add({
    action:"workspace_saved",revision:nextRevision,role:identity.role,actorUid:context.auth.uid,
    changedCollections:Object.keys(changed),createdAt:admin.firestore.FieldValue.serverTimestamp()
  });
  return {ok:true,revision:nextRevision,changedCollections:Object.keys(changed)};
});

// AI features are server-only. The OpenAI key is stored in Firebase Secret Manager,
// never shipped to the browser or APK. Only submitted ad fields and shop audit
// metadata are sent; POS sales, customer records, passwords and payment proofs are not.
async function akCallOpenAI(instructions, input, maxOutputTokens) {
  const apiKey = OPENAI_API_KEY.value();
  if (!apiKey) throw new functions.https.HttpsError("failed-precondition", "AI API Key မသတ်မှတ်ရသေးပါ။");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-6-luna", instructions, input, max_output_tokens: maxOutputTokens })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("OpenAI request failed", response.status, payload.error && payload.error.type);
    throw new functions.https.HttpsError("unavailable", "AI ဝန်ဆောင်မှု ယာယီမရနိုင်ပါ။ နောက်မှပြန်စမ်းပါ။");
  }
  const output = (payload.output || []).flatMap(item => item.content || [])
    .filter(part => part.type === "output_text" && typeof part.text === "string")
    .map(part => part.text).join("\n").trim();
  if (!output) throw new functions.https.HttpsError("internal", "AI မှ စာသားပြန်မရရှိပါ။");
  return output.slice(0, 3000);
}

exports.akAiGenerateAd = functions.runWith({ secrets: [OPENAI_API_KEY], timeoutSeconds: 60, memory: "256MB" })
  .https.onCall(async (data, context) => {
    await requireActiveShop(context);
    const shopName = String(data.shopName || "").trim().slice(0, 90);
    const productName = String(data.productName || "").trim().slice(0, 100);
    const price = String(data.price || "").trim().slice(0, 80);
    const contact = String(data.contact || "").trim().slice(0, 100);
    if (productName.length < 2) throw new functions.https.HttpsError("invalid-argument", "ပစ္စည်းအမည် ထည့်ပါ။");
    const input = ["ဆိုင်: " + shopName, "ပစ္စည်း: " + productName,
      "ဈေးနှုန်း: " + (price || "မဖော်ပြထား"), "ဆက်သွယ်ရန်: " + (contact || "မဖော်ပြထား")].join("\n");
    const text = await akCallOpenAI(
      "သင်သည် မြန်မာနိုင်ငံရှိ Hardware နှင့် Electrical ဆိုင်များအတွက် ကြော်ငြာစာသားရေးသူဖြစ်သည်။ မြန်မာဘာသာဖြင့် တိုတောင်းပြီး ယုံကြည်စိတ်ချရသော Social Media caption တစ်ခုနှင့် hashtag 5 ခုအထိရေးပါ။ ပေးထားသော အချက်အလက်ထက်ပို၍ အရည်အသွေး၊ အာမခံ၊ stock၊ discount၊ origin သို့မဟုတ် delivery အကြောင်း မတီထွင်ပါနှင့်။ ဈေးနှုန်းနှင့် ဆက်သွယ်ရန်ကို ပေးထားမှသာ ထည့်ပါ။",
      input, 350
    );
    return { ok: true, text };
  });

exports.akAiSecurityReview = functions.runWith({ secrets: [OPENAI_API_KEY], timeoutSeconds: 60, memory: "256MB" })
  .https.onCall(async (data, context) => {
    const identity = await workspaceIdentity(context);
    await verifyWorkspaceMember(context, identity);
    const snap = await db.collection("shops").doc(identity.shopId)
      .collection("auditLogs").orderBy("createdAt", "desc").limit(40).get();
    const events = snap.docs.map(doc => {
      const x = doc.data() || {};
      return {
        action: String(x.action || "unknown").slice(0, 60),
        role: String(x.role || "unknown").slice(0, 30),
        actorIsOwner: x.actorUid === identity.shopId,
        changedCollections: Array.isArray(x.changedCollections) ? x.changedCollections.slice(0, 10) : [],
        at: x.createdAt && x.createdAt.toDate ? x.createdAt.toDate().toISOString() : null
      };
    });
    if (!events.length) {
      return { ok: true, text: "စစ်ဆေးနိုင်သော Cloud Audit မှတ်တမ်း မရှိသေးပါ။ မသင်္ကာသောလုပ်ဆောင်ချက်ရှိ/မရှိကို အတည်မပြုနိုင်ပါ။" };
    }
    const text = await akCallOpenAI(
      "သင်သည် defensive application security reviewer ဖြစ်သည်။ အောက်ပါ sanitized shop audit metadata ကိုသာ သုံး၍ အတိုချုံး မြန်မာလို သုံးသပ်ပါ။ ထူးခြားသော save burst၊ မမျှော်လင့်သော role/action pattern များကိုသာ သတိပေးပါ။ သက်သေမရှိလျှင် အန္တရာယ်ရှိသည်ဟု မစွပ်စွဲပါနှင့်။ ဤမှတ်တမ်းတွင် IP၊ failed login၊ device fingerprint မပါသောကြောင့် အဲဒီအရာများကို စစ်ပြီးပြီဟု မပြောပါနှင့်။ နောက်ဆုံးတွင် စစ်ဆေးမှုကန့်သတ်ချက်ကို ဖော်ပြပါ။",
      JSON.stringify({ eventCount: events.length, events }), 450
    );
    await db.collection("shops").doc(identity.shopId).collection("auditLogs").add({
      action: "ai_security_review", role: identity.role, actorUid: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { ok: true, text };
  });


// AK Sale POS 2.0: staff sign-in with a one-time-issued Merchant Code and password.
// Staff accounts use private synthetic Firebase Auth emails; staff do not need personal Gmail.
exports.createMerchantCodeStaff = functions.https.onCall(async (data, context) => {
  const shopId = await requireActiveShop(context);
  const name = String(data.name || "").trim().slice(0, 80);
  const role = String(data.role || "cashier").trim().toLowerCase();
  const password = String(data.password || "");
  if (name.length < 2) throw new functions.https.HttpsError("invalid-argument", "ဝန်ထမ်းအမည် အနည်းဆုံး ၂ လုံးဖြည့်ပါ။");
  if (!SHOP_STAFF_ROLES.includes(role)) throw new functions.https.HttpsError("invalid-argument", "ဝန်ထမ်းရာထူး မမှန်ပါ။");
  if (password.length < 8 || password.length > 128) throw new functions.https.HttpsError("invalid-argument", "Password အနည်းဆုံး ၈ လုံးနှင့် အများဆုံး ၁၂၈ လုံးဖြစ်ရမည်။");

  const code = crypto.randomBytes(6).toString("hex").toUpperCase();
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const internalEmail = "staff." + crypto.randomBytes(16).toString("hex") + "@akstaff.app";
  const controlRef = db.collection("shops").doc(shopId).collection("controls").doc("merchantStaff");
  const membersQuery = db.collection("shopMembers").where("shopId", "==", shopId);

  // Reserve one of the three staff slots under a transaction lock before creating Auth.
  await db.runTransaction(async tx => {
    const [controlSnap, membersSnap] = await Promise.all([tx.get(controlRef), tx.get(membersQuery)]);
    const activeCount = membersSnap.docs.filter(doc => {
      const x = doc.data() || {};
      return x.merchantStaff === true && x.status === "active";
    }).length;
    if (activeCount >= 3) {
      throw new functions.https.HttpsError("resource-exhausted", "ဆိုင်တစ်ဆိုင်လျှင် ဝန်ထမ်း ၃ ဦးသာ ဖွင့်နိုင်ပါသည်။");
    }
    tx.set(controlRef, {
      staffCount: activeCount + 1, staffLimit: 3,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  let createdUser = null;
  try {
    createdUser = await admin.auth().createUser({
      email: internalEmail, password, emailVerified: true,
      displayName: name, disabled: false
    });
    await admin.auth().setCustomUserClaims(createdUser.uid, {
      shopId, shopRole: role, merchantStaff: true
    });
    const batch = db.batch();
    batch.set(db.collection("shopMembers").doc(createdUser.uid), {
      uid: createdUser.uid, shopId, email: internalEmail, name, role,
      status: "active", merchantStaff: true, createdBy: shopId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), canPrint: false
    });
    batch.create(db.collection("merchantCodeLogins").doc(codeHash), {
      uid: createdUser.uid, shopId, email: internalEmail,
      status: "active", createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    batch.set(db.collection("users").doc(shopId).collection("auditLogs").doc(), {
      action: "merchant_staff_created", targetUid: createdUser.uid, role,
      actorUid: shopId, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();
    return { ok: true, code, name, role, expiresIn: "until revoked" };
  } catch (error) {
    if (createdUser) {
      await admin.auth().deleteUser(createdUser.uid).catch(() => {});
      await db.collection("shopMembers").doc(createdUser.uid).delete().catch(() => {});
      await db.collection("merchantCodeLogins").doc(codeHash).delete().catch(() => {});
    }
    await db.runTransaction(async tx => {
      const snap = await tx.get(controlRef);
      if (snap.exists) {
        const count = Math.max(0, Number(snap.data().staffCount || 1) - 1);
        tx.set(controlRef, { staffCount: count, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      }
    }).catch(() => {});
    console.error("createMerchantCodeStaff failed", error && error.code);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "ဝန်ထမ်းအကောင့် ဖန်တီးမရပါ။ ပြန်စမ်းပါ။");
  }
});

exports.resolveMerchantCodeLogin = functions.https.onCall(async (data, context) => {
  const code = String(data.code || "").trim().toUpperCase();
  if (!/^[A-F0-9]{12}$/.test(code)) {
    throw new functions.https.HttpsError("invalid-argument", "Merchant Code မမှန်ပါ။");
  }
  const hash = crypto.createHash("sha256").update(code).digest("hex");
  const loginSnap = await db.collection("merchantCodeLogins").doc(hash).get();
  if (!loginSnap.exists || loginSnap.data().status !== "active") {
    throw new functions.https.HttpsError("not-found", "Merchant Code သို့မဟုတ် Password မမှန်ပါ။");
  }
  const login = loginSnap.data();
  const [licenseSnap, memberSnap] = await Promise.all([
    db.collection("licenses").doc(login.shopId).get(),
    db.collection("shopMembers").doc(login.uid).get()
  ]);
  const license = licenseSnap.data() || {};
  if (!licenseSnap.exists || license.status !== "active" || !license.expiresAt ||
      license.expiresAt.toMillis() <= Date.now() || !memberSnap.exists ||
      memberSnap.data().status !== "active" || memberSnap.data().shopId !== login.shopId) {
    throw new functions.https.HttpsError("permission-denied", "ဆိုင်သက်တမ်း သို့မဟုတ် ဝန်ထမ်းအကောင့် ပိတ်ထားပါသည်။");
  }
  const authUser = await admin.auth().getUser(login.uid);
  if (authUser.disabled) throw new functions.https.HttpsError("permission-denied", "ဝန်ထမ်းအကောင့် ပိတ်ထားပါသည်။");
  return { ok: true, email: login.email };
});

exports.listMerchantCodeStaff = functions.https.onCall(async (data, context) => {
  const shopId = await requireActiveShop(context);
  const snap = await db.collection("shopMembers").where("shopId", "==", shopId).get();
  return {
    maxStaff: 3,
    members: snap.docs.filter(doc => doc.data().merchantStaff === true).map(doc => {
      const x = doc.data();
      return { uid: doc.id, name: x.name || "", role: x.role || "employee", status: x.status || "active" };
    })
  };
});

exports.removeMerchantCodeStaff = functions.https.onCall(async (data, context) => {
  const shopId = await requireActiveShop(context);
  const memberUid = String(data.memberUid || "").trim();
  if (!memberUid || memberUid.length > 128 || memberUid === shopId) {
    throw new functions.https.HttpsError("invalid-argument", "ဝန်ထမ်းအကောင့် ID မမှန်ပါ။");
  }
  const memberRef = db.collection("shopMembers").doc(memberUid);
  const memberSnap = await memberRef.get();
  const member = memberSnap.data() || {};
  if (!memberSnap.exists || member.shopId !== shopId || member.merchantStaff !== true) {
    throw new functions.https.HttpsError("not-found", "ဤဆိုင်၏ Merchant Code ဝန်ထမ်း မတွေ့ပါ။");
  }
  await admin.auth().updateUser(memberUid, { disabled: true });
  const batch = db.batch();
  batch.update(memberRef, { status: "suspended", removedAt: admin.firestore.FieldValue.serverTimestamp() });
  const codeSnap = await db.collection("merchantCodeLogins").where("uid", "==", memberUid).get();
  codeSnap.docs.forEach(doc => batch.update(doc.ref, { status: "revoked", revokedAt: admin.firestore.FieldValue.serverTimestamp() }));
  batch.set(db.collection("users").doc(shopId).collection("auditLogs").doc(), {
    action: "merchant_staff_removed", targetUid: memberUid,
    actorUid: shopId, createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await batch.commit();
  const activeSnap = await db.collection("shopMembers").where("shopId", "==", shopId).get();
  const count = activeSnap.docs.filter(doc => doc.data().merchantStaff === true && doc.data().status === "active").length;
  await db.collection("shops").doc(shopId).collection("controls").doc("merchantStaff").set({
    staffCount: count, staffLimit: 3, updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});
