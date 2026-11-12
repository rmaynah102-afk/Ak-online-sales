/* AK Sale Spark-compatible POS data layer.
 * Safe migration adapter: deliberately not auto-enabled by the current APK.
 * Uses Firebase compat SDK already loaded by apk/app.html.
 */
(function (root) {
  "use strict";
  const VERSION = 1;
  const COLLECTIONS = ["products", "sales", "purchases", "people", "payments", "expenses", "settings", "productCosts", "saleCosts"];
  const COST_FIELDS = ["cost", "costPrice", "unitCost", "purchaseCost", "profit", "grossProfit", "margin"];
  const ROLE_COLLECTIONS = {
    owner: COLLECTIONS,
    manager: COLLECTIONS,
    cashier: ["products", "sales", "people", "payments"],
    employee: ["products"]
  };
  const clone = value => JSON.parse(JSON.stringify(value == null ? null : value));
  const clean = value => {
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== "object") return value;
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "photo" && typeof item === "string" && item.startsWith("data:image/")) continue;
      if (item !== undefined) out[key] = clean(item);
    }
    return out;
  };
  const splitSensitive = record => {
    const walk = value => {
      if (Array.isArray(value)) {
        const safe = [], sensitive = [];
        let hasSensitive = false;
        value.forEach((item, index) => {
          const child = walk(item);
          safe[index] = child.safe;
          sensitive[index] = child.sensitive;
          if (child.hasSensitive) hasSensitive = true;
        });
        return { safe, sensitive: hasSensitive ? sensitive : null, hasSensitive };
      }
      if (!value || typeof value !== "object") return { safe: value, sensitive: null, hasSensitive: false };
      const safe = {}, sensitive = {};
      let hasSensitive = false;
      for (const [key, item] of Object.entries(value)) {
        if (COST_FIELDS.includes(key)) {
          sensitive[key] = clean(item);
          hasSensitive = true;
        } else {
          const child = walk(item);
          safe[key] = child.safe;
          if (child.hasSensitive) {
            sensitive[key] = child.sensitive;
            hasSensitive = true;
          }
        }
      }
      return { safe, sensitive: hasSensitive ? sensitive : null, hasSensitive };
    };
    const result = walk(record || {});
    return { base: result.safe, costs: result.sensitive || {} };
  };
  const mergeSensitive = (safe, sensitive) => {
    if (Array.isArray(safe)) return safe.map((item, index) => mergeSensitive(item, sensitive && sensitive[index]));
    if (!safe || typeof safe !== "object") return safe;
    const result = { ...safe };
    if (sensitive && typeof sensitive === "object" && !Array.isArray(sensitive)) {
      for (const [key, value] of Object.entries(sensitive)) {
        result[key] = key in result ? mergeSensitive(result[key], value) : value;
      }
    }
    return result;
  };
  const assertId = id => {
    const value = String(id || "");
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new Error("Invalid POS record ID: " + value);
    return value;
  };
  const pathFor = (db, shopId, collection) =>
    db.collection("shops").doc(shopId).collection("pos").doc(collection).collection("records");

  class AKSparkPosStore {
    constructor(options) {
      if (!options || !options.firestore || !options.auth) throw new Error("Firestore and Auth are required");
      this.db = options.firestore;
      this.auth = options.auth;
      this.shopId = String(options.shopId || "");
      this.role = String(options.role || "guest");
      this.isPlatformOwner = !!options.isPlatformOwner;
      if (!this.shopId) throw new Error("shopId is required");
    }

    _assertSignedIn() {
      const user = this.auth.currentUser;
      if (!user || !user.emailVerified) throw new Error("Verified Gmail login is required");
      if (this.isPlatformOwner && user.email.toLowerCase() !== "painglin102@gmail.com") {
        throw new Error("Platform Owner identity mismatch");
      }
      return user;
    }

    _assertOwnerMigration() {
      const user = this._assertSignedIn();
      if (user.uid !== this.shopId || (!this.isPlatformOwner && this.role !== "owner")) {
        throw new Error("Only the shop owner can migrate the legacy workspace");
      }
      return user;
    }

    async loadWorkspace() {
      this._assertSignedIn();
      const names = ROLE_COLLECTIONS[this.role];
      if (!names) throw new Error("Unsupported or inactive shop role");
      const output = { products: [], sales: [], purchases: [], people: [], payments: [], expenses: [], shop: {} };
      for (const name of names) {
        if (name === "settings") continue;
        const snap = await pathFor(this.db, this.shopId, name).get();
        output[name] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      if (names.includes("settings")) {
        const settings = await pathFor(this.db, this.shopId, "settings").doc("shop").get();
        if (settings.exists) output.shop = settings.data();
      }
      if (names.includes("productCosts")) {
        const snap = await pathFor(this.db, this.shopId, "productCosts").get();
        const byId = new Map(snap.docs.map(doc => [doc.id, doc.data()]));
        output.products = output.products.map(p => mergeSensitive(p, byId.get(p.id)));
      }
      if (names.includes("saleCosts")) {
        const snap = await pathFor(this.db, this.shopId, "saleCosts").get();
        const byId = new Map(snap.docs.map(doc => [doc.id, doc.data()]));
        output.sales = output.sales.map(s => mergeSensitive(s, byId.get(s.id)));
      }
      return output;
    }

    async migrateLegacyWorkspace(legacyData, options) {
      this._assertOwnerMigration();
      const data = legacyData || {};
      const markerRef = this.db.collection("users").doc(this.shopId).collection("private").doc("sparkPosMigrationV1");
      const existing = await markerRef.get();
      if (existing.exists && existing.data().status === "complete" && !(options && options.force)) {
        return { alreadyMigrated: true, marker: existing.data() };
      }

      const counts = {};
      let writes = [];
      const commitChunk = async () => {
        if (!writes.length) return;
        const batch = this.db.batch();
        for (const write of writes) batch.set(write.ref, write.data, { merge: true });
        await batch.commit();
        writes = [];
      };
      const queue = async (collection, id, value) => {
        writes.push({ ref: pathFor(this.db, this.shopId, collection).doc(id), data: clean(value) });
        if (writes.length >= 400) await commitChunk();
      };

      for (const name of ["products", "sales", "purchases", "people", "payments", "expenses"]) {
        const rows = Array.isArray(data[name]) ? data[name] : [];
        counts[name] = rows.length;
        for (const row of rows) {
          const id = assertId(row && row.id);
          const { base, costs } = (name === "products" || name === "sales") ? splitSensitive(row) : { base: row, costs: {} };
          await queue(name, id, { ...base, schemaVersion: VERSION, migratedAt: root.firebase.firestore.FieldValue.serverTimestamp() });
          if (Object.keys(costs).length) {
            await queue(name === "products" ? "productCosts" : "saleCosts", id, {
              ...costs, schemaVersion: VERSION, migratedAt: this.db.FieldValue.serverTimestamp()
            });
          }
        }
      }
      counts.settings = data.shop && typeof data.shop === "object" ? 1 : 0;
      if (counts.settings) await queue("settings", "shop", { ...clean(data.shop), schemaVersion: VERSION });
      await commitChunk();

      // Verify destination counts before recording completion. Old blob remains untouched.
      const verified = {};
      for (const name of ["products", "sales", "purchases", "people", "payments", "expenses"]) {
        const snap = await pathFor(this.db, this.shopId, name).get();
        verified[name] = snap.size;
        if (snap.size < counts[name]) throw new Error("Migration verification failed for " + name + ": source=" + counts[name] + ", destination=" + snap.size);
        for (const row of (Array.isArray(data[name]) ? data[name] : [])) {
          const sourceId = assertId(row && row.id);
          if (!snap.docs.some(doc => doc.id === sourceId)) throw new Error("Migration verification missing " + name + "/" + sourceId);
        }
      }
      const marker = {
        version: VERSION,
        status: "complete",
        source: "users/" + this.shopId + "/private/appData",
        counts,
        verified,
        completedAt: this.db.FieldValue.serverTimestamp(),
        completedBy: this.auth.currentUser.uid
      };
      await markerRef.set(marker);
      return { alreadyMigrated: false, counts, verified };
    }

    async upsert(collection, records) {
      this._assertSignedIn();
      const writeRoles = {
        owner: COLLECTIONS,
        manager: COLLECTIONS,
        cashier: ["sales", "people", "payments"],
        employee: []
      };
      if (!writeRoles[this.role] || !writeRoles[this.role].includes(collection)) {
        throw new Error("Role cannot write this collection");
      }
      if (!Array.isArray(records)) throw new Error("records must be an array");
      let batch = this.db.batch(), count = 0, pending = 0;
      const flush = async () => { if (pending) { await batch.commit(); batch = this.db.batch(); pending = 0; } };
      for (const record of records) {
        const id = assertId(record && record.id);
        const { base, costs } = (collection === "products" || collection === "sales") ? splitSensitive(record) : { base: record, costs: {} };
        batch.set(pathFor(this.db, this.shopId, collection).doc(id), clean({ ...base, updatedAt: this.db.FieldValue.serverTimestamp() }), { merge: true });
        pending++; count++;
        if (Object.keys(costs).length) {
          const costCollection = collection === "products" ? "productCosts" : "saleCosts";
          if (!ROLE_COLLECTIONS[this.role].includes(costCollection)) throw new Error("Role cannot write protected cost data");
          batch.set(pathFor(this.db, this.shopId, costCollection).doc(id), clean({ ...costs, updatedAt: this.db.FieldValue.serverTimestamp() }), { merge: true });
          pending++;
        }
        if (pending >= 400) await flush();
      }
      await flush();
      return { written: count };
    }
  }

  root.AKSparkPosStore = AKSparkPosStore;
  root.AKSparkPosSchema = Object.freeze({ version: VERSION, collections: COLLECTIONS.slice(), roleCollections: clone(ROLE_COLLECTIONS) });
})(typeof window !== "undefined" ? window : globalThis);
