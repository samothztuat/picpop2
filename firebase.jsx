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

// ── AI config cache (loaded once from Firestore settings/global) ──────────────
window.AI_CONFIG = window.AI_CONFIG || { openaiKey: "", prompt: "" };

async function loadAiConfig() {
  try {
    const snap = await db.doc("settings/global").get();
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

// Batch-write helper (Firestore limit: 500 ops per batch)
async function writeBatch(collection, docs) {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach(doc => {
      batch.set(db.collection(collection).doc(doc.id), doc);
    });
    await batch.commit();
  }
}

// Ensure "Nicht zugeordnet" folders exist (idempotent migration)
async function seedUnsortedFolders() {
  const [imgSnap, pdfSnap] = await Promise.all([
    db.collection("folders").doc("f-unsorted").get(),
    db.collection("pdfFolders").doc("p-unsorted").get(),
  ]);
  const ops = [];
  if (!imgSnap.exists) {
    const f = (window.FOLDERS || []).find(x => x.id === "f-unsorted");
    if (f) ops.push(db.collection("folders").doc("f-unsorted").set(f));
  }
  if (!pdfSnap.exists) {
    const f = (window.PDF_FOLDERS || []).find(x => x.id === "p-unsorted");
    if (f) ops.push(db.collection("pdfFolders").doc("p-unsorted").set(f));
  }
  if (ops.length) { await Promise.all(ops); console.log("✓ Nicht-zugeordnet folders seeded"); }
}

// Seed all mock data on first load if Firestore is empty
async function seedIfEmpty() {
  const probe = await db.collection("folders").limit(1).get();
  if (!probe.empty) {
    // DB already seeded — ensure new content exists
    await seedPrintTags();
    await seedUnsortedFolders();
    return;
  }

  await writeBatch("folders",    window.FOLDERS);
  await writeBatch("pdfFolders", window.PDF_FOLDERS);
  await writeBatch("assets",     window.ASSETS);
  await writeBatch("tags",       window.TAGS);
  await writeBatch("team",       window.TEAM);
  await writeBatch("sharedLinks",window.SHARED_LINKS);
  await writeBatch("activity",   window.ACTIVITY);

  console.log("✓ Firestore initial seed complete");
}

// Ensure print-specific tags exist in Firestore (idempotent migration)
async function seedPrintTags() {
  const snap = await db.collection("tags").where("area", "==", "print").limit(1).get();
  if (!snap.empty) return; // already present
  const printTags = (window.TAGS || []).filter(t => t.area === "print");
  if (printTags.length === 0) return;
  await writeBatch("tags", printTags);
  console.log("✓ Print tags seeded");
}

// ── Real-time subscriptions ───────────────────────────────────────────────────

function subscribeToFolders(cb) {
  return db.collection("folders").onSnapshot(snap => {
    const docs = snap.docs.map(d => d.data());
    // preserve drag-drop order via sortOrder field if present
    docs.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    cb(docs);
  });
}

function subscribeToPdfFolders(cb) {
  return db.collection("pdfFolders").onSnapshot(snap => {
    const docs = snap.docs.map(d => d.data());
    docs.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    cb(docs);
  });
}

function subscribeToAssets(cb) {
  return db.collection("assets").onSnapshot(snap => {
    cb(snap.docs.map(d => d.data()));
  });
}

function subscribeToActivity(cb) {
  return db.collection("activity")
    .orderBy("at", "desc")
    .onSnapshot(snap => cb(snap.docs.map(d => d.data())));
}

function subscribeToSharedLinks(cb) {
  return db.collection("sharedLinks")
    .onSnapshot(snap => cb(snap.docs.map(d => d.data())));
}

function subscribeToTags(cb) {
  return db.collection("tags").onSnapshot(snap => cb(snap.docs.map(d => d.data())));
}

function subscribeToTeam(cb) {
  return db.collection("team").onSnapshot(snap => cb(snap.docs.map(d => d.data())));
}

// ── Write operations ──────────────────────────────────────────────────────────

async function dbSaveAsset(asset) {
  await db.collection("assets").doc(asset.id).set(asset);
}

async function dbDeleteAsset(asset) {
  await db.collection("assets").doc(asset.id).delete();
  if (asset.storagePath) {
    try { await storage.ref(asset.storagePath).delete(); } catch (_) {}
  }
}

async function dbSaveFolder(folder) {
  await db.collection("folders").doc(folder.id).set(folder);
}

async function dbDeleteFolder(id) {
  await db.collection("folders").doc(id).delete();
  const snap = await db.collection("assets").where("folderId", "==", id).get();
  if (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { folderId: "f-unsorted" }));
    await batch.commit();
  }
}

async function dbSavePdfFolder(folder) {
  await db.collection("pdfFolders").doc(folder.id).set(folder);
}

async function dbDeletePdfFolder(id) {
  await db.collection("pdfFolders").doc(id).delete();
  const snap = await db.collection("assets").where("folderId", "==", id).get();
  if (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { folderId: "p-unsorted" }));
    await batch.commit();
  }
}

async function dbSaveTag(tag) {
  await db.collection("tags").doc(tag.id).set(tag);
}
async function dbDeleteTag(id) {
  await db.collection("tags").doc(id).delete();
}
async function dbSaveTeamMember(member) {
  await db.collection("team").doc(member.id).set(member);
}
async function dbDeleteTeamMember(id) {
  await db.collection("team").doc(id).delete();
}

async function dbReorderFolders(orderedIds, isPdf = false) {
  const col = isPdf ? "pdfFolders" : "folders";
  const batch = db.batch();
  orderedIds.forEach((id, i) => {
    batch.update(db.collection(col).doc(id), { sortOrder: i });
  });
  await batch.commit();
}

async function uploadAsset(file, folderId, tags = [], onProgress = null, author = "Tom Tautz", authorRole = "in_house") {
  const id = "a-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const ext = file.name.split(".").pop().toLowerCase();
  const storagePath = `assets/${id}/${file.name}`;
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
        // → crisp on 3× retina for tiles up to ~470 px CSS wide
        const THUMB_LONG = 1400;
        const thumbScale = THUMB_LONG / Math.max(vp.width, vp.height);
        const thumbVp    = page.getViewport({ scale: thumbScale });
        const canvas     = document.createElement("canvas");
        canvas.width     = Math.round(thumbVp.width);
        canvas.height    = Math.round(thumbVp.height);
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: thumbVp }).promise;

        // Upload thumbnail to Firebase Storage
        const thumbBlob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.90));
        const thumbRef  = storage.ref(`thumbnails/${id}/thumb.jpg`);
        await thumbRef.put(thumbBlob);
        thumbnailUrl = await thumbRef.getDownloadURL();
      } catch (e) {
        console.warn("[uploadAsset] PDF thumbnail failed:", e.message);
        ratio = 0.71;
        pages = 1;
      }
    }
  } else {
    await new Promise(res => {
      const img = new Image();
      img.onload = () => { width = img.naturalWidth; height = img.naturalHeight; ratio = width / height || 1.5; res(); };
      img.onerror = res;
      img.src = storageUrl;
    });
  }

  // KI-Beschreibung für Bilder — Key nachladen falls noch nicht im Cache
  let aiDescription = "";
  if (!isPdf && storageUrl) {
    if (!window.AI_CONFIG?.openaiKey) await loadAiConfig();
    if (window.AI_CONFIG?.openaiKey) {
      aiDescription = (await describeImageWithAI(storageUrl)) || "";
    }
  }

  const asset = {
    id,
    title: file.name.replace(/\.[^.]+$/, ""),
    kind: isPdf ? "pdf" : "image",
    format: ext.toUpperCase(),
    folderId,
    tags,
    storageUrl,
    storagePath,
    thumbnailUrl,
    size: parseFloat((file.size / 1024 / 1024).toFixed(1)),
    date: new Date().toISOString(),
    author,
    authorRole,
    hue: Math.floor(Math.random() * 360),
    ratio,
    notes: "",
    aiDescription,
    campaign: "",
    embargo: null,
    ...(isPdf ? { pages, ...(widthMm ? { widthMm, heightMm } : {}) } : { width, height }),
  };

  await db.collection("assets").doc(id).set(asset);
  return asset;
}

Object.assign(window, {
  db,
  storage,
  loadAiConfig,
  describeImageWithAI,
  seedIfEmpty,
  seedPrintTags,
  subscribeToFolders,
  subscribeToPdfFolders,
  subscribeToAssets,
  subscribeToActivity,
  subscribeToSharedLinks,
  subscribeToTags,
  subscribeToTeam,
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
