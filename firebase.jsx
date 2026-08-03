// Firebase initialization, seeding, real-time subscriptions, write operations

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBXnMXIhhaI3G3kvYfgRpceUy1k9oJ4cXs",
  authDomain: "picpop-bilddatenbank.firebaseapp.com",
  projectId: "picpop-bilddatenbank",
  storageBucket: "picpop-bilddatenbank.firebasestorage.app",
  messagingSenderId: "895374281311",
  appId: "1:895374281311:web:6863b936b1c69278e029ea",
};

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
const storage = firebase.storage();
// Cloud Functions — Region europe-west1
window._picpopFunctions = firebase.app().functions("europe-west1");

// ── Tenant detection ──────────────────────────────────────────────────────────
// Priority: ?t=xxx URL param  →  subdomain  →  "dev" (localhost fallback)
(function detectTenantId() {
  const param = new URLSearchParams(window.location.search).get("t");
  if (param) { window.TENANT_ID = param; return; }

  const host  = window.location.hostname;
  const parts = host.split(".");
  const skip  = ["www", "app", "picpop", "localhost", "127"];
  if (parts.length >= 3 && !skip.includes(parts[0])) {
    window.TENANT_ID = parts[0];
    return;
  }
  window.TENANT_ID = "dev";
})();

// ── Tenant-aware Firestore helpers ────────────────────────────────────────────
function tenantCol(name) {
  return db.collection("tenants").doc(window.TENANT_ID).collection(name);
}
function tenantDoc(colName, docId) {
  return tenantCol(colName).doc(docId);
}
function tenantSettingsDoc() {
  return db.doc(`tenants/${window.TENANT_ID}/settings/global`);
}

// ── AI config cache (loaded once from Firestore tenants/{id}/settings/global) ─
window.AI_CONFIG = window.AI_CONFIG || { openaiKey: "", prompt: "" };

async function loadAiConfig() {
  try {
    const snap = await tenantSettingsDoc().get();
    if (snap.exists) {
      const d = snap.data();
      window.AI_CONFIG.openaiKey = (d.llmProviderKeys || {}).openai || "";
      window.AI_CONFIG.prompt    = d.aiPrompt || window.AI_DEFAULT_PROMPT || "";
    }
  } catch (e) {
    console.warn("[loadAiConfig]", e.message);
  }
}

// ── OpenAI Vision: describe one image (Fotografie/Bildinhalt) ────────────────
async function describeImageWithAI(imageUrl) {
  const key    = window.AI_CONFIG.openaiKey;
  const prompt = window.AI_CONFIG.prompt || window.AI_DEFAULT_PROMPT || "";
  if (!key || !imageUrl) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: [
            { type: "text",      text: prompt },
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
          ],
        }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn("[describeImage] HTTP", res.status, errBody?.error?.message || JSON.stringify(errBody));
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.warn("[describeImage]", e.message);
    return null;
  }
}

// ── OpenAI Vision: Texte aus Print-Bild extrahieren (Anzeigen, Plakate etc.) ─
async function describePrintImageWithAI(imageUrl) {
  const key = window.AI_CONFIG.openaiKey;
  if (!key || !imageUrl) return null;
  const prompt = "Lies alle sichtbaren Texte, Überschriften, Slogans, Kampagnentitel und markanten Begriffe aus diesem Print-Werbemittel (Anzeige, Plakat, Broschüre, Flyer). Gib eine kompakte Zusammenfassung (2–3 Sätze) mit allen lesbaren Textinhalten und dem Kernthema. Antworte auf Deutsch. Keine Einleitung, direkt zur Sache.";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: [
            { type: "text",      text: prompt },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        }],
      }),
    });
    if (!res.ok) { console.warn("[describePrintImage] HTTP", res.status); return null; }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.warn("[describePrintImage]", e.message);
    return null;
  }
}

// ── PDF Text-Extraktion + KI-Analyse ─────────────────────────────────────────
async function describePdfWithAI(pdfUrl) {
  const key = window.AI_CONFIG.openaiKey;
  if (!key || !pdfUrl || !window.pdfjsLib) return null;
  try {
    // 1. Text aus den ersten 3 Seiten mit PDF.js extrahieren
    const pdfDoc = await window.pdfjsLib.getDocument({ url: pdfUrl, withCredentials: false }).promise;
    const pageCount = Math.min(pdfDoc.numPages, 3);
    let fullText = "";
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      // Zeilenwechsel herstellen (y-Position Sprünge)
      let lastY = null;
      const lines = [];
      content.items.forEach(item => {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) lines.push("\n");
        lines.push(item.str);
        lastY = item.transform[5];
      });
      fullText += lines.join("") + "\n\n";
    }
    fullText = fullText.trim().slice(0, 4000); // max Tokens begrenzen
    if (!fullText) return null;

    // 2. GPT analysiert den Text
    const sysPrompt = "Du analysierst den Textinhalt von Print-Dokumenten (Broschüren, Anzeigen, Flyer). Extrahiere Headlines, prägnante Begriffe und Kernaussagen. Antworte auf Deutsch in 2–3 kompakten Sätzen, die die wichtigsten Begriffe und das Thema des Dokuments wiedergeben. Keine Einleitung, direkt zur Sache.";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user",   content: `Dokument-Text:\n\n${fullText}` },
        ],
      }),
    });
    if (!res.ok) { console.warn("[describePdf] HTTP", res.status); return null; }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.warn("[describePdf]", e.message);
    return null;
  }
}

// ── OpenAI Vision: fotografische Attribute analysieren ───────────────────────
// Gibt ein Array deutscher Begriffe zurück, z.B. ["Querformat","Totale","Bokeh"]
// Orientierung wird direkt aus ratio berechnet — kein AI-Call nötig.
const PHOTO_ATTR_PROMPT = `Du bist ein erfahrener Fotograf und Bildredakteur. Analysiere dieses Foto präzise und benenne alle klar erkennbaren fotografischen Eigenschaften.

BILDAUSSCHNITT (genau einen wählen):
Close-up, Detailaufnahme, Nahaufnahme, Halbnahaufnahme, Halbtotale, Totale, Weiteinstellung

PERSPEKTIVE (genau eine wählen):
Augenhöhe, Vogelperspektive, Froschperspektive, Untersicht, Schrägsicht, Draufsicht

OPTIK / BRENNWEITE (falls erkennbar):
Weitwinkel, Normalobjektiv, Teleobjektiv, Makroaufnahme, Fisheye

SCHÄRFE (falls erkennbar — mehrere möglich):
Bokeh, Geringe Tiefenschärfe, Große Tiefenschärfe, Unscharf, Bewegungsunschärfe, Verwackelt, Selektive Schärfe

LICHT (einen oder mehrere wählen):
Natürliches Licht, Studioaufnahme, Gegenlicht, Kunstlicht, Blitzlicht, Silhouette, Hartes Licht, Weiches Licht, Sonnenlicht, Schattenwurf, Nachtaufnahme, Gegenlicht-Silhouette

FARBE / TONALITÄT (falls erkennbar):
Schwarzweiß, Sepia, Monochrom, Pastellfarben, Kräftige Farben, Warme Töne, Kalte Töne, Entsättigt, Farbkontrast

BILDSTIMMUNG (einen oder mehrere wählen):
Dynamisch, Ruhig, Dramatisch, Lebendig, Minimalistisch, High-Key, Low-Key, Verspielt, Elegant, Emotional, Melancholisch, Energetisch

BESONDERE MERKMALE (falls eindeutig erkennbar):
Spiegelung, Symmetrie, Langzeitbelichtung, Mehrfachbelichtung, HDR, Unschärfeverlauf, Rahmung, Diagonale Komposition, Führende Linien

Antworte NUR mit einem JSON-Array. Nenne ausschließlich klar erkennbare Eigenschaften — lieber mehr als zu wenig.
Beispiel: ["Nahaufnahme","Augenhöhe","Bokeh","Geringe Tiefenschärfe","Natürliches Licht","Warme Töne","Ruhig","Selektive Schärfe"]`;

async function analyzePhotoAttrsWithAI(imageUrl, ratio) {
  const key = window.AI_CONFIG?.openaiKey;
  if (!key || !imageUrl) return null;
  const attrs = [];
  // Orientierung aus ratio ableiten — kein AI-Call
  if (ratio != null) {
    if (ratio > 1.25)      attrs.push("Querformat");
    else if (ratio < 0.8)  attrs.push("Hochformat");
    else                   attrs.push("Quadratisch");
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: [
            { type: "text",      text: PHOTO_ATTR_PROMPT },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn("[photoAttrs] HTTP", res.status, errBody?.error?.message || JSON.stringify(errBody));
      console.warn("[photoAttrs] URL used:", imageUrl?.substring(0, 100));
      return attrs.length ? attrs : null;
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "[]";
    // JSON-Array aus der Antwort extrahieren (auch wenn GPT Markdown-Fences dazufügt)
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const aiAttrs = JSON.parse(match[0]);
      attrs.push(...aiAttrs.filter(a => typeof a === "string"));
    }
    return attrs.length ? attrs : null;
  } catch (e) {
    console.warn("[photoAttrs]", e.message);
    return attrs.length ? attrs : null;
  }
}

// Batch-write helper (Firestore limit: 500 ops per batch)
async function writeBatch(collection, docs) {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach(doc => {
      batch.set(tenantCol(collection).doc(doc.id), doc);
    });
    await batch.commit();
  }
}

// Ensure "Nicht zugeordnet" folders exist (idempotent migration)
async function seedUnsortedFolders() {
  const [imgSnap, pdfSnap] = await Promise.all([
    tenantCol("folders").doc("f-unsorted").get(),
    tenantCol("pdfFolders").doc("p-unsorted").get(),
  ]);
  const ops = [];
  if (!imgSnap.exists) {
    const f = (window.FOLDERS || []).find(x => x.id === "f-unsorted");
    if (f) ops.push(tenantCol("folders").doc("f-unsorted").set(f));
  }
  if (!pdfSnap.exists) {
    const f = (window.PDF_FOLDERS || []).find(x => x.id === "p-unsorted");
    if (f) ops.push(tenantCol("pdfFolders").doc("p-unsorted").set(f));
  }
  if (ops.length) { await Promise.all(ops); console.log("✓ Nicht-zugeordnet folders seeded"); }
}

// Seed all mock data on first load if Firestore is empty for this tenant
async function seedIfEmpty() {
  const probe = await tenantCol("folders").limit(1).get();
  if (!probe.empty) {
    // DB already seeded — ensure new content exists
    await seedPrintTags();
    await seedUnsortedFolders();
    await seedTagCategories();
    await deleteUnassignedTagDocs();   // remove any persisted t-unassigned-* docs
    await migrateAssetUnassignedTags();
    return;
  }

  await writeBatch("folders",    window.FOLDERS);
  await writeBatch("pdfFolders", window.PDF_FOLDERS);
  await writeBatch("assets",     window.ASSETS);
  await writeBatch("tags",       window.TAGS);
  await writeBatch("team",       window.TEAM);
  await writeBatch("sharedLinks",window.SHARED_LINKS);
  await writeBatch("activity",   window.ACTIVITY);

  console.log(`✓ Firestore initial seed complete (tenant: ${window.TENANT_ID})`);
}

// Ensure print-specific tags exist in Firestore (idempotent migration)
async function seedPrintTags() {
  const snap = await tenantCol("tags").where("area", "==", "print").limit(1).get();
  if (!snap.empty) return; // already present
  const printTags = (window.TAGS || []).filter(t => t.area === "print");
  if (printTags.length === 0) return;
  await writeBatch("tags", printTags);
  console.log("✓ Print tags seeded");
}

// Virtual tags for "Nicht zugeordnet" — exist only in memory, never in Firestore.
// Stored as IDs on assets for filtering, but tag documents are NOT persisted.
const VIRTUAL_UNASSIGNED_TAGS = [
  { id: "t-unassigned-motiv",    name: "Nicht zugeordnet", name_en: "Unassigned", category: "motiv",    hue: 0, isVirtual: true },
  { id: "t-unassigned-kampagne", name: "Nicht zugeordnet", name_en: "Unassigned", category: "kampagne", hue: 0, isVirtual: true },
  { id: "t-unassigned-medium",   name: "Nicht zugeordnet", name_en: "Unassigned", category: "medium",   hue: 0, isVirtual: true },
];
window.VIRTUAL_UNASSIGNED_TAGS = VIRTUAL_UNASSIGNED_TAGS;

// Delete any lingering t-unassigned-* tag documents from Firestore (one-time cleanup)
async function deleteUnassignedTagDocs() {
  try {
    const snap = await tenantCol("tags").get();
    const stale = snap.docs.filter(d => d.id.startsWith("t-unassigned-"));
    if (!stale.length) return;
    const batch = db.batch();
    stale.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`✓ Deleted ${stale.length} stale unassigned tag docs`);
  } catch (e) {
    console.warn("[deleteUnassignedTagDocs]", e.message);
  }
}

// Migrate existing assets: write t-unassigned-{cat} for each category with no tag
async function migrateAssetUnassignedTags() {
  try {
    const settingsSnap = await tenantSettingsDoc().get();
    if (settingsSnap.exists && settingsSnap.data()?.unassignedTagsMigratedAt) return;

    const allTags = window.TAGS || [];
    const CATS = ["motiv", "kampagne", "medium"];

    const snap = await tenantCol("assets").get();
    if (snap.empty) {
      await tenantSettingsDoc().set({ unassignedTagsMigratedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return;
    }

    const toUpdate = [];
    snap.docs.forEach(doc => {
      const a = doc.data();
      const newTags = [...(a.tags || [])];
      let changed = false;
      CATS.forEach(cat => {
        const hasTag = newTags.some(tid => allTags.find(t => t.id === tid)?.category === cat);
        if (!hasTag) {
          const uid = `t-unassigned-${cat}`;
          if (!newTags.includes(uid)) { newTags.push(uid); changed = true; }
        }
      });
      if (changed) toUpdate.push({ ...a, tags: newTags });
    });

    if (toUpdate.length > 0) {
      // Use update (not set) to avoid overwriting concurrent edits
      for (let i = 0; i < toUpdate.length; i += 400) {
        const batch = db.batch();
        toUpdate.slice(i, i + 400).forEach(asset => {
          batch.update(tenantCol("assets").doc(asset.id), { tags: asset.tags });
        });
        await batch.commit();
      }
    }

    await tenantSettingsDoc().set({ unassignedTagsMigratedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    console.log(`✓ Unassigned tag migration: ${toUpdate.length} assets updated`);
  } catch (e) {
    console.warn("[migrateAssetUnassignedTags]", e.message);
  }
}

// Ensure tag category fields are up-to-date in Firestore
async function seedTagCategories() {
  const tagsWithCat = (window.TAGS || []).filter(t => t.category);
  if (tagsWithCat.length === 0) return;
  const snap = await tenantCol("tags").where("category", "==", "motiv").limit(1).get();
  if (!snap.empty) return; // already migrated
  await writeBatch("tags", tagsWithCat);
  console.log("✓ Tag categories migrated");
}

// ── Real-time subscriptions ───────────────────────────────────────────────────

function subscribeToFolders(cb) {
  return tenantCol("folders").onSnapshot(snap => {
    const docs = snap.docs.map(d => d.data());
    docs.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    cb(docs);
  });
}

function subscribeToPdfFolders(cb) {
  return tenantCol("pdfFolders").onSnapshot(snap => {
    const docs = snap.docs.map(d => d.data());
    docs.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    cb(docs);
  });
}

function subscribeToAssets(cb) {
  return tenantCol("assets").onSnapshot(snap => {
    cb(snap.docs.map(d => d.data()));
  });
}

function subscribeToActivity(cb) {
  return tenantCol("activity")
    .orderBy("at", "desc")
    .onSnapshot(snap => cb(snap.docs.map(d => d.data())));
}

function subscribeToSharedLinks(cb) {
  return tenantCol("sharedLinks")
    .onSnapshot(snap => {
      const docs = snap.docs.map(d => d.data());
      // Neueste zuerst (createdAt kann beim ersten Snapshot noch null sein → ans Ende)
      docs.sort((a, b) => {
        const am = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bm = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bm - am;
      });
      cb(docs);
    });
}

function subscribeToTags(cb) {
  return tenantCol("tags").onSnapshot(snap => cb(snap.docs.map(d => d.data())));
}

function subscribeToTeam(cb) {
  return tenantCol("team").onSnapshot(snap => cb(snap.docs.map(d => d.data())));
}

function subscribeToTagCollections(cb) {
  return tenantCol("tagCollections").onSnapshot(snap => {
    const docs = snap.docs.map(d => d.data());
    docs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    cb(docs);
  });
}
async function dbSaveTagCollection(col) {
  await tenantCol("tagCollections").doc(col.id).set(col);
}
async function dbDeleteTagCollection(id) {
  await tenantCol("tagCollections").doc(id).delete();
}

// ══════════════════════════════════════════════════════════════════════════════
//  NUTZERGRUPPEN & BEREICHE (Rechtesystem, portiert aus contextr)
// ══════════════════════════════════════════════════════════════════════════════

// ── Bereiche (Scopes) — eine Liste im Doc settings/bereiche ──────────────────
function subscribeToBereiche(cb) {
  return tenantDoc("settings", "bereiche").onSnapshot(snap => {
    const liste = snap.exists ? (snap.data().liste || []) : [];
    cb(Array.isArray(liste) ? liste : []);
  });
}
async function dbSaveBereiche(liste) {
  await tenantDoc("settings", "bereiche").set({ liste }, { merge: true });
}

// ══════════════════════════════════════════════════════════════════════════════
//  BILDSPEICHER-BACKENDS (austauschbare Ablage der Original-Dateien pro Mandant)
//  Metadaten + Thumbnails bleiben IMMER auf Firebase. Nur das Original wandert
//  je nach aktivem Backend (firebase | onedrive).
//  tenants/{tid}/storageBackends/{id}: { id, name, type, active, isDefault, config }
// ══════════════════════════════════════════════════════════════════════════════
const DEFAULT_BACKEND_ID = "firebase";

function subscribeToStorageBackends(cb) {
  return tenantCol("storageBackends").onSnapshot(snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    window.STORAGE_BACKENDS = docs;
    cb(docs);
  });
}
// Legt beim ersten Aufruf ein Standard-Firebase-Backend an (idempotent).
async function ensureDefaultBackend() {
  const ref = tenantCol("storageBackends").doc(DEFAULT_BACKEND_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      id: DEFAULT_BACKEND_ID, name: "Firebase (Standard)", type: "firebase",
      active: true, isDefault: true, config: {},
      createdAt: new Date().toISOString(),
    });
  }
}
async function dbSaveStorageBackend(b) {
  const id = b.id || ("sb-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
  await tenantCol("storageBackends").doc(id).set({ ...b, id }, { merge: true });
  return id;
}
async function dbDeleteStorageBackend(id) {
  if (id === DEFAULT_BACKEND_ID) throw new Error("Standard-Backend kann nicht gelöscht werden.");
  await tenantCol("storageBackends").doc(id).delete();
}
async function dbSetStorageBackendActive(id, active) {
  await tenantCol("storageBackends").doc(id).set({ active: !!active }, { merge: true });
}
// Genau ein Standard-Ziel für neue Uploads: setzt isDefault exklusiv.
async function dbSetDefaultStorageBackend(id, allBackends) {
  const batch = db.batch();
  (allBackends || window.STORAGE_BACKENDS || []).forEach(b => {
    batch.set(tenantCol("storageBackends").doc(b.id), { isDefault: b.id === id }, { merge: true });
  });
  await batch.commit();
}
// Aktive Backend-IDs als Set (für Client-Filterung). Fehlt storageBackend am Asset,
// gilt es als Standard-Backend.
function activeBackendIds() {
  const list = window.STORAGE_BACKENDS || [];
  if (list.length === 0) return null; // noch nicht konfiguriert → kein Filter
  return new Set(list.filter(b => b.active).map(b => b.id));
}
// Filtert Assets auf die aktiven Backends. Null-Set (unkonfiguriert) → alles sichtbar.
function filterByBackend(assets) {
  const active = activeBackendIds();
  if (!active) return assets || [];
  return (assets || []).filter(a => active.has(a.storageBackend || DEFAULT_BACKEND_ID));
}
// Standard-Ziel für neue Uploads (Objekt bzw. ID).
function defaultBackend() {
  const list = window.STORAGE_BACKENDS || [];
  return list.find(b => b.isDefault && b.active) || list.find(b => b.active) || { id: DEFAULT_BACKEND_ID, type: "firebase" };
}
function defaultBackendId() { return defaultBackend().id; }
function backendById(id) { return (window.STORAGE_BACKENDS || []).find(b => b.id === id) || null; }

// Ermittelt den Speicherort des ORIGINALS eines Assets — aus dem gesetzten
// storageBackend, sonst aus Indizien (OneDrive-Referenz vs. Firebase-URL).
function storageInfo(asset) {
  const b = asset?.storageBackend ? backendById(asset.storageBackend) : null;
  if (b) return { id: b.id, type: b.type, name: b.name };
  if (asset?.storageRef?.itemId) return { id: "onedrive", type: "onedrive", name: "OneDrive" };
  if (asset?.storageUrl || asset?.storagePath) return { id: DEFAULT_BACKEND_ID, type: "firebase", name: "Firebase" };
  return { id: null, type: "unbekannt", name: "unbekannt" };
}

// Nachträgliches Ermitteln/Setzen des storageBackend-Feldes für den Bestand.
// forceAll=false: nur Assets OHNE Feld. forceAll=true: alle neu aus Indizien ableiten.
async function dbBackfillStorageBackends(forceAll = false) {
  const snap = await tenantCol("assets").get();
  const onedrive = (window.STORAGE_BACKENDS || []).find(b => b.type === "onedrive");
  let updated = 0, already = 0;
  let batch = db.batch(), n = 0;
  for (const doc of snap.docs) {
    const a = doc.data();
    if (a.storageBackend && !forceAll) { already++; continue; }
    const derived = a.storageRef?.itemId
      ? (onedrive ? onedrive.id : "onedrive")
      : DEFAULT_BACKEND_ID;                 // Altbestand ohne Referenz → Firebase
    if (a.storageBackend === derived) { already++; continue; }
    batch.set(doc.ref, { storageBackend: derived }, { merge: true });
    updated++;
    if (++n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n > 0) await batch.commit();
  return { total: snap.size, updated, already };
}

// ── OneDrive (Microsoft Graph) — Aufrufe der Cloud Functions ─────────────────
async function fnMsTestConnection() {
  return (await window._picpopFunctions.httpsCallable("msTestConnection")()).data;
}
async function fnMsCreateUploadSession(filename, assetId) {
  return (await window._picpopFunctions.httpsCallable("msCreateUploadSession")({ filename, assetId })).data;
}
async function fnMsGetDownloadUrl(itemId) {
  return (await window._picpopFunctions.httpsCallable("msGetDownloadUrl")({ itemId })).data;
}
// Blob/Datei per Upload-Session (chunked) ins OneDrive laden → gibt driveItem zurück.
async function uploadBlobToOneDrive(blob, filename, assetId, onProgress) {
  const { uploadUrl } = await fnMsCreateUploadSession(filename, assetId);
  const CHUNK = 320 * 1024 * 20; // 6,4 MB (Vielfaches von 320 KiB, Graph-Vorgabe)
  const total = blob.size;
  let start = 0, last = null;
  while (start < total) {
    const end = Math.min(start + CHUNK, total);
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Range": `bytes ${start}-${end - 1}/${total}` },
      body: blob.slice(start, end),
    });
    if (res.status === 200 || res.status === 201) last = await res.json();
    else if (res.status !== 202) throw new Error("OneDrive-Upload HTTP " + res.status);
    start = end;
    onProgress?.(Math.round(end / total * 100));
  }
  if (!last?.id) throw new Error("OneDrive-Upload ohne Item-ID abgeschlossen");
  return last; // { id, name, size, parentReference:{driveId}, ... }
}
async function uploadToOneDrive(file, assetId, onProgress) {
  return uploadBlobToOneDrive(file, file.name, assetId, onProgress);
}
// Liefert die anzeigbare/herunterladbare URL des ORIGINALS (Firebase: direkt;
// OneDrive: kurzlebige Graph-Download-URL).
async function resolveOriginalUrl(asset) {
  if (!asset) return null;
  const b = backendById(asset.storageBackend);
  if (b && b.type === "onedrive" && asset.storageRef?.itemId) {
    const r = await fnMsGetDownloadUrl(asset.storageRef.itemId);
    return r.downloadUrl;
  }
  return asset.storageUrl || null;
}

// ── Migration Firebase → OneDrive ────────────────────────────────────────────
// Assets, deren ORIGINAL noch auf Firebase liegt (Kandidaten für den Transfer).
async function listMigratableAssets() {
  const snap = await tenantCol("assets").get();
  return snap.docs.map(d => d.data()).filter(a => {
    const si = storageInfo(a);
    return si.type === "firebase" && (a.storageUrl || a.storagePath);
  });
}
// Vorab-Schätzung: Anzahl + Gesamtgröße der zu übertragenden Originale.
async function estimateMigration() {
  const list = await listMigratableAssets();
  const totalMB = list.reduce((s, a) => s + (Number(a.size) || 0), 0);
  return { count: list.length, totalMB, totalGB: totalMB / 1024, assets: list };
}
// Ein Asset übertragen: Original aus Firebase laden → ins OneDrive hochladen →
// Verknüpfung am Asset umbiegen (storageBackend/storageRef). Thumbnail + Metadaten
// bleiben unangetastet auf Firebase. deleteSource=true entfernt danach das Firebase-
// Original (gibt Speicher frei) — erst NACH erfolgreichem Upload + Doc-Update.
async function migrateAssetToOneDrive(asset, onedriveBackendId, deleteSource) {
  const url = asset.storageUrl || (asset.storagePath ? await storage.ref(asset.storagePath).getDownloadURL() : null);
  if (!url) throw new Error("kein Firebase-Original");
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Download HTTP " + resp.status);
  const blob = await resp.blob();
  const filename = asset.storagePath ? asset.storagePath.split("/").pop() : ((asset.title || asset.id) + "." + (asset.format || "jpg").toLowerCase());
  const item = await uploadBlobToOneDrive(blob, filename, asset.id);
  const storageRef = { itemId: item.id, driveId: item.parentReference?.driveId || null, name: item.name };
  const patch = { storageBackend: onedriveBackendId, storageRef };
  await tenantCol("assets").doc(asset.id).update(patch);
  // Erst nach erfolgreichem Umbiegen das Firebase-Original löschen
  if (deleteSource && asset.storagePath) {
    try {
      await storage.ref(asset.storagePath).delete();
      await tenantCol("assets").doc(asset.id).update({ storageUrl: null, storagePath: null });
    } catch (e) { console.warn("[migration] Firebase-Löschung", asset.id, e.message); }
  }
  return { bytes: blob.size };
}

// ── Gruppen ──────────────────────────────────────────────────────────────────
function subscribeToGroups(cb) {
  return tenantCol("groups").onSnapshot(snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));
    cb(docs);
  });
}
async function dbSaveGroup(group) {
  const id = group.id || ("g-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6));
  await tenantCol("groups").doc(id).set({ ...group, id }, { merge: true });
  return id;
}
async function dbDeleteGroup(id) {
  await tenantCol("groups").doc(id).delete();
}

// CSV-Import von Nutzergruppen (Microsoft-Entra-ID-Export).
// Erwartet Kopfzeile mit Spalten "displayName" und "id" (Reihenfolge egal,
// Trennzeichen ; oder ,). Entfernt Präfix "SG_<tenant>_" und macht _/- zu Leerzeichen.
function parseGroupsCsv(text, tenantId) {
  const clean = String(text || "").replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ";" : ",";
  const strip = s => String(s || "").trim().replace(/^"|"$/g, "");
  const header = lines[0].split(sep).map(h => strip(h).toLowerCase());
  const iName = header.indexOf("displayname");
  const iId = header.indexOf("id");
  if (iName < 0) return [];
  const prefix = new RegExp("^sg_" + (tenantId || "").toLowerCase() + "_", "i");
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(strip);
    const externalName = cols[iName];
    if (!externalName) continue;
    const externalId = iId >= 0 ? cols[iId] : "";
    const name = externalName.replace(prefix, "").replace(/^SG_[^_]+_/i, "").replace(/[_-]+/g, " ").trim();
    out.push({ name: name || externalName, externalName, externalId, quelle: "csv" });
  }
  return out;
}

// ── Cloud-Function-Aufrufe (Rechte/Claims serverseitig) ──────────────────────
async function fnListTenantUsers(tenantId) {
  const fn = window._picpopFunctions.httpsCallable("listTenantUsers");
  const res = await fn({ tenantId: tenantId || window.TENANT_ID });
  return res.data?.users || [];
}
async function fnSetUserGroups(uid, groupIds, tenantId) {
  const fn = window._picpopFunctions.httpsCallable("setUserGroups");
  return (await fn({ tenantId: tenantId || window.TENANT_ID, uid, groupIds })).data;
}
async function fnSetUserRole(uid, role, tenantId) {
  const fn = window._picpopFunctions.httpsCallable("setUserRole");
  return (await fn({ tenantId: tenantId || window.TENANT_ID, uid, role })).data;
}
async function fnRefreshTenantClaims(tenantId) {
  const fn = window._picpopFunctions.httpsCallable("refreshTenantClaims");
  return (await fn({ tenantId: tenantId || window.TENANT_ID })).data;
}
// Gefahrenzone: alle Backend-Konten eines Mandanten löschen (Superadmin ausgenommen).
// `confirm` muss exakt die tenantId sein.
async function fnPurgeTenantUsers(tenantId, confirm) {
  const fn = window._picpopFunctions.httpsCallable("adminPurgeTenantUsers");
  return (await fn({ tenantId: tenantId || window.TENANT_ID, confirm })).data;
}

// ── Share links ──────────────────────────────────────────────────────────────
// Zwei Speicherorte, bewusst getrennt:
//  1. Root `shareLinks/{slug}` — vollständige Nutzlast (assets etc.), OHNE Login
//     lesbar, damit externe Empfänger den Link öffnen können.
//  2. Tenant `tenants/{id}/sharedLinks/{slug}` — leichter Index-Eintrag (ohne die
//     schwere assets-Liste) für die interne Übersicht „Geteilte Links". Diese
//     Subsammlung ist wie assets/folders sauber pro Tenant abgesichert und wird
//     von subscribeToSharedLinks gelistet.
async function dbCreateShareLink(slug, data) {
  const createdAt = firebase.firestore.FieldValue.serverTimestamp();
  // 1. Vollständiger, öffentlich lesbarer Eintrag
  await db.collection("shareLinks").doc(slug).set({
    ...data,
    tenant: window.TENANT_ID,
    createdAt,
  });
  // 2. Schlanker Index-Eintrag im Tenant (ohne assets-Snapshot — nur Metadaten)
  const { assets, ...meta } = data;
  await tenantCol("sharedLinks").doc(slug).set({
    ...meta,
    id: slug,
    assetCount: Array.isArray(assets) ? assets.length : 0,
    createdAt,
  });
}
async function dbGetShareLink(slug) {
  const doc = await db.collection("shareLinks").doc(slug).get();
  return doc.exists ? doc.data() : null;
}
// Einstellungen eines bestehenden Links nachträglich ändern (nicht die assets).
// Schreibt in beide Dokumente (öffentlich + Tenant-Index).
async function dbUpdateShareLink(slug, patch) {
  await Promise.all([
    db.collection("shareLinks").doc(slug).set(patch, { merge: true }),
    tenantCol("sharedLinks").doc(slug).set(patch, { merge: true }),
  ]);
}
async function dbDeleteShareLink(slug) {
  await Promise.all([
    db.collection("shareLinks").doc(slug).delete(),
    tenantCol("sharedLinks").doc(slug).delete(),
  ]);
}

// ── Write operations ──────────────────────────────────────────────────────────

async function dbSaveAsset(asset) {
  await tenantCol("assets").doc(asset.id).set(asset);
}

async function dbDeleteAsset(asset) {
  await tenantCol("assets").doc(asset.id).delete();
  if (asset.storagePath) {
    try { await storage.ref(asset.storagePath).delete(); } catch (_) {}
  }
}

async function dbSaveFolder(folder) {
  await tenantCol("folders").doc(folder.id).set(folder);
}

async function dbDeleteFolder(id) {
  await tenantCol("folders").doc(id).delete();
  const snap = await tenantCol("assets").where("folderId", "==", id).get();
  if (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { folderId: "f-unsorted" }));
    await batch.commit();
  }
}

async function dbSavePdfFolder(folder) {
  await tenantCol("pdfFolders").doc(folder.id).set(folder);
}

async function dbDeletePdfFolder(id) {
  await tenantCol("pdfFolders").doc(id).delete();
  const snap = await tenantCol("assets").where("folderId", "==", id).get();
  if (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { folderId: "p-unsorted" }));
    await batch.commit();
  }
}

async function dbSaveTag(tag) {
  await tenantCol("tags").doc(tag.id).set(tag);
}
async function dbDeleteTag(id) {
  await tenantCol("tags").doc(id).delete();
}
async function dbSaveTeamMember(member) {
  await tenantCol("team").doc(member.id).set(member);
}
async function dbDeleteTeamMember(id) {
  await tenantCol("team").doc(id).delete();
}

async function dbReorderFolders(orderedIds, isPdf = false) {
  const col = isPdf ? "pdfFolders" : "folders";
  const batch = db.batch();
  orderedIds.forEach((id, i) => {
    batch.update(tenantCol(col).doc(id), { sortOrder: i });
  });
  await batch.commit();
}

// ── Extract file creation date ────────────────────────────────────────────────
// Tries EXIF DateTimeOriginal from JPEG binary; falls back to file.lastModified.
async function getFileDate(file) {
  if (file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) {
    try {
      const buf  = await file.slice(0, 65536).arrayBuffer();
      const view = new DataView(buf);
      if (view.getUint16(0) !== 0xFFD8) throw new Error("not jpeg");

      let offset = 2;
      while (offset < view.byteLength - 4) {
        const marker = view.getUint16(offset);
        const segLen = view.getUint16(offset + 2); // includes the 2 length bytes
        if (marker === 0xFFE1) {
          // APP1 — check for "Exif" header
          const hdr = String.fromCharCode(
            view.getUint8(offset + 4), view.getUint8(offset + 5),
            view.getUint8(offset + 6), view.getUint8(offset + 7)
          );
          if (hdr === "Exif") {
            const tiff       = offset + 10; // TIFF data starts after "Exif\x00\x00"
            const le         = view.getUint16(tiff) === 0x4949;
            const u16        = o => view.getUint16(tiff + o, le);
            const u32        = o => view.getUint32(tiff + o, le);
            const ifd0Off    = u32(4);
            const ifd0Count  = u16(ifd0Off);

            // Find ExifIFD pointer (tag 0x8769) in IFD0
            let exifIfdOff = null;
            for (let i = 0; i < ifd0Count; i++) {
              const e = ifd0Off + 2 + i * 12;
              if (u16(e) === 0x8769) { exifIfdOff = u32(e + 8); break; }
            }

            // Search for DateTimeOriginal (0x9003) in ExifIFD
            const findDT = ifdOff => {
              if (ifdOff == null) return null;
              const cnt = u16(ifdOff);
              for (let i = 0; i < cnt; i++) {
                const e = ifdOff + 2 + i * 12;
                if (u16(e) !== 0x9003) continue;
                const dataOff = u32(e + 8); // ASCII offset from TIFF start
                let s = "";
                for (let j = 0; j < 19; j++) s += String.fromCharCode(view.getUint8(tiff + dataOff + j));
                const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
                if (m) return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]).toISOString();
              }
              return null;
            };

            const dt = findDT(exifIfdOff);
            if (dt) return dt;
          }
        }
        if (segLen < 2) break; // malformed
        offset += 2 + segLen;
      }
    } catch (_) {}
  }
  // Fallback: OS file modification date
  return new Date(file.lastModified).toISOString();
}

async function uploadAsset(file, folderId, tags = [], onProgress = null, author = "", authorRole = "in_house", area = "images", batchId = null) {
  const id = "a-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const ext = file.name.split(".").pop().toLowerCase();
  // Ziel-Backend für das ORIGINAL bestimmen (Thumbnail geht immer zu Firebase).
  const backend = defaultBackend();
  let storageUrl = null, storagePath = null, storageRef = null;
  if (backend.type === "onedrive") {
    const item = await uploadToOneDrive(file, id, onProgress);
    storageRef = { itemId: item.id, driveId: item.parentReference?.driveId || null, name: item.name };
  } else {
    storagePath = `tenants/${window.TENANT_ID}/assets/${id}/${file.name}`;
    const ref = storage.ref(storagePath);
    await new Promise((resolve, reject) => {
      const task = ref.put(file);
      task.on("state_changed",
        (snap) => { onProgress?.(Math.round(snap.bytesTransferred / snap.totalBytes * 100)); },
        reject, resolve);
    });
    storageUrl = await ref.getDownloadURL();
  }

  let width = 0, height = 0, ratio = 1.5;
  let pages = 1;
  let widthMm = null, heightMm = null;
  let thumbnailUrl = null;
  let aiImageDataUrl = null; // base64 data URL of thumbnail — used for AI calls to avoid Storage URL issues

  if (isPdf) {
    if (window.pdfjsLib) {
      try {
        // Use local blob URL — no CORS issues, file is still in memory
        const blobUrl = URL.createObjectURL(file);
        const resp    = await fetch(blobUrl);
        const data    = new Uint8Array(await resp.arrayBuffer());
        URL.revokeObjectURL(blobUrl);

        const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
        pages = pdfDoc.numPages;
        const page = await pdfDoc.getPage(1);
        const vp   = page.getViewport({ scale: 1 });
        // Physical dimensions: PDF points → mm (1 pt = 25.4/72 mm)
        const toMm = pt => Math.round(pt * 25.4 / 72);
        widthMm  = toMm(vp.width);
        heightMm = toMm(vp.height);
        ratio = vp.width / vp.height || 0.71;

        // Render first page: scale so the LONGEST side = 1400 px
        const THUMB_LONG = 1400;
        const thumbScale = THUMB_LONG / Math.max(vp.width, vp.height);
        const thumbVp    = page.getViewport({ scale: thumbScale });
        const canvas     = document.createElement("canvas");
        canvas.width     = Math.round(thumbVp.width);
        canvas.height    = Math.round(thumbVp.height);
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: thumbVp }).promise;

        // Upload thumbnail to Firebase Storage
        const thumbBlob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.90));
        const thumbRef  = storage.ref(`tenants/${window.TENANT_ID}/thumbnails/${id}/thumb.jpg`);
        await thumbRef.put(thumbBlob);
        thumbnailUrl = await thumbRef.getDownloadURL();
      } catch (e) {
        console.warn("[uploadAsset] PDF thumbnail failed:", e.message);
        ratio = 0.71;
        pages = 1;
      }
    }
  } else {
    // Generate JPEG thumbnail from local file — no CORS issues, file still in memory.
    // 800px Längsseite: für Grid-Kacheln (160–280px, auch @2x Retina) mehr als genug,
    // ~75% kleinere Dateien als zuvor (1400px) → deutlich schnelleres Laden im Raster.
    const THUMB_LONG = 800;
    try {
      const blobUrl = URL.createObjectURL(file);
      const imgEl = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = blobUrl;
      });
      width  = imgEl.naturalWidth;
      height = imgEl.naturalHeight;
      ratio  = width / height || 1.5;

      const scale  = Math.min(1, THUMB_LONG / Math.max(width, height));
      const cv     = document.createElement("canvas");
      cv.width     = Math.round(width  * scale);
      cv.height    = Math.round(height * scale);
      cv.getContext("2d").drawImage(imgEl, 0, 0, cv.width, cv.height);
      // Capture data URL for AI analysis — avoids Firebase Storage URL access issues
      aiImageDataUrl = cv.toDataURL("image/jpeg", 0.85);
      const thumbBlob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.82));
      const thumbRef  = storage.ref(`tenants/${window.TENANT_ID}/thumbnails/${id}/thumb.jpg`);
      await thumbRef.put(thumbBlob);
      thumbnailUrl = await thumbRef.getDownloadURL();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.warn("[uploadAsset] image thumbnail failed:", e.message);
      // Fallback: read dimensions from storageUrl (no thumbnail generated)
      await new Promise(res => {
        const img = new Image();
        img.onload = () => { width = img.naturalWidth; height = img.naturalHeight; ratio = width / height || 1.5; res(); };
        img.onerror = res;
        img.src = storageUrl;
      });
    }
  }

  // KI-Beschreibung — je nach Typ und Bereich unterschiedliche Analyse
  // PDF            → Text-Extraktion via PDF.js + GPT
  // Bild in Print  → Vision mit OCR/Text-Fokus (Anzeigen, Plakate)
  // Bild in Images → Vision mit Bildbeschreibungs-Prompt
  let aiDescription = "";
  let photoAttrs = null;
  if (storageUrl) {
    // Immer laden — gecachter leerer String würde sonst die Prüfung überspringen
    await loadAiConfig();
    const aiKey = window.AI_CONFIG?.openaiKey;
    // Bevorzuge base64 data URL (Browser-lokal), Fallback auf Storage URL
    const aiUrl = aiImageDataUrl || storageUrl;
    console.log("[uploadAsset] AI key:", !!aiKey, "| dataUrl:", !!aiImageDataUrl, "| area:", area, "| isPdf:", isPdf);
    if (aiKey) {
      try {
        if (isPdf) {
          aiDescription = (await describePdfWithAI(storageUrl)) || "";
        } else if (area === "print") {
          aiDescription = (await describePrintImageWithAI(aiUrl)) || "";
        } else {
          // Foto: Beschreibung + Foto-Attribute parallel analysieren
          const [desc, attrs] = await Promise.all([
            describeImageWithAI(aiUrl).catch(e => { console.warn("[uploadAsset] describeImage failed:", e.message); return ""; }),
            analyzePhotoAttrsWithAI(aiUrl, ratio).catch(e => { console.warn("[uploadAsset] photoAttrs failed:", e.message); return null; }),
          ]);
          aiDescription = desc || "";
          photoAttrs = attrs;
          console.log("[uploadAsset] AI done — desc:", !!aiDescription, "| attrs:", photoAttrs);
        }
      } catch (e) {
        console.warn("[uploadAsset] AI analysis failed:", e.message);
      }
    }
  }

  const takenAt = await getFileDate(file);

  // Auto-assign "Nicht zugeordnet" for any category with no tag yet
  const UNASSIGNED_CATS = ["motiv", "kampagne", "medium"];
  const finalTags = [...tags];
  UNASSIGNED_CATS.forEach(cat => {
    const hasTag = finalTags.some(tid => (window.TAGS || []).find(t => t.id === tid)?.category === cat);
    if (!hasTag) {
      const uid = `t-unassigned-${cat}`;
      if (!finalTags.includes(uid)) finalTags.push(uid);
    }
  });

  const asset = {
    id,
    title: file.name.replace(/\.[^.]+$/, ""),
    kind: isPdf ? "pdf" : "image",
    format: ext.toUpperCase(),
    folderId,
    tags: finalTags,
    storageUrl,
    storagePath,
    storageRef,                    // OneDrive: { itemId, driveId, name } — sonst null
    thumbnailUrl,
    storageBackend: backend.id,    // in welchem Backend liegt das Original
    size: parseFloat((file.size / 1024 / 1024).toFixed(1)),
    date: new Date().toISOString(),
    takenAt,
    area,
    author,
    authorRole,
    hue: Math.floor(Math.random() * 360),
    ratio,
    batchId: batchId || null,
    notes: "",
    aiDescription,
    photoAttrs: photoAttrs || [],
    campaign: "",
    embargo: null,
    ...(isPdf ? { pages, ...(widthMm ? { widthMm, heightMm } : {}) } : { width, height }),
  };

  await tenantCol("assets").doc(id).set(asset);
  return asset;
}

// ── Thumbnail aus einem bereits geladenen <img> erzeugen + hochladen ─────────
// Zeichnet das (CORS-sauber geladene) Bild auf ein Canvas, skaliert auf longPx,
// lädt das JPEG hoch und schreibt thumbnailUrl (+ ratio) ins Asset-Dokument.
async function _uploadThumbFromImg(asset, imgEl, longPx = 800) {
  const w = imgEl.naturalWidth, h = imgEl.naturalHeight;
  if (!w || !h) throw new Error("Bild ohne Maße");
  const ratio = w / h || asset.ratio || 1.5;
  const scale = Math.min(1, longPx / Math.max(w, h));
  const cv = document.createElement("canvas");
  cv.width  = Math.round(w * scale);
  cv.height = Math.round(h * scale);
  cv.getContext("2d").drawImage(imgEl, 0, 0, cv.width, cv.height);
  const thumbBlob = await new Promise((r, rej) => cv.toBlob(b => b ? r(b) : rej(new Error("toBlob fehlgeschlagen (Canvas getaintet?)")), "image/jpeg", 0.82));
  const thumbRef = storage.ref(`tenants/${window.TENANT_ID}/thumbnails/${asset.id}/thumb.jpg`);
  await thumbRef.put(thumbBlob);
  const thumbnailUrl = await thumbRef.getDownloadURL();
  await tenantCol("assets").doc(asset.id).update({ thumbnailUrl, ratio });
  return { thumbnailUrl, bytes: thumbBlob.size };
}

// Nachträglich (Batch): lädt das Originalbild crossOrigin und erzeugt ein Thumbnail.
async function regenerateThumbnail(asset, longPx = 800) {
  if (!asset?.id || !asset.storageUrl) throw new Error("kein storageUrl");
  const imgEl = await new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Bild nicht ladbar (CORS?)"));
    i.src = asset.storageUrl;
  });
  return _uploadThumbFromImg(asset, imgEl, longPx);
}

// Selbstheilung: erzeugt aus einem im Grid bereits geladenen <img> ein Thumbnail.
// Wird von AssetImg aufgerufen, wenn ein Bild OHNE thumbnailUrl angezeigt wurde.
async function backfillThumbnailFromImg(asset, imgEl, longPx = 800) {
  if (!asset?.id || asset.thumbnailUrl || !imgEl) return null;
  try {
    return await _uploadThumbFromImg(asset, imgEl, longPx);
  } catch (e) {
    console.warn("[thumb-backfill]", asset.id, e.message);
    return null;
  }
}

Object.assign(window, {
  // Nutzergruppen & Rechte
  subscribeToBereiche, dbSaveBereiche,
  subscribeToStorageBackends, ensureDefaultBackend, dbSaveStorageBackend, dbDeleteStorageBackend,
  dbSetStorageBackendActive, dbSetDefaultStorageBackend, filterByBackend, activeBackendIds, defaultBackendId,
  defaultBackend, backendById, DEFAULT_BACKEND_ID, storageInfo, dbBackfillStorageBackends,
  fnMsTestConnection, fnMsCreateUploadSession, fnMsGetDownloadUrl, uploadToOneDrive, uploadBlobToOneDrive, resolveOriginalUrl,
  listMigratableAssets, estimateMigration, migrateAssetToOneDrive,
  subscribeToGroups, dbSaveGroup, dbDeleteGroup, parseGroupsCsv,
  fnListTenantUsers, fnSetUserGroups, fnSetUserRole, fnRefreshTenantClaims, fnPurgeTenantUsers,
  regenerateThumbnail,
  backfillThumbnailFromImg,
  db,
  storage,
  TENANT_ID: window.TENANT_ID,
  tenantCol,
  tenantDoc,
  tenantSettingsDoc,
  loadAiConfig,
  describeImageWithAI,
  describePrintImageWithAI,
  describePdfWithAI,
  analyzePhotoAttrsWithAI,
  seedIfEmpty,
  seedPrintTags,
  migrateAssetUnassignedTags,
  subscribeToFolders,
  subscribeToPdfFolders,
  subscribeToAssets,
  subscribeToActivity,
  subscribeToSharedLinks,
  dbCreateShareLink,
  dbGetShareLink,
  dbUpdateShareLink,
  dbDeleteShareLink,
  subscribeToTags,
  subscribeToTeam,
  subscribeToTagCollections,
  dbSaveTagCollection,
  dbDeleteTagCollection,
  uploadAsset,
  dbSaveAsset,
  dbDeleteAsset,
  dbSaveFolder,
  dbDeleteFolder,
  dbSavePdfFolder,
  dbDeletePdfFolder,
  dbReorderFolders,
  dbSaveTag,
  dbDeleteTag,
  dbSaveTeamMember,
  dbDeleteTeamMember,
});
