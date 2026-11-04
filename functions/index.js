const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { defineString } = require("firebase-functions/params");
const ADMIN_EMAIL = defineString("ADMIN_EMAIL");

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

function requireAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login လိုအပ်သည်။");
  }
  const configuredAdmin = String(ADMIN_EMAIL.value() || "").trim().toLowerCase();
  const callerEmail = String(context.auth.token.email || "").trim().toLowerCase();
  if (!configuredAdmin || callerEmail !== configuredAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Admin ခွင့်ပြုချက်မရှိပါ။");
  }
  return callerEmail;
}

function requireActiveShop(context) {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login လိုအပ်သည်။");
  return context.auth.uid;
}

exports.claimShopDevice = functions.https.onCall(async (data, context) => {
  const uid = requireActiveShop(context);
  const deviceId = String(data.deviceId || "").trim();
  const label = String(data.label || "Device").slice(0, 110);
  if (!/^akd_[a-zA-Z0-9_-]{8,100}$/.test(deviceId)) {
    throw new functions.https.HttpsError("invalid-argument", "Device ID မမှန်ပါ။");
  }
  const licenseSnap = await db.collection("licenses").doc(uid).get();
  const license = licenseSnap.data() || {};
  if (!licenseSnap.exists || license.status !== "active" ||
      !license.expiresAt || license.expiresAt.toMillis() <= Date.now()) {
    throw new functions.https.HttpsError("permission-denied", "Subscription သက်တမ်းမရှိပါ။");
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
  const uid = requireActiveShop(context);
  const snap = await db.collection("users").doc(uid).collection("devices").orderBy("lastSeenAt", "desc").limit(5).get();
  return { devices: snap.docs.map(doc => {
    const x = doc.data();
    return { deviceId: doc.id, label: x.label || "Device",
      lastSeen: x.lastSeenAt && x.lastSeenAt.toDate ? x.lastSeenAt.toDate().toISOString() : "" };
  }) };
});

exports.revokeShopDevice = functions.https.onCall(async (data, context) => {
  const uid = requireActiveShop(context);
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
  const uid = requireActiveShop(context);
  const licenseSnap = await db.collection("licenses").doc(uid).get();
  const license = licenseSnap.data() || {};
  if (!licenseSnap.exists || !["trial", "active"].includes(license.status) ||
      !license.expiresAt || license.expiresAt.toMillis() <= Date.now()) {
    throw new functions.https.HttpsError("permission-denied", "Subscription သက်တမ်းမရှိပါ။");
  }
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
        status: String(x.status || ""),
        createdAt: x.createdAt && x.createdAt.toDate
          ? x.createdAt.toDate().toISOString()
          : ""
      };
    })
  };
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
    if (payment.status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "ဤတောင်းဆိုချက်ကို ယခင်က စီမံပြီးပါပြီ။");
    }
    if (!uid || ![30, 90, 180, 365].includes(days) || reference.length < 3) {
      throw new functions.https.HttpsError("failed-precondition", "Payment request data မမှန်ပါ။");
    }

    const licenseRef = db.collection("licenses").doc(uid);
    const licenseSnap = await tx.get(licenseRef);
    const now = Date.now();
    const currentExpiry = licenseSnap.exists && licenseSnap.data().expiresAt
      ? licenseSnap.data().expiresAt.toMillis()
      : now;
    const nextExpiry = admin.firestore.Timestamp.fromMillis(
      Math.max(now, currentExpiry) + days * 86400000
    );
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
