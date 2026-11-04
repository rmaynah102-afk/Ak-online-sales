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
