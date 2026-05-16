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

// ── OpenAI Vision: describe one image ────────────────────────────────────────
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
    if (!res.ok) { console.warn("[describeImage] HTTP", res.status); return null; }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.warn("[describeImage]", e.message);
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
    .onSnapshot(snap => cb(snap.docs.map(d => d.data())));
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
  const storagePath = `tenants/${window.TENANT_ID}/assets/${id}/${file.name}`;
  const ref = storage.ref(storagePath);

  await new Promise((resolve, reject) => {
    const task = ref.put(file);
    task.on("state_changed",
      (snap) => { onProgress?.(Math.round(snap.bytesTransferred / snap.totalBytes * 100)); },
      reject,
      resolve
    );
  });

  const storageUrl = await ref.getDownloadURL();

  let width = 0, height = 0, ratio = 1.5;
  let pages = 1;
  let widthMm = null, heightMm = null;
  let thumbnailUrl = null;

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
    // Generate JPEG thumbnail from local file — no CORS issues, file still in memory
    const THUMB_LONG = 1400;
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
      const thumbBlob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.85));
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

  // KI-Beschreibung — Bilder via Vision, PDFs via Text-Extraktion
  let aiDescription = "";
  if (storageUrl) {
    if (!window.AI_CONFIG?.openaiKey) await loadAiConfig();
    if (window.AI_CONFIG?.openaiKey) {
      aiDescription = isPdf
        ? (await describePdfWithAI(storageUrl)) || ""
        : (await describeImageWithAI(storageUrl)) || "";
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
    thumbnailUrl,
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
    campaign: "",
    embargo: null,
    ...(isPdf ? { pages, ...(widthMm ? { widthMm, heightMm } : {}) } : { width, height }),
  };

  await tenantCol("assets").doc(id).set(asset);
  return asset;
}

Object.assign(window, {
  db,
  storage,
  TENANT_ID: window.TENANT_ID,
  tenantCol,
  tenantDoc,
  tenantSettingsDoc,
  loadAiConfig,
  describeImageWithAI,
  describePdfWithAI,
  seedIfEmpty,
  seedPrintTags,
  migrateAssetUnassignedTags,
  subscribeToFolders,
  subscribeToPdfFolders,
  subscribeToAssets,
  subscribeToActivity,
  subscribeToSharedLinks,
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
