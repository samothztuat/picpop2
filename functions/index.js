const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const functionsV1 = require("firebase-functions/v1");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const REGION = "europe-west1";
const SUPERADMIN_EMAIL = "tomtautz@gmail.com";

// ══════════════════════════════════════════════════════════════════════════════
//  ONEDRIVE (Microsoft Graph, app-only) — Bildspeicher-Backend für Mandant phaeno
//  DATENSCHUTZ-GARANTIE: Alle Zugriffe sind HART auf genau EIN OneDrive verdrahtet
//  (picpop-test@phaeno.de / Ordner „Media"). Kein User-Parameter, kein Zugriff auf
//  andere Drives im Tenant — auch nicht mit der breiten Files.ReadWrite.All-Rolle.
// ══════════════════════════════════════════════════════════════════════════════
const MS_CLIENT_SECRET = defineSecret("MS_CLIENT_SECRET");
const MS_TENANT   = "c20f8d61-587a-4dba-9fcd-ffa942e9ac59";
const MS_CLIENT   = "ce3b8711-6d4f-4b52-a296-779385717b18";
const OD_USER     = "picpop-test@phaeno.de";  // ← einziger erlaubter Drive
const OD_FOLDER   = "Media";
const GRAPH       = "https://graph.microsoft.com/v1.0";

let _msTok = { value: null, exp: 0 };
async function graphToken() {
  if (_msTok.value && Date.now() < _msTok.exp - 60000) return _msTok.value;
  const res = await fetch(`https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MS_CLIENT, client_secret: MS_CLIENT_SECRET.value(),
      scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
    }),
  });
  const d = await res.json();
  if (!d.access_token) throw new HttpsError("internal", "Graph-Token: " + JSON.stringify(d).slice(0, 180));
  _msTok = { value: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return _msTok.value;
}
// Basis-URL des EINEN erlaubten Drives — hart verdrahtet.
function odBase() { return `${GRAPH}/users/${encodeURIComponent(OD_USER)}/drive`; }

// Verbindungstest + Media-Ordner-Info (nur Superadmin).
exports.msTestConnection = onCall({ region: REGION, secrets: [MS_CLIENT_SECRET] }, async (req) => {
  console.log("[msTestConnection] aufgerufen von", req.auth?.token?.email);
  if (req.auth?.token?.email !== SUPERADMIN_EMAIL) throw new HttpsError("permission-denied", "Nur Superadmin.");
  try {
    const tok = await graphToken();
    const r = await fetch(`${odBase()}?$select=id,driveType,quota`, { headers: { Authorization: `Bearer ${tok}` } });
    const d = await r.json();
    if (d.error) throw new HttpsError("internal", d.error.message);
    const fr = await fetch(`${odBase()}/root:/${OD_FOLDER}`, { headers: { Authorization: `Bearer ${tok}` } });
    const fd = await fr.json();
    const out = { driveId: d.id, driveType: d.driveType, quota: d.quota || null, user: OD_USER, folder: OD_FOLDER, folderId: fd.id || null };
    console.log("[msTestConnection] OK", JSON.stringify(out).slice(0, 200));
    return out;
  } catch (e) {
    console.error("[msTestConnection] FEHLER", e.message);
    throw (e instanceof HttpsError ? e : new HttpsError("internal", e.message));
  }
});

// Upload-Session anlegen → der Browser lädt die Datei direkt zur zurückgegebenen
// (vorautorisierten) uploadUrl hoch. Ziel ist IMMER der Media-Ordner.
exports.msCreateUploadSession = onCall({ region: REGION, secrets: [MS_CLIENT_SECRET] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Nicht angemeldet.");
  const { filename, assetId } = req.data || {};
  if (!filename) throw new HttpsError("invalid-argument", "filename fehlt.");
  const safe = String(filename).replace(/[\\/:*?"<>|]/g, "_");
  const path = `${OD_FOLDER}/${assetId ? assetId + "-" : ""}${safe}`;
  const tok = await graphToken();
  const r = await fetch(`${odBase()}/root:/${encodeURI(path)}:/createUploadSession`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } }),
  });
  const d = await r.json();
  if (!d.uploadUrl) throw new HttpsError("internal", "Upload-Session: " + JSON.stringify(d).slice(0, 180));
  return { uploadUrl: d.uploadUrl, path };
});

// Kurzlebige Download-URL für ein Original aus dem Media-Ordner.
exports.msGetDownloadUrl = onCall({ region: REGION, secrets: [MS_CLIENT_SECRET] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Nicht angemeldet.");
  const { itemId } = req.data || {};
  if (!itemId) throw new HttpsError("invalid-argument", "itemId fehlt.");
  const tok = await graphToken();
  const r = await fetch(`${odBase()}/items/${encodeURIComponent(itemId)}?$select=id,name,size,@microsoft.graph.downloadUrl`, { headers: { Authorization: `Bearer ${tok}` } });
  const d = await r.json();
  const url = d["@microsoft.graph.downloadUrl"];
  if (!url) throw new HttpsError("internal", "Download-URL: " + (d.error?.message || "nicht gefunden"));
  return { downloadUrl: url, name: d.name, size: d.size };
});

// E-Mail-Domain → picpop-Mandant. Steuert das Auto-Provisioning beim Erstlogin.
// Bei Bedarf weitere Domains/Mandanten ergänzen.
const DOMAIN_TENANT = {
  "phaeno.de": "phaeno",
};

// ── Bestehend: Passwort setzen / User löschen (nur Superadmin) ────────────────
exports.adminSetPassword = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Nicht angemeldet.");
  if (request.auth.token.email !== SUPERADMIN_EMAIL) throw new HttpsError("permission-denied", "Nur für Superadmin.");
  const { uid, newPassword } = request.data;
  if (!uid || typeof uid !== "string") throw new HttpsError("invalid-argument", "uid fehlt.");
  if (!newPassword || newPassword.length < 6) throw new HttpsError("invalid-argument", "Passwort muss mindestens 6 Zeichen haben.");
  await getAuth().updateUser(uid, { password: newPassword });
  return { success: true };
});

exports.adminDeleteUser = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Nicht angemeldet.");
  if (request.auth.token.email !== SUPERADMIN_EMAIL) throw new HttpsError("permission-denied", "Nur für Superadmin.");
  const { uid } = request.data;
  if (!uid || typeof uid !== "string") throw new HttpsError("invalid-argument", "uid fehlt.");
  await getAuth().deleteUser(uid);
  return { success: true };
});

// ══════════════════════════════════════════════════════════════════════════════
//  NUTZERGRUPPEN & RECHTE (portiert aus contextr "System B")
//
//  Datenmodell (pro Mandant):
//   tenants/{tid}/settings/bereiche  → { liste: [{ id, name }] }   (Scopes)
//   tenants/{tid}/groups/{gid}       → { id, name, externalName?, externalId?,
//                                        quelle, module?[], rechte?{bereichId: stufe},
//                                        notiz?, createdAt }
//   tenants/{tid}/users/{uid}        → …, role:'admin'|'member', groupIds:[…]
//
//  Rechte werden vorberechnet und als Custom Claims ins Firebase-Auth-Token
//  geschrieben (ppRole, ppRechte, tenantId) — damit die Security Rules ohne
//  teure get()-Lookups entscheiden können. „Höchste Stufe gewinnt", „kein"
//  bedeutet „nicht eingetragen" (= verboten).
// ══════════════════════════════════════════════════════════════════════════════

const RANG = { kein: 0, lesen: 1, verwalten: 2 };

// Mandant eines Users ermitteln (Root-Mapping userTenants/{uid}).
async function tenantOfUser(db, uid) {
  const ut = await db.collection("userTenants").doc(uid).get();
  return ut.exists ? (ut.data().tenantId || null) : null;
}

// Aufrufer-Berechtigung: Superadmin ODER tenant_admin des betroffenen Mandanten.
function assertTenantAdmin(request, tenantId) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Nicht angemeldet.");
  const tok = request.auth.token || {};
  if (tok.email === SUPERADMIN_EMAIL) return;
  if (tok.tenantId === tenantId && tok.ppRole === "admin") return;
  throw new HttpsError("permission-denied", "Nur für Mandanten-Admins.");
}

// Effektive Rechte eines Users aus seinen Gruppen berechnen und als Claim schreiben.
async function schreibeRechteClaim(uid, tenantId) {
  const db = getFirestore();
  if (!tenantId) tenantId = await tenantOfUser(db, uid);
  if (!tenantId) return { skipped: "kein Mandant" };

  const userSnap = await db.doc(`tenants/${tenantId}/users/${uid}`).get();
  const u = userSnap.exists ? userSnap.data() : {};
  const role = u.role === "admin" ? "admin" : "member";
  const groupIds = Array.isArray(u.groupIds) ? u.groupIds : [];

  const rechte = {};
  for (const gid of groupIds) {
    const g = await db.doc(`tenants/${tenantId}/groups/${gid}`).get();
    if (!g.exists) continue;
    const gr = g.data().rechte || {};
    for (const [bid, stufe] of Object.entries(gr)) {
      if ((RANG[stufe] || 0) > (RANG[rechte[bid]] || 0)) rechte[bid] = stufe;
    }
  }
  for (const k of Object.keys(rechte)) if (rechte[k] === "kein") delete rechte[k];

  let existing = {};
  try { existing = (await getAuth().getUser(uid)).customClaims || {}; } catch (_) {}
  await getAuth().setCustomUserClaims(uid, { ...existing, tenantId, ppRole: role, ppRechte: rechte });
  return { uid, role, rechte };
}

// Liste der Mandanten-User (für das Admin-Panel).
exports.listTenantUsers = onCall({ region: REGION }, async (request) => {
  const { tenantId } = request.data || {};
  if (!tenantId) throw new HttpsError("invalid-argument", "tenantId fehlt.");
  assertTenantAdmin(request, tenantId);
  const db = getFirestore();
  const snap = await db.collection(`tenants/${tenantId}/users`).get();
  const users = snap.docs.map((d) => {
    const x = d.data();
    return {
      uid: d.id,
      email: x.email || "",
      displayName: x.displayName || [x.firstName, x.lastName].filter(Boolean).join(" "),
      role: x.role === "admin" ? "admin" : "member",
      groupIds: Array.isArray(x.groupIds) ? x.groupIds : [],
    };
  });
  return { users };
});

// Gruppen-Zuordnung eines Users setzen → Claims neu berechnen.
exports.setUserGroups = onCall({ region: REGION }, async (request) => {
  const { tenantId, uid, groupIds } = request.data || {};
  if (!tenantId || !uid || !Array.isArray(groupIds)) throw new HttpsError("invalid-argument", "tenantId, uid, groupIds nötig.");
  assertTenantAdmin(request, tenantId);
  const db = getFirestore();
  // Validieren: jede groupId existiert im Mandanten
  for (const gid of groupIds) {
    const g = await db.doc(`tenants/${tenantId}/groups/${gid}`).get();
    if (!g.exists) throw new HttpsError("not-found", `Gruppe ${gid} existiert nicht.`);
  }
  await db.doc(`tenants/${tenantId}/users/${uid}`).set({ groupIds }, { merge: true });
  const res = await schreibeRechteClaim(uid, tenantId);
  return { success: true, ...res };
});

// Rolle eines Users setzen (admin|member) → Claims neu berechnen.
exports.setUserRole = onCall({ region: REGION }, async (request) => {
  const { tenantId, uid, role } = request.data || {};
  if (!tenantId || !uid || !["admin", "member"].includes(role)) throw new HttpsError("invalid-argument", "tenantId, uid, role(admin|member) nötig.");
  assertTenantAdmin(request, tenantId);
  const db = getFirestore();
  await db.doc(`tenants/${tenantId}/users/${uid}`).set({ role }, { merge: true });
  const res = await schreibeRechteClaim(uid, tenantId);
  return { success: true, ...res };
});

// Backfill: Claims für ALLE User eines Mandanten neu berechnen (nach Erst-Setup /
// nach Rechteänderungen). Vor dem Aktivieren der firestore.rules einmal ausführen.
exports.refreshTenantClaims = onCall({ region: REGION }, async (request) => {
  const { tenantId } = request.data || {};
  if (!tenantId) throw new HttpsError("invalid-argument", "tenantId fehlt.");
  assertTenantAdmin(request, tenantId);
  const db = getFirestore();
  const snap = await db.collection(`tenants/${tenantId}/users`).get();
  let done = 0, errors = 0;
  for (const d of snap.docs) {
    try { await schreibeRechteClaim(d.id, tenantId); done++; }
    catch (_) { errors++; }
  }
  return { success: true, done, errors, total: snap.size };
});

// Trigger: Ändert sich eine Gruppe (Rechte/Bereiche), Claims aller Mitglieder neu.
exports.onGroupChange = onDocumentWritten({ region: REGION, document: "tenants/{tid}/groups/{gid}" }, async (event) => {
  const { tid, gid } = event.params;
  const db = getFirestore();
  const members = await db.collection(`tenants/${tid}/users`).where("groupIds", "array-contains", gid).get();
  for (const d of members.docs) {
    try { await schreibeRechteClaim(d.id, tid); } catch (_) {}
  }
});

// Trigger: Ändert sich der Bereich eines Ordners, wird er auf alle Assets im Ordner
// vererbt (assets.bereichEff), damit die Rules den effektiven Bereich prüfen können.
async function propagateFolderBereich(tid, folderId, bereichId) {
  const db = getFirestore();
  const assets = await db.collection(`tenants/${tid}/assets`).where("folderId", "==", folderId).get();
  let batch = db.batch(); let n = 0;
  for (const d of assets.docs) {
    batch.set(d.ref, { bereichEff: bereichId || null }, { merge: true });
    if (++n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n > 0) await batch.commit();
}

exports.onFolderBereichChange = onDocumentWritten({ region: REGION, document: "tenants/{tid}/folders/{fid}" }, async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : {};
  const after = event.data.after.exists ? event.data.after.data() : {};
  if ((before.bereichId || null) === (after.bereichId || null)) return;
  await propagateFolderBereich(event.params.tid, event.params.fid, after.bereichId || null);
});

exports.onPdfFolderBereichChange = onDocumentWritten({ region: REGION, document: "tenants/{tid}/pdfFolders/{fid}" }, async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : {};
  const after = event.data.after.exists ? event.data.after.data() : {};
  if ((before.bereichId || null) === (after.bereichId || null)) return;
  await propagateFolderBereich(event.params.tid, event.params.fid, after.bereichId || null);
});

// ══════════════════════════════════════════════════════════════════════════════
//  GEFAHRENZONE: alle Backend-Konten eines Mandanten löschen
//  Nur Superadmin. Löscht Auth-Konto + users-Doc + userTenants für jedes Konto
//  im Mandanten — AUSSER dem Superadmin. Zweck: sauberer Neustart, damit sich
//  Nutzer per Microsoft (statt altem E-Mail/Passwort-Konto) anmelden können.
//  Sicherung: `confirm` muss exakt die tenantId sein.
// ══════════════════════════════════════════════════════════════════════════════
exports.adminPurgeTenantUsers = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Nicht angemeldet.");
  if (request.auth.token.email !== SUPERADMIN_EMAIL) throw new HttpsError("permission-denied", "Nur für Superadmin.");
  const { tenantId, confirm } = request.data || {};
  if (!tenantId) throw new HttpsError("invalid-argument", "tenantId fehlt.");
  if (confirm !== tenantId) throw new HttpsError("failed-precondition", "Bestätigung stimmt nicht mit tenantId überein.");

  const db = getFirestore();
  const snap = await db.collection(`tenants/${tenantId}/users`).get();
  let deleted = 0, skipped = 0, errors = 0;
  const results = [];
  for (const d of snap.docs) {
    const uid = d.id;
    const email = (d.data().email || "").toLowerCase();
    if (email === SUPERADMIN_EMAIL) { skipped++; results.push({ email, status: "skipped-superadmin" }); continue; }
    try {
      try { await getAuth().deleteUser(uid); }
      catch (e) { if (e.code !== "auth/user-not-found") throw e; }
      await d.ref.delete();
      await db.collection("userTenants").doc(uid).delete().catch(() => {});
      deleted++; results.push({ email, status: "deleted" });
    } catch (e) {
      errors++; results.push({ email, status: "error: " + e.message });
    }
  }
  return { deleted, skipped, errors, total: snap.size, results };
});

// ══════════════════════════════════════════════════════════════════════════════
//  AUTO-PROVISIONING beim Erstlogin (z. B. Microsoft/Entra)
//
//  Wird ein NEUES Firebase-Auth-Konto angelegt (erste Anmeldung), ordnen wir es
//  anhand der E-Mail-Domain automatisch dem passenden Mandanten zu:
//    • userTenants/{uid}            = { tenantId, email }
//    • tenants/{tid}/users/{uid}    = { email, displayName, role:'member', groupIds:[] }
//    • Rechte-Claim berechnen (tenantId/ppRole/ppRechte)
//  Unbekannte Domains (z. B. der Superadmin @gmail.com) werden übersprungen.
//  Gruppen-Zuordnung erfolgt anschließend im Admin-Panel (bzw. später automatisch
//  aus den Entra-Gruppen-Claims).
// ══════════════════════════════════════════════════════════════════════════════
exports.onAuthUserCreate = functionsV1.region(REGION).auth.user().onCreate(async (user) => {
  const email = (user.email || "").toLowerCase();
  const domain = email.includes("@") ? email.split("@")[1] : "";
  const tenantId = DOMAIN_TENANT[domain];
  if (!tenantId) {
    console.log("[provisioning] übersprungen (Domain nicht zugeordnet):", email || user.uid);
    return;
  }
  const db = getFirestore();
  const uid = user.uid;
  try {
    await db.collection("userTenants").doc(uid).set({ tenantId, email }, { merge: true });
    const userRef = db.doc(`tenants/${tenantId}/users/${uid}`);
    const existing = await userRef.get();
    await userRef.set({
      uid,
      email,
      displayName: user.displayName || (existing.exists ? existing.data().displayName : "") || "",
      role: existing.exists && existing.data().role ? existing.data().role : "member",
      groupIds: existing.exists && Array.isArray(existing.data().groupIds) ? existing.data().groupIds : [],
      provider: "microsoft",
      createdAt: existing.exists && existing.data().createdAt ? existing.data().createdAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await schreibeRechteClaim(uid, tenantId);
    console.log("[provisioning] angelegt:", email, "→", tenantId);
  } catch (e) {
    console.error("[provisioning] Fehler für", email, e.message);
  }
});
