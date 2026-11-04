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

  const now = Date.now();
  const expiresAt = admin.firestore.Timestamp.fromDate(
    new Date(now + 7 * 24 * 60 * 60 * 1000)
  );

  await ref.create({
    uid: user.uid,
    email: user.email || "",
    status: "trial",
    plan: "trial-7-days",
    startsAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return null;
});

exports.approveSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login လိုအပ်သည်။");
  }

  const configuredAdmin = ADMIN_EMAIL.value();
  const callerEmail = String(context.auth.token.email || "").toLowerCase();
  if (!configuredAdmin || callerEmail !== String(configuredAdmin).toLowerCase()) {
    throw new functions.https.HttpsError("permission-denied", "Admin ခွင့်ပြုချက်မရှိပါ။");
  }

  const uid = String(data.uid || "").trim();
  const days = Number(data.days);
  const reference = String(data.reference || "").trim();

  if (!uid || !Number.isInteger(days) || days < 1 || days > 3650 || reference.length < 3) {
    throw new functions.https.HttpsError("invalid-argument", "UID၊ ရက်အရေအတွက်နှင့် ငွေလွှဲအထောက်အထား စစ်ဆေးပါ။");
  }

  const licenseRef = db.collection("licenses").doc(uid);
  const expiresAt = await db.runTransaction(async (tx) => {
    const snap = await tx.get(licenseRef);
    const now = Date.now();
    const currentExpiry = snap.exists && snap.data().expiresAt
      ? snap.data().expiresAt.toMillis()
      : now;
    const start = Math.max(now, currentExpiry);
    const nextExpiry = admin.firestore.Timestamp.fromMillis(start + days * 86400000);

    tx.set(licenseRef, {
      uid,
      status: "active",
      plan: days + "-days",
      expiresAt: nextExpiry,
      lastPaymentReference: reference,
      lastApprovedBy: callerEmail,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return nextExpiry;
  });

  return { uid, expiresAt: expiresAt.toDate().toISOString() };
});
