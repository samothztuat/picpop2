// Views: Recent, Folders, FolderDetail, PDFs, Tags, SharedLinks, Settings, ExternalShare

const { useState: useStateV, useEffect: useEffectV, useMemo: useMemoV, useRef: useRefV } = React;

// ---- Area helper — true if asset belongs to the print area ----
// Checks: explicit kind/area field, or asset sits in a PDF folder (handles
// images that were moved to print without area field being updated).
const inPrint = a => {
  if (a.kind === "pdf" || a.area === "print") return true;
  const pdfIds = window.PDF_FOLDERS || [];
  for (let i = 0; i < pdfIds.length; i++) {
    if (pdfIds[i].id === a.folderId) return true;
  }
  return false;
};

// ---- Download helpers ----
function assetFilename(a) {
  const ext = a.kind === "pdf" ? "pdf" : (a.format || "jpg").toLowerCase().replace("jpeg", "jpg");
  return (a.title || "download").replace(/[^\w\-]/g, "_") + "." + ext;
}

async function fetchAndDownload(a) {
  const url = a.storageUrl;
  if (!url) return;
  const fname = assetFilename(a);
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const raw = await resp.blob();
    // Force octet-stream so the browser never tries to display it inline
    const blob = new Blob([raw], { type: "application/octet-stream" });
    const objUrl = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = objUrl; el.download = fname;
    document.body.appendChild(el); el.click(); document.body.removeChild(el);
    setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
  } catch(err) {
    console.warn("[picpop] fetch download failed:", err.message || err);
    // Last-resort: if fetch or blob URL fails, try canvas for images
    if (a.kind !== "pdf") {
      try {
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const cv = document.createElement("canvas");
            cv.width = img.naturalWidth; cv.height = img.naturalHeight;
            cv.getContext("2d").drawImage(img, 0, 0);
            cv.toBlob(b => {
              if (!b) { reject(new Error("toBlob null")); return; }
              const objUrl = URL.createObjectURL(b);
              const el = document.createElement("a");
              el.href = objUrl; el.download = fname;
              document.body.appendChild(el); el.click(); document.body.removeChild(el);
              setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
              resolve();
            }, "image/jpeg", 0.95);
          };
          img.onerror = reject;
          img.src = url;
        });
        return;
      } catch(_) {}
    }
    window.open(url, "_blank");
  }
}

async function bulkDownload(assets) {
  const valid = (assets || []).filter(a => a && a.storageUrl);
  if (valid.length === 0) return;
  if (valid.length === 1) { await fetchAndDownload(valid[0]); return; }
  if (valid.length < 10) {
    for (const a of valid) await fetchAndDownload(a);
    return;
  }
  // 10+ files → ZIP
  const JSZip = window.JSZip;
  if (!JSZip) { for (const a of valid) await fetchAndDownload(a); return; }
  const zip = new JSZip();
  const seen = {};
  for (const a of valid) {
    try {
      const resp = await fetch(a.storageUrl);
      const blob = await resp.blob();
      let fname = assetFilename(a);
      if (seen[fname]) { seen[fname]++; fname = fname.replace(/(\.\w+)$/, `_${seen[fname]}$1`); }
      else seen[fname] = 1;
      zip.file(fname, blob);
    } catch(err) { console.warn("[picpop] ZIP: skipping", a.title, err); }
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const objUrl = URL.createObjectURL(zipBlob);
  const el = document.createElement("a");
  el.href = objUrl; el.download = "picpop-download.zip";
  document.body.appendChild(el); el.click(); document.body.removeChild(el);
  setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
}

function dlAsset(a, e) {
  e.preventDefault(); e.stopPropagation();
  fetchAndDownload(a);
}

function DlBtn({ asset, lang }) {
  if (!asset.storageUrl) return null;
  return (
    <button
      className="list-fav"
      onClick={e => dlAsset(asset, e)}
      title={lang === "de" ? "Herunterladen" : "Download"}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    </button>
  );
}

// -------- ListTagCell — inline tag editor for list rows --------
// category: undefined = all, null = uncategorized, "kampagne"|"motiv"|"medium" = filtered
function ListTagCell({ asset, lang, category }) {
  const [open, setOpen] = useStateV(false);
  const ref = useRefV(null);

  useEffectV(() => {
    if (!open) return;
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const allEffective = window.effectiveTags ? window.effectiveTags(asset) : (asset.tags || []);
  const visibleTagIds = category !== undefined
    ? allEffective.filter(tid => {
        const tg = window.tagById(tid);
        return category === null ? !tg?.category : tg?.category === category;
      })
    : allEffective;

  function removeTag(tagId) {
    // Virtual unassigned tags have no entry in asset.tags — nothing to remove
    if (!asset.tags.includes(tagId)) return;
    window.updateAssetTags?.(asset.id, asset.tags.filter(t => t !== tagId));
  }
  function addTag(tagId) {
    if (!asset.tags.includes(tagId)) window.updateAssetTags?.(asset.id, [...asset.tags, tagId]);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ flex: 1, minWidth: 0, display: "flex", gap: 3, alignItems: "center", flexWrap: "wrap", position: "relative" }} onClick={e => e.stopPropagation()}>
      {visibleTagIds.map(tid => {
        const tg = window.tagById(tid);
        if (!tg) return null;
        const isVirtual = !asset.tags.includes(tid);
        return (
          <span key={tid} style={{ display: "inline-flex", alignItems: "center", gap: 2, height: 18, padding: "0 5px 0 6px", borderRadius: 3, background: window.tagBg(tg), color: window.tagColor(tg), fontSize: 10, flexShrink: 0, opacity: isVirtual ? 0.5 : 1 }}>
            {window.tagLabel(tg, lang)}
            {!isVirtual && (
              <button
                style={{ all: "unset", cursor: "pointer", opacity: 0.5, fontSize: 12, lineHeight: 1, marginLeft: 1, display: "flex" }}
                onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}
                onClick={() => removeTag(tid)}
                title={lang === "de" ? "Entfernen" : "Remove"}
              >×</button>
            )}
          </span>
        );
      })}
      <button
        style={{ all: "unset", cursor: "pointer", width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "1px dashed var(--line-strong)", color: "var(--muted)", fontSize: 14, lineHeight: 1, flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--fg)"; e.currentTarget.style.color = "var(--fg)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line-strong)"; e.currentTarget.style.color = "var(--muted)"; }}
        onClick={() => setOpen(v => !v)}
        title={lang === "de" ? "Tag hinzufügen" : "Add tag"}
      >+</button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 40, width: 220, background: "var(--panel)", border: "1px solid var(--line-strong)", borderRadius: 6, boxShadow: "var(--shadow)", padding: 8 }}>
          <window.TagPickerPanel lang={lang} onApplyTag={addTag} />
        </div>
      )}
    </div>
  );
}

// Derive ordered tag-category columns from TAGS — used by both list views
function useTagCols(lang) {
  return useMemoV(() => {
    const seen = new Map();
    (window.TAGS || []).forEach(tg => {
      const cat = tg.category || null;
      if (!seen.has(cat)) {
        const label = cat === "motiv" ? (lang === "de" ? "Bilder" : "Images")
          : cat === "kampagne" ? (lang === "de" ? "Kampagne" : "Campaign")
          : cat === "medium"   ? "Medium"
          : (lang === "de" ? "Tags" : "Tags");
        seen.set(cat, label);
      }
    });
    return [...seen.entries()].map(([cat, label]) => ({ cat, label }));
  }, [lang]);
}

// -------- RecentView --------
function RecentView({ onOpenFolder, onOpenAsset, onShareTarget, onDeleteAssets, onBulkAddTag, onBulkSetAuthor, onBulkMoveAssets, lang, area, assets: assetsProp, folders: foldersProp, pdfFolders: pdfFoldersProp, sharedLinks: sharedLinksProp, currentUser }) {
  const t = window.makeT(lang);
  const isPdf = area === "print";
  const allFolders    = foldersProp    || window.FOLDERS;
  const allPdfFolders = pdfFoldersProp || window.PDF_FOLDERS;
  const allAssets     = assetsProp     || window.ASSETS;
  const sharedLinks   = sharedLinksProp || window.SHARED_LINKS || [];
  const { favorites, bulkSetFavorite } = window.useFav();
  const [selection, setSelection] = useStateV(() => new Set());
  const lastSelRef = useRefV(null);

  useEffectV(() => { setSelection(new Set()); lastSelRef.current = null; }, [area]);

  const recentAssets = useMemoV(() => {
    const sorted = [...allAssets]
      .filter(a => isPdf ? inPrint(a) : !inPrint(a))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    if (sorted.length === 0) return [];
    // Show only the last upload batch: all assets within 30 min of the newest one, max 20
    const newestMs = new Date(sorted[0].date).getTime();
    return sorted.filter(a => newestMs - new Date(a.date).getTime() < 30 * 60 * 1000).slice(0, 20);
  }, [allAssets, isPdf]);

  function onToggleSelect(id, shift) {
    setSelection(prev => {
      const next = new Set(prev);
      if (shift && lastSelRef.current) {
        const ids = recentAssets.map(a => a.id);
        const from = ids.indexOf(lastSelRef.current);
        const to = ids.indexOf(id);
        if (from > -1 && to > -1) {
          const [lo, hi] = from < to ? [from, to] : [to, from];
          for (let i = lo; i <= hi; i++) next.add(ids[i]);
          return next;
        }
      }
      if (next.has(id)) next.delete(id); else next.add(id);
      lastSelRef.current = id;
      return next;
    });
  }
  function clearSel() { setSelection(new Set()); }
  useEffectV(() => {
    if (selection.size === 0) return;
    const fn = (e) => { if (e.key === "Escape") clearSel(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [selection.size]);
  const selArr = [...selection];
  const allFav = selArr.length > 0 && selArr.every(id => favorites.has(id));

  const pinned = isPdf
    ? allPdfFolders.filter(f => f.pinned)
    : allFolders.filter(f => f.pinned);
  const pdfFolderIds = useMemoV(
    () => new Set((allPdfFolders).map(f => f.id)),
    [allPdfFolders]
  );
  const activity = window.ACTIVITY;

  function renderActivity(ev) {
    const user = window.userById(ev.user);
    if (!user) return null; // guard: unknown user reference
    const folder = ev.folder ? window.folderById(ev.folder) : null;
    let txt = "";
    if (ev.kind === "upload") txt = t("activity_upload", { user: user.name, n: ev.n, folder: folder?.name });
    else if (ev.kind === "share") txt = t("activity_share", { user: user.name, folder: folder?.name });
    else if (ev.kind === "tag") txt = t("activity_tag", { user: user.name, tag: ev.tag });
    else if (ev.kind === "note") txt = t("activity_note", { user: user.name, asset: ev.asset });
    else if (ev.kind === "rename") txt = t("activity_rename", { user: user.name, asset: ev.asset });
    else if (ev.kind === "pdf") txt = t("activity_pdf", { user: user.name, asset: ev.asset });
    return (
      <div key={ev.id} className="row" style={{ gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
        <window.Avatar user={user} size={22} />
        <div style={{ flex: 1, fontSize: 13, minWidth: 0 }} className="clamp-1">{txt}</div>
        <div className="mono" style={{ color: "var(--muted)", flex: "none" }}>{window.fmtRel(ev.at, t)}</div>
      </div>
    );
  }

  // Philosophical quotes about images/photography/seeing — rotates daily
  const PHOTO_QUOTES = [
    { q: "Die Kamera ist ein Instrument, das lehrt, ohne Kamera zu sehen.", a: "Dorothea Lange" },
    { q: "Ein Foto ist ein Geheimnis über ein Geheimnis.", a: "Diane Arbus" },
    { q: "Jede Fotografie ist ein Attest des Dagewesenseins.", a: "Roland Barthes" },
    { q: "Im entscheidenden Moment offenbart sich die Wirklichkeit.", a: "Henri Cartier-Bresson" },
    { q: "Wir sehen nicht mit den Augen, sondern durch sie.", a: "William Blake" },
    { q: "Das Licht ist die erste und letzte Wahrheit.", a: "László Moholy-Nagy" },
    { q: "Das Auge ist das Fenster der Seele.", a: "Leonardo da Vinci" },
    { q: "Sehen ist Vergessen, was die Dinge heißen.", a: "Paul Valéry" },
    { q: "Die Schönheit liegt im Blick des Betrachters.", a: "David Hume" },
    { q: "Das Foto ist die Literatur des Lichts.", a: "Man Ray" },
    { q: "Ein Bild sagt mehr als tausend Worte — aber nur dem, der sehen kann.", a: "Ansel Adams" },
    { q: "Fotografieren heißt, dem flüchtigen Moment Unsterblichkeit zu schenken.", a: "Susan Sontag" },
    { q: "Sehen lernen heißt, die Welt neu erschaffen.", a: "John Ruskin" },
    { q: "Was wir fotografieren, ist nicht die Welt — es ist unsere Beziehung zu ihr.", a: "Edward Weston" },
    { q: "Das Bild ist eine stille Sprache, die lauter spricht als Worte.", a: "Paul Klee" },
  ];
  const [quoteIdx] = useStateV(() => Math.floor(Math.random() * PHOTO_QUOTES.length));
  const todayQuote = PHOTO_QUOTES[quoteIdx];

  return (
    <div style={{ padding: "32px 32px 64px" }}>

      {/* ── Header: Storage links, Greeting + Quote rechts ── */}
      <div className="row" style={{ alignItems: "flex-start", gap: 32, marginBottom: 48 }}>
        {/* Storage-Kachel — links */}
        {(() => {
          const imgMb = allAssets.filter(a => a.kind !== "pdf").reduce((s, a) => s + (a.size || 0), 0);
          const pdfMb = allAssets.filter(a => a.kind === "pdf").reduce((s, a) => s + (a.size || 0), 0);
          const totalMb = imgMb + pdfMb;
          const fmt = (mb) => mb >= 1024 ? `${(mb/1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
          const limitGb = 10;
          const pct = Math.min(100, (totalMb / (limitGb * 1024)) * 100);
          return (
            <div className="card" style={{ padding: "24px 28px", width: 300, flexShrink: 0 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>{t("storage")}</div>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
                <div className="h-1 num" style={{ fontSize: 42, lineHeight: 1 }}>
                  {totalMb >= 1024
                    ? <>{(totalMb/1024).toFixed(1)} <span style={{ fontSize: 18, color: "var(--muted)" }}>GB</span></>
                    : <>{Math.round(totalMb)} <span style={{ fontSize: 18, color: "var(--muted)" }}>MB</span></>}
                </div>
                <div className="mono" style={{ color: "var(--muted)", fontSize: 11, paddingBottom: 4 }}>
                  {allAssets.length} {lang === "de" ? "Dateien" : "files"}
                </div>
              </div>
              <div style={{ height: 4, background: "var(--hover)", borderRadius: 2, marginTop: 16, overflow: "hidden" }}>
                <div style={{ width: `${Math.max(pct, 1)}%`, height: "100%", background: "var(--fg)", transition: "width .4s" }} />
              </div>
              <div className="row" style={{ marginTop: 12, gap: 16, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
                <span><span className="dot" style={{ background: "var(--fg)" }} /> {lang === "de" ? "Bilder" : "Images"} {fmt(imgMb)}</span>
                {pdfMb > 0 && <span><span className="dot" style={{ background: "var(--accent)" }} /> PDF {fmt(pdfMb)}</span>}
              </div>
            </div>
          );
        })()}

        {/* Begrüßung + Zitat — rechts */}
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div className="eyebrow">picpop · {isPdf ? "Print" : (lang === "de" ? "Übersicht" : "Overview")}</div>
          <div className="h-display" style={{ marginTop: 8 }}>
            {(() => {
              const name = currentUser?.displayName || currentUser?.email?.split("@")[0] || "";
              const h = new Date().getHours();
              const gr = h < 11 ? "Moin" : h < 14 ? "Mahlzeit" : h < 18 ? "Moin" : "Guten Abend";
              return name ? `${gr}, ${name.split(" ")[0]}` : gr;
            })()}
          </div>
          <div style={{ marginTop: 14, maxWidth: 480 }}>
            <div style={{ fontSize: 14, color: "var(--muted)", fontStyle: "italic", lineHeight: 1.55 }}>
              „{todayQuote.q}"
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", opacity: 0.6, marginTop: 5 }}>
              — {todayQuote.a}
            </div>
          </div>
        </div>
      </div>

      {/* ── Pinned folders ── */}
      <window.SectionHeader eyebrow={t("pinned")} title={lang === "de" ? "Angeheftete Ordner" : "Pinned folders"} />
      <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {pinned.map(f => <window.FolderTile key={f.id} folder={f} kind={isPdf ? "pdf" : "image"} onOpen={() => onOpenFolder(f.id)} />)}
      </div>

      {/* ── Recent assets ── */}
      <div style={{ marginTop: 40 }}>
        <window.SectionHeader eyebrow={t("nav_recent")} title={lang === "de" ? "Zuletzt hinzugefügt" : "Recently added"} right={null} />
        {selection.size > 0 && (
          <window.BulkBar
            count={selection.size} onClear={clearSel} lang={lang} allFavorited={allFav}
            onFavorite={() => bulkSetFavorite(selArr, true)}
            onUnfavorite={() => bulkSetFavorite(selArr, false)}
            onShare={() => onShareTarget?.({ asset: { title: `${selection.size} ${t("items")}`, format: "Auswahl", width: 0, height: 0 } })}
            onApplyTag={(tagId) => { onBulkAddTag?.(selArr, tagId); }}
            onRemoveTag={(tagId) => { selArr.forEach(id => { const a = allAssets.find(x => x.id === id); if (a) window.updateAssetTags(id, a.tags.filter(t => t !== tagId)); }); }}
            selectedAssets={selArr.map(id => allAssets.find(a => a.id === id)).filter(Boolean)}
            onApplyAuthor={(user) => { onBulkSetAuthor?.(selArr, user); clearSel(); }}
            onMoveToFolder={(folderId) => { onBulkMoveAssets?.(selArr, folderId); clearSel(); }}
            folders={isPdf ? allPdfFolders : allFolders}
            onDelete={() => { onDeleteAssets?.(selArr); clearSel(); }}
            onDownload={() => bulkDownload(selArr.map(id => recentAssets.find(a => a.id === id)).filter(Boolean))}
          />
        )}
        <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }} onClick={clearSel}>
          {recentAssets.map(a => (
            <window.AssetTile key={a.id} asset={a} onOpen={() => onOpenAsset(a, recentAssets)}
              selectable selected={selection.has(a.id)} onToggleSelect={onToggleSelect}
              dragIds={selection.has(a.id) ? selArr : [a.id]} />
          ))}
        </div>
      </div>
    </div>
  );
}

// -------- FoldersView --------
function FoldersView({ folders, onOpenFolder, lang, kind = "image", onCreateNew, onMoveAssets }) {
  const t = window.makeT(lang);
  const [q, setQ] = useStateV("");
  const filtered = folders.filter(f => f.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{ padding: "32px 32px 64px" }}>
      <div className="row" style={{ alignItems: "end", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div className="eyebrow">{kind === "pdf" ? t("nav_pdfs") : t("nav_folders")}</div>
          <div className="h-display" style={{ marginTop: 8 }}>
            {kind === "pdf"
              ? (lang === "de" ? "Anzeigen & Broschüren" : "Ads & Brochures")
              : (lang === "de" ? "Alle Ordner" : "All folders")}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 8 }}>
            {filtered.length} {t("folders")} · {filtered.reduce((s,f) => s+f.count, 0).toLocaleString()} {t("items")}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="input" style={{ width: 240 }}>
            <window.Icon.search size={14} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === "de" ? "Ordner suchen" : "Search folders"} />
          </div>
          <button className="btn"><window.Icon.plus size={14} /> {t("new_folder")}</button>
          <button className="btn primary" onClick={onCreateNew}><window.Icon.upload size={14} /> {t("upload")}</button>
        </div>
      </div>

      <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {filtered.map(f => (
          <window.FolderTile key={f.id} folder={f} kind={kind} onOpen={() => onOpenFolder(f.id)} onMoveAssets={onMoveAssets} />
        ))}
      </div>
    </div>
  );
}

// -------- FolderDetailView --------
function FolderDetailView({ assets: assetsProp, folder, onBack, onOpenAsset, onOpenFolder, onShareTarget, onUpload, onDeleteAssets, onBulkAddTag, onBulkSetAuthor, onBulkMoveAssets, imageFolders, pdfFolders, lang, kind = "image" }) {
  const allAssets = assetsProp || window.ASSETS;
  const t = window.makeT(lang);
  const { favorites, toggleFavorite, bulkSetFavorite } = window.useFav();
  const [thumbSize, setThumbSize] = window.useThumbSize();
  const [q, setQ] = useStateV("");
  const [view, setView] = useStateV("grid");
  const [sort, setSort] = useStateV("date");
  const [filterTags, setFilterTags] = useStateV(() => new Set());
  const [filterAuthor, setFilterAuthor] = useStateV(null);
  function toggleFilterTag(tid) {
    setFilterTags(prev => {
      const next = new Set(prev);
      next.has(tid) ? next.delete(tid) : next.add(tid);
      return next;
    });
  }
  const [selection, setSelection] = useStateV(() => new Set());
  const lastSelRef = useRefV(null);
  const tagCols = useTagCols(lang);

  const assets = useMemoV(() => {
    let xs = allAssets.filter(a => a.folderId === folder.id);
    if (q) xs = xs.filter(a => { const lq = q.toLowerCase(); return a.title.toLowerCase().includes(lq) || a.author.toLowerCase().includes(lq) || (a.notes||"").toLowerCase().includes(lq) || (a.aiDescription||"").toLowerCase().includes(lq); });
    if (filterTags.size > 0) xs = xs.filter(a => [...filterTags].every(tid => a.tags.includes(tid)));
    if (filterAuthor) xs = xs.filter(a => a.author === filterAuthor);
    if (sort === "date") xs = [...xs].sort((a,b) => (a.date < b.date ? 1 : -1));
    if (sort === "title") xs = [...xs].sort((a,b) => a.title.localeCompare(b.title));
    return xs;
  }, [allAssets, folder.id, q, sort, filterTags, filterAuthor]);

  function onToggleSelect(id, shift) {
    setSelection(prev => {
      const next = new Set(prev);
      if (shift && lastSelRef.current) {
        const ids = assets.map(a => a.id);
        const from = ids.indexOf(lastSelRef.current);
        const to = ids.indexOf(id);
        if (from > -1 && to > -1) {
          const [lo, hi] = from < to ? [from, to] : [to, from];
          for (let i = lo; i <= hi; i++) next.add(ids[i]);
          return next;
        }
      }
      if (next.has(id)) next.delete(id); else next.add(id);
      lastSelRef.current = id;
      return next;
    });
  }
  function selectAll() { setSelection(new Set(assets.map(a => a.id))); }
  function clearSel() { setSelection(new Set()); }
  useEffectV(() => {
    if (selection.size === 0) return;
    const fn = (e) => { if (e.key === "Escape") clearSel(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [selection.size]);
  const selArr = [...selection];
  const allFav = selArr.length > 0 && selArr.every(id => favorites.has(id));

  const allTags = useMemoV(() => {
    const set = new Set();
    allAssets.filter(a => a.folderId === folder.id).forEach(a => a.tags.forEach(tg => set.add(tg)));
    return Array.from(set).map(id => window.tagById(id)).filter(Boolean);
  }, [allAssets, folder.id]);

  const allAuthors = useMemoV(() => {
    const set = new Set();
    allAssets.filter(a => a.folderId === folder.id).forEach(a => set.add(a.author));
    return Array.from(set);
  }, [allAssets, folder.id]);

  // Sub-folders of this folder
  const allFolders = kind === "pdf" ? (pdfFolders || window.PDF_FOLDERS) : (imageFolders || window.FOLDERS);
  const subFolders = useMemoV(() => allFolders.filter(f => f.parent === folder.id), [allFolders, folder.id]);

  return (
    <div style={{ padding: "32px 32px 64px" }}>
      <button className="btn ghost sm" onClick={onBack} style={{ marginBottom: 16 }}>
        <window.Icon.arrowL size={12} /> {kind === "pdf" ? t("nav_pdfs") : t("nav_folders")}
      </button>

      <div className="row" style={{ alignItems: "end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div className="eyebrow">
            {kind === "pdf" ? t("section_pdfs") : t("section_images")} · {window.fmtDate(folder.updated, lang)}
          </div>
          <div className="h-display" style={{ marginTop: 8 }}>{folder.name}</div>
          <div className="row" style={{ marginTop: 12, gap: 16, color: "var(--muted)", fontSize: 13 }}>
            <span className="num">{folder.count} {t("items")}</span>
            <span>·</span>
            <window.AvatarStack users={window.TEAM.slice(0, 4)} size={20} />
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn"><window.Icon.pin size={14} /> {folder.pinned ? t("pinned") : (lang === "de" ? "Anheften" : "Pin")}</button>
          <button className="btn" onClick={onUpload}><window.Icon.upload size={14} /> {t("upload")}</button>
          <button className="btn primary" onClick={() => onShareTarget({ folder })}><window.Icon.share size={14} /> {t("share")}</button>
        </div>
      </div>

      {/* BulkBar + Toolbar — both sticky */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--bg)", margin: "0 -32px", padding: "8px 32px 12px" }}>
      {selection.size > 0 && (
        <window.BulkBar
          count={selection.size} onClear={clearSel} lang={lang} allFavorited={allFav}
          onFavorite={() => bulkSetFavorite(selArr, true)}
          onUnfavorite={() => bulkSetFavorite(selArr, false)}
          onShare={() => onShareTarget({ asset: { title: `${selection.size} ${t("items")}`, format: "Auswahl", width: 0, height: 0 } })}
          onApplyTag={(tagId) => { onBulkAddTag?.(selArr, tagId); }}
          onRemoveTag={(tagId) => { selArr.forEach(id => { const a = allAssets.find(x => x.id === id); if (a) window.updateAssetTags(id, a.tags.filter(t => t !== tagId)); }); }}
          selectedAssets={selArr.map(id => allAssets.find(a => a.id === id)).filter(Boolean)}
          onApplyAuthor={(user) => { onBulkSetAuthor?.(selArr, user); clearSel(); }}
          onMoveToFolder={(folderId) => { onBulkMoveAssets?.(selArr, folderId); clearSel(); }}
          folders={kind === "pdf" ? (pdfFolders || window.PDF_FOLDERS) : (imageFolders || window.FOLDERS)}
          onDelete={() => { onDeleteAssets?.(selArr); clearSel(); }}
          onDownload={() => bulkDownload(selArr.map(id => assets.find(a => a.id === id)).filter(Boolean))}
        />
      )}

      {/* Sub-folders */}
      {subFolders.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{lang === "de" ? "Unterordner" : "Sub-folders"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {subFolders.map(sf => (
              <window.FolderTile key={sf.id} folder={sf} kind={kind} onOpen={() => onOpenFolder?.(sf.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div>
        <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <div className="input" style={{ width: 220 }}>
              <window.Icon.search size={14} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_placeholder")} />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="btn" style={{ paddingRight: 24 }}>
              <option value="date">{lang === "de" ? "Neueste zuerst" : "Newest first"}</option>
              <option value="title">{lang === "de" ? "Titel A–Z" : "Title A–Z"}</option>
            </select>
            {(filterTags.size > 0 || filterAuthor || q) && (
              <button className="btn ghost sm" onClick={() => { setFilterTags(new Set()); setFilterAuthor(null); setQ(""); }}>
                <window.Icon.x size={12} /> {t("clear")}
              </button>
            )}
            <button className="btn ghost sm" onClick={selectAll}>{t("select_all")}</button>
          </div>
          <div className="row" style={{ gap: 4 }}>
            <window.ThumbSizeSlider size={thumbSize} setSize={setThumbSize} lang={lang} />
            <button className={"btn icon" + (view === "grid" ? " primary" : "")} onClick={() => setView("grid")} title={t("view_grid")}><window.Icon.grid size={14} /></button>
            <button className={"btn icon" + (view === "list" ? " primary" : "")} onClick={() => setView("list")} title={t("view_list")}><window.Icon.list size={14} /></button>
          </div>
        </div>
        {/* Filter rows: Medium · Kampagne · Tag · Urheber */}
        {(() => {
          const mediumTags   = allTags.filter(tg => tg.category === "medium");
          const generalTags  = allTags.filter(tg => !tg.area && !tg.category);
          const labelStyle   = { minWidth: 78, alignSelf: "center", flexShrink: 0 };
          const renderTagChip = (tg) => {
            const active = filterTags.has(tg.id);
            return (
              <span key={tg.id} className="chip" style={{ cursor: "pointer", background: active ? window.tagColor(tg) : window.tagBg(tg), color: active ? "var(--bg)" : window.tagColor(tg), borderColor: active ? "transparent" : undefined, outline: active ? `2px solid ${window.tagColor(tg)}` : "none", outlineOffset: 1 }}
                onClick={() => toggleFilterTag(tg.id)}>
                <span className="tag-dot" style={{ background: active ? "var(--bg)" : window.tagColor(tg) }} />
                {window.tagLabel(tg, lang)}
              </span>
            );
          };
          return (
            <>
              {mediumTags.length > 0 && (
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  <span className="eyebrow" style={labelStyle}>Medium</span>
                  {mediumTags.map(renderTagChip)}
                </div>
              )}
              {generalTags.length > 0 && (
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  <span className="eyebrow" style={labelStyle}>{t("tags")}</span>
                  {generalTags.map(renderTagChip)}
                </div>
              )}
              {allAuthors.length > 0 && (
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  <span className="eyebrow" style={labelStyle}>{lang === "de" ? "Urheber" : "Author"}</span>
                  {allAuthors.map(au => {
                    const active = filterAuthor === au;
                    const member = window.TEAM.find(u => u.name === au);
                    return (
                      <span key={au} className={"chip" + (active ? " active" : "")} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
                        onClick={() => setFilterAuthor(active ? null : au)}>
                        {member && <window.Avatar user={member} size={14} />}
                        {au.split(" ")[0]}
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          );
        })()}
      </div>
      </div>{/* end sticky wrapper */}

      {assets.length === 0 && <window.Empty title={t("no_results")} hint={t("no_results_hint")} />}

      {view === "grid" && assets.length > 0 && (
        <div className="stagger" style={{ display: "grid", gridTemplateColumns: kind === "pdf" ? `repeat(auto-fill, minmax(${Math.max(160, thumbSize - 20)}px, 1fr))` : `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`, gap: 12, gridAutoFlow: "dense" }} onClick={clearSel}>
          {assets.map(a => (
            <window.AssetTile key={a.id} asset={a} onOpen={() => onOpenAsset(a, assets)}
              selectable selected={selection.has(a.id)} onToggleSelect={onToggleSelect}
              dragIds={selection.has(a.id) ? selArr : [a.id]} />
          ))}
        </div>
      )}

      {view === "list" && assets.length > 0 && (() => {
        const rowH = Math.max(36, Math.min(120, Math.round(thumbSize * 0.28)));
        const thumbW = Math.round(rowH * 1.5);
        return (
        <div className="card" style={{ overflowX: "auto" }}>
          <div className="row eyebrow" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontSize: 11, minWidth: 700 }}>
            <div style={{ width: 24 }}></div>
            <div style={{ width: thumbW + 12 }}>—</div>
            <div style={{ flex: 2 }}>{t("title")}</div>
            <div style={{ flex: 1 }}>{t("author")}</div>
            {tagCols.map(({ cat, label }) => <div key={String(cat)} style={{ flex: 1 }}>{label}</div>)}
            <div style={{ width: 100 }}>{lang === "de" ? "Aufnahmedatum" : "File date"}</div>
            <div style={{ width: 60 }}></div>
          </div>
          {assets.map(a => {
            const isSel = selection.has(a.id);
            const isFav = favorites.has(a.id);
            return (
              <div key={a.id} className="row" onClick={() => onOpenAsset(a, assets)} style={{ padding: "6px 16px", borderBottom: "1px solid var(--line)", cursor: "pointer", minHeight: rowH + 12, minWidth: 700, background: isSel ? "var(--accent-soft)" : "transparent" }}>
                <div style={{ width: 24 }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isSel} onChange={(e) => onToggleSelect(a.id, e.nativeEvent.shiftKey)} style={{ accentColor: "var(--accent)", cursor: "pointer" }} />
                </div>
                <div style={{ width: thumbW, height: rowH, marginRight: 12, overflow: "hidden", borderRadius: 2, position: "relative", flexShrink: 0 }}>
                  {a.kind === "pdf"
                    ? (a.thumbnailUrl
                        ? <img src={a.thumbnailUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <window.PHDark hue={a.hue} label="" />)
                    : <window.AssetImg asset={a} w={thumbW * 2} />}
                </div>
                <div style={{ flex: 2, fontWeight: 500, fontSize: 13 }} className="clamp-1">{a.title}</div>
                <div style={{ flex: 1, fontSize: 12, color: "var(--muted)" }} className="clamp-1">{a.author}</div>
                {tagCols.map(({ cat }) => <ListTagCell key={String(cat)} asset={a} lang={lang} category={cat} />)}
                <div style={{ width: 100, fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>{window.fmtDate(a.takenAt || a.date, lang)}</div>
                <div style={{ width: 60, display: "flex", gap: 2, justifyContent: "flex-end", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <DlBtn asset={a} lang={lang} />
                  <button className={"list-fav" + (isFav ? " on" : "")} onClick={() => toggleFavorite(a.id)} title={isFav ? t("favorite_remove") : t("favorite_add")}>
                    <window.Icon.star size={14} fill={isFav ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        );
      })()}
    </div>
  );
}

// -------- Tags view --------

function TagsView({ assets: assetsProp, tags: tagsProp, onSaveTag, onDeleteTag, onOpenAsset, lang }) {
  const assets = assetsProp || window.ASSETS;
  const tags = tagsProp || window.TAGS;
  const t = window.makeT(lang);
  const [active, setActive] = useStateV(null);
  const [editingId, setEditingId] = useStateV(null);
  const [editForm, setEditForm] = useStateV({});
  const [creating, setCreating] = useStateV(false);
  const [newForm, setNewForm] = useStateV({ name: "", name_en: "" });

  const tagCounts = useMemoV(() => {
    const m = {};
    assets.forEach(a => a.tags.forEach(tid => { m[tid] = (m[tid] || 0) + 1; }));
    return m;
  }, [assets]);

  const filtered = useMemoV(() => active ? assets.filter(a => a.tags.includes(active)) : [], [active, assets]);

  function startEdit(tg, e) {
    e?.stopPropagation();
    setEditingId(tg.id);
    setEditForm({ name: tg.name, name_en: tg.name_en || "" });
    setCreating(false);
  }

  function commitEdit() {
    const tg = tags.find(t => t.id === editingId);
    if (!tg || !editForm.name.trim()) { setEditingId(null); return; }
    onSaveTag?.({ ...tg, name: editForm.name.trim(), name_en: editForm.name_en.trim() || editForm.name.trim() });
    setEditingId(null);
  }

  function commitCreate() {
    if (!newForm.name.trim()) { setCreating(false); return; }
    onSaveTag?.({ id: "tag-" + Math.random().toString(36).slice(2, 8), name: newForm.name.trim(), name_en: newForm.name_en.trim() || newForm.name.trim(), hue: 0 });
    setNewForm({ name: "", name_en: "" });
    setCreating(false);
  }

  const activeTg = tags.find(t => t.id === active);

  return (
    <div style={{ padding: "32px 32px 64px" }}>
      <div className="row" style={{ alignItems: "end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div className="eyebrow">{t("nav_tags")}</div>
          <div className="h-display" style={{ marginTop: 8 }}>{lang === "de" ? "Tag-Bibliothek" : "Tag library"}</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
            {tags.length} {lang === "de" ? "Tags · Klicken zum Filtern" : "tags · Click to filter"}
          </div>
        </div>
        <button className="btn primary" onClick={() => { setCreating(v => !v); setEditingId(null); }}>
          <window.Icon.plus size={14} /> {lang === "de" ? "Neuer Tag" : "New tag"}
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="card" style={{ padding: 20, marginBottom: 20, borderColor: "var(--accent)" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{lang === "de" ? "Neuer Tag" : "New tag"}</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{lang === "de" ? "Name *" : "Name *"}</div>
            <input autoFocus value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") commitCreate(); if (e.key === "Escape") setCreating(false); }}
              placeholder={lang === "de" ? "Tag-Name…" : "Tag name…"} style={{ width: "100%", border: "1px solid var(--line-strong)", borderRadius: 4, padding: "7px 10px", background: "var(--panel)", color: "var(--fg)", outline: "none", fontSize: 13 }} />
          </div>
          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <button className="btn ghost sm" onClick={() => setCreating(false)}>{t("cancel")}</button>
            <button className="btn primary sm" onClick={commitCreate} disabled={!newForm.name.trim()}>
              {lang === "de" ? "Anlegen" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Tag cards — grouped by cluster */}
      {(() => {
        const imageTags    = tags.filter(tg => !tg.area && !tg.category);
        const mediumTags   = tags.filter(tg => tg.category === "medium");

        function renderTagCard(tg) {
          const count = tagCounts[tg.id] || 0;
          const isActive = active === tg.id;
          if (editingId === tg.id) return (
            <div key={tg.id} className="card" style={{ padding: 16, borderColor: "var(--accent)" }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>DE</div>
                <input autoFocus value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingId(null); }}
                  style={{ width: "100%", border: "1px solid var(--line-strong)", borderRadius: 4, padding: "6px 8px", background: "var(--panel)", color: "var(--fg)", outline: "none", fontSize: 13 }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>EN</div>
                <input value={editForm.name_en} onChange={e => setEditForm(f => ({ ...f, name_en: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingId(null); }}
                  style={{ width: "100%", border: "1px solid var(--line-strong)", borderRadius: 4, padding: "6px 8px", background: "var(--panel)", color: "var(--fg)", outline: "none", fontSize: 13 }} />
              </div>
              <div className="row" style={{ gap: 6, marginTop: 12, justifyContent: "flex-end" }}>
                <button className="btn ghost sm" onClick={() => setEditingId(null)}>{t("cancel")}</button>
                <button className="btn primary sm" onClick={commitEdit}>{t("save")}</button>
              </div>
            </div>
          );
          return (
            <div key={tg.id} className="card tag-card" style={{ padding: 16, cursor: "pointer", borderColor: isActive ? "var(--fg)" : "var(--line)" }}
              onClick={() => setActive(isActive ? null : tg.id)}
              onDoubleClick={e => startEdit(tg, e)}
            >
              <div className="row" style={{ gap: 10, marginBottom: 14, justifyContent: "space-between" }}>
                <div className="row" style={{ gap: 10 }}>
                  <div style={{ width: 28, height: 28, background: window.tagBg(tg), color: window.tagColor(tg), borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <window.Icon.tag size={14} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{window.tagLabel(tg, lang)}</div>
                    <div className="mono num" style={{ color: "var(--muted)", fontSize: 11 }}>{count} {count === 1 ? t("items").replace("e","") : t("items")}</div>
                  </div>
                </div>
                <div className="row tag-actions" style={{ gap: 2 }} onClick={e => e.stopPropagation()}>
                  <button className="btn icon ghost sm" onClick={e => startEdit(tg, e)} title={t("edit")}><window.Icon.edit size={12} /></button>
                  <button className="btn icon ghost sm" onClick={() => onDeleteTag?.(tg.id)} title={t("delete")} style={{ color: "var(--accent)" }}><window.Icon.trash size={12} /></button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, height: 28, borderRadius: 3, overflow: "hidden" }}>
                {assets.filter(a => a.tags.includes(tg.id)).slice(0, 4).map((a, i) => (
                  <div key={i} style={{ position: "relative", overflow: "hidden" }}><window.AssetImg asset={a} w={120} h={60} /></div>
                ))}
                {Array.from({ length: Math.max(0, 4 - assets.filter(a => a.tags.includes(tg.id)).length) }).map((_, i) => (
                  <div key={"ph-" + i} style={{ background: window.tagBg(tg) }} />
                ))}
              </div>
            </div>
          );
        }

        function renderCluster(label, list) {
          if (list.length === 0) return null;
          return (
            <div key={label} style={{ marginBottom: 36 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
                <span className="eyebrow" style={{ fontSize: 11 }}>{label}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>{list.length}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {list.map(renderTagCard)}
              </div>
            </div>
          );
        }

        return (
          <div style={{ marginBottom: 32 }}>
            {renderCluster(lang === "de" ? "Bilder" : "Images", imageTags)}
            {renderCluster("Print · Medium", mediumTags)}
          </div>
        );
      })()}

      {active && activeTg && (
        <div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
            <div className="row" style={{ gap: 10 }}>
              <div className="h-2">{window.tagLabel(activeTg, lang)}</div>
              <span className="chip" style={{ background: window.tagBg(activeTg), color: window.tagColor(activeTg), borderColor: "transparent" }}>
                {filtered.length} {t("items")}
              </span>
            </div>
            <button className="btn sm ghost" onClick={() => setActive(null)}><window.Icon.x size={12} /> {t("clear")}</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {filtered.map(a => <window.AssetTile key={a.id} asset={a} onOpen={() => onOpenAsset(a, filtered)} />)}
          </div>
          {filtered.length === 0 && <window.Empty title={lang === "de" ? "Noch keine Assets mit diesem Tag" : "No assets with this tag yet"} />}
        </div>
      )}
    </div>
  );
}

// -------- Shared Links view --------
function SharedView({ onOpenShare, lang }) {
  const t = window.makeT(lang);
  return (
    <div style={{ padding: "32px 32px 64px" }}>
      <div className="eyebrow">{t("nav_shared")}</div>
      <div className="h-display" style={{ marginTop: 8 }}>{lang === "de" ? "Geteilte Links" : "Shared links"}</div>
      <div style={{ color: "var(--muted)", marginTop: 8, marginBottom: 32 }}>
        {window.SHARED_LINKS.length} {lang === "de" ? "aktive Links" : "active links"}
      </div>

      <div className="card">
        <div className="row" style={{ padding: "10px 20px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ flex: 2 }} className="eyebrow">{lang === "de" ? "Inhalt" : "Content"}</div>
          <div style={{ width: 160 }} className="eyebrow">{lang === "de" ? "Geteilt von" : "Shared by"}</div>
          <div style={{ width: 120 }} className="eyebrow">{lang === "de" ? "Erstellt" : "Created"}</div>
          <div style={{ width: 120 }} className="eyebrow">{t("expires")}</div>
          <div style={{ width: 80, textAlign: "right" }} className="eyebrow">Views</div>
          <div style={{ width: 40 }} />
        </div>
        {window.SHARED_LINKS.map(sl => {
          const target = sl.folder ? window.folderById(sl.folder) : null;
          const user = window.userById(sl.by);
          return (
            <div key={sl.id} className="row" style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={onOpenShare}>
              <div style={{ flex: 2, minWidth: 0 }} className="row" >
                <div style={{ width: 32, height: 32, background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", marginRight: 12, flex: "none" }}>
                  <window.Icon.link size={14} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="clamp-1" style={{ fontWeight: 500, fontSize: 13 }}>{target ? target.name : sl.asset}</div>
                  <div className="mono" style={{ color: "var(--muted)" }}>picpop.app/s/{sl.id.slice(-6)}</div>
                </div>
              </div>
              <div style={{ width: 160 }} className="row">
                <window.Avatar user={user} size={20} />
                <span style={{ fontSize: 12, marginLeft: 8 }} className="clamp-1">{user.name}</span>
              </div>
              <div style={{ width: 120, fontSize: 12, color: "var(--muted)" }}>{sl.created}</div>
              <div style={{ width: 120, fontSize: 12, color: "var(--muted)" }}>{sl.expires || t("never")}</div>
              <div style={{ width: 80, textAlign: "right" }} className="num">{sl.views}</div>
              <div style={{ width: 40, textAlign: "right" }}><button className="btn icon ghost sm"><window.Icon.more size={14} /></button></div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
        {lang === "de"
          ? "Empfänger sehen Bilder ausschließlich im Browser. Download ist standardmäßig deaktiviert."
          : "Recipients can view images only in the browser. Download is disabled by default."}
      </div>
    </div>
  );
}

// SettingsView is in settings.jsx (window.SettingsView)

// -------- External Share Recipient view --------
function ExternalShareView({ onExit, lang }) {
  const t = window.makeT(lang);
  // Pretend we shared the press folder
  const folder = window.folderById("f-presse");
  const assets = window.ASSETS.filter(a => a.folderId === "f-presse");
  const [openA, setOpenA] = useStateV(null);

  return (
    <div className="share-page" data-theme="light">
      <div className="share-header">
        <div className="row" style={{ gap: 12 }}>
          <div style={{ width: 28, height: 28, background: "var(--fg)", color: "var(--bg)", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 600 }}>p</div>
          <div>
            <div className="mono" style={{ color: "var(--muted)" }}>picpop · {t("external_intro")}</div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>Köhler & Co. — Kommunikation</div>
          </div>
        </div>
        <div className="row" style={{ gap: 16, fontSize: 12, color: "var(--muted)" }}>
          <span><window.Icon.eye size={12} /> {t("view_in_browser")}</span>
          <span><window.Icon.lock size={12} /> {t("download_disabled")}</span>
          <button className="btn sm ghost" onClick={onExit} title="Back to app">
            <window.Icon.arrowL size={12} /> {lang === "de" ? "Zurück zur App" : "Back to app"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 32px" }}>
        <div className="eyebrow">{t("external_intro")}</div>
        <div className="h-display" style={{ marginTop: 8 }}>{folder.name}</div>
        <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 8, maxWidth: 560 }}>
          {lang === "de"
            ? "Bitte nutzen Sie die folgenden Bilder ausschließlich für redaktionelle Zwecke. Druckfähige Auflösung verfügbar — bei Bedarf melden Sie sich kurz bei Anna Sauter."
            : "Please use the following images for editorial purposes only. Print-resolution masters are available — please reach out to Anna Sauter if needed."}
        </div>

        <div className="row" style={{ marginTop: 24, gap: 24, color: "var(--muted)", fontSize: 13 }}>
          <span><span className="eyebrow" style={{ marginRight: 8 }}>{t("shared_with")}</span> redaktion@nzz.ch</span>
          <span><span className="eyebrow" style={{ marginRight: 8 }}>{t("expires")}</span> 11.08.2026</span>
          <span><span className="eyebrow" style={{ marginRight: 8 }}>{t("by")}</span> Anna Sauter</span>
        </div>

        <div style={{ height: 1, background: "var(--line)", margin: "40px 0" }} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, gridAutoFlow: "dense" }}>
          {assets.map(a => (
            <div key={a.id} className="asset-tile" style={{ "--ar": a.ratio }} onClick={() => setOpenA(a)}>
              <window.AssetImg asset={a} w={600} />
              <div className="meta" style={{ opacity: 1, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.75))" }}>
                <div className="clamp-1" style={{ fontWeight: 500, fontSize: 13 }}>{a.title}</div>
                <div className="mono" style={{ opacity: 0.85, marginTop: 2 }}>{a.author} · {a.format}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 64, padding: "24px 0", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: 12 }}>
          <span>© Köhler & Co. — {lang === "de" ? "Alle Rechte vorbehalten" : "All rights reserved"}</span>
          <span className="mono">picpop.app/s/presse-2026</span>
        </div>
      </div>

      {openA && (
        <div className="scrim" onClick={() => setOpenA(null)}>
          <div className="modal" style={{ width: "min(960px, 92vw)", padding: 0 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ position: "relative", aspectRatio: openA.ratio, background: "var(--bg)" }}>
              <window.AssetImg asset={openA} w={1400} />
              <button className="btn icon ghost" onClick={() => setOpenA(null)} style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.9)" }}>
                <window.Icon.x size={14} />
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <div className="h-3">{openA.title}</div>
              <div className="row" style={{ gap: 16, fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                <span>{openA.author}</span>
                <span>{window.fmtDate(openA.date, lang)}</span>
                <span className="num">{openA.width}×{openA.height}</span>
                <span>{openA.format}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------- Recent Uploads (chronological list, grouped by day) --------
function RecentUploadsView({ assets: assetsProp, area, lang, query,
  filterYear, filterMonth, filterTags, filterAuthor,
  onOpenAsset, onOpenFolder, onShareTarget, onDeleteAssets, onBulkAddTag, onBulkSetAuthor, onBulkMoveAssets, imageFolders, pdfFolders }) {
  const assets = assetsProp || window.ASSETS;
  const t = window.makeT(lang);
  const { favorites, bulkSetFavorite } = window.useFav();
  const isPdf = area === "print";
  const [selection, setSelection] = useStateV(() => new Set());
  const [thumbSize, setThumbSize] = window.useThumbSize();
  const [view, setView] = useStateV("grid");
  const tagCols = useTagCols(lang);

  useEffectV(() => { setSelection(new Set()); }, [area, query]);

  const pdfFolderIds = useMemoV(
    () => new Set((pdfFolders || window.PDF_FOLDERS).map(f => f.id)),
    [pdfFolders]
  );
  const allItems = useMemoV(() =>
    [...assets]
      .filter(a => isPdf ? inPrint(a) : !inPrint(a))
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
  [isPdf, assets]);

  const folderNameMap = useMemoV(() => {
    const map = {};
    [...(imageFolders || window.FOLDERS || []), ...(pdfFolders || window.PDF_FOLDERS || [])].forEach(f => { map[f.id] = f.name; });
    return map;
  }, [imageFolders, pdfFolders]);

  const items = useMemoV(() => {
    let xs = allItems;
    if (query) {
      const q = query.toLowerCase();
      xs = xs.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.author.toLowerCase().includes(q) ||
        (a.notes||"").toLowerCase().includes(q) ||
        (a.aiDescription||"").toLowerCase().includes(q) ||
        (folderNameMap[a.folderId] || "").toLowerCase().includes(q) ||
        (window.effectiveTags?.(a) || a.tags).some(tid => { const tg = window.tagById(tid); return tg && (tg.name.toLowerCase().includes(q) || (tg.name_en||"").toLowerCase().includes(q)); })
      );
    }
    if (filterYear) xs = xs.filter(a => { const d = new Date(a.takenAt || a.date); return d.getFullYear() === filterYear; });
    if (filterMonth !== null && filterMonth !== undefined) xs = xs.filter(a => { const d = new Date(a.takenAt || a.date); return d.getMonth() === filterMonth; });
    if (filterTags && filterTags.length > 0) xs = xs.filter(a => filterTags.every(tid => a.tags.includes(tid)));
    if (filterAuthor) xs = xs.filter(a => a.author === filterAuthor);
    return xs;
  }, [allItems, query, filterYear, filterMonth, filterTags, filterAuthor, folderNameMap]);

  // Folder search — only active when query is set
  const matchingFolders = useMemoV(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    const imgFolders = (imageFolders || window.FOLDERS || []).map(f => ({ ...f, _kind: "image" }));
    const printFolders = (pdfFolders || window.PDF_FOLDERS || []).map(f => ({ ...f, _kind: "pdf" }));
    return [...imgFolders, ...printFolders].filter(f => f.name.toLowerCase().includes(q));
  }, [query, imageFolders, pdfFolders]);

  const lastSelRef = useRefV(null);
  function onToggleSelect(id, shift) {
    setSelection(prev => {
      const next = new Set(prev);
      if (shift && lastSelRef.current) {
        const ids = items.map(a => a.id);
        const from = ids.indexOf(lastSelRef.current);
        const to = ids.indexOf(id);
        if (from > -1 && to > -1) {
          const [lo, hi] = from < to ? [from, to] : [to, from];
          for (let i = lo; i <= hi; i++) next.add(ids[i]);
          return next;
        }
      }
      if (next.has(id)) next.delete(id); else next.add(id);
      lastSelRef.current = id;
      return next;
    });
  }
  function clearSel() { setSelection(new Set()); }
  useEffectV(() => {
    if (selection.size === 0) return;
    const fn = (e) => { if (e.key === "Escape") clearSel(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [selection.size]);
  const selArr = [...selection];
  const allFav = selArr.length > 0 && selArr.every(id => favorites.has(id));

  // Group by import batch (batchId if present, otherwise by 10-min proximity)
  const batches = useMemoV(() => {
    const sorted = [...items].sort((a, b) => (a.date < b.date ? 1 : -1));
    const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
    const groups = [];
    sorted.forEach(a => {
      const t = new Date(a.date).getTime();
      if (a.batchId) {
        const existing = groups.find(g => g.batchId === a.batchId);
        if (existing) { existing.assets.push(a); return; }
      } else {
        // Cluster by time proximity for legacy assets without batchId
        const existing = groups.find(g => !g.batchId && Math.abs(new Date(g.date).getTime() - t) < WINDOW_MS);
        if (existing) { existing.assets.push(a); return; }
      }
      groups.push({ batchId: a.batchId || null, date: a.date, assets: [a] });
    });
    return groups;
  }, [items]);

  return (
    <div style={{ padding: "32px 32px 64px" }}>
      {/* Sticky toolbar: count + controls */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--bg)", margin: "-32px -32px 0", padding: "10px 32px", borderBottom: "1px solid var(--line)" }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 16 }}>
          <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>
            {items.length}{items.length !== allItems.length ? ` / ${allItems.length}` : ""}
            {query ? ` · ${lang === "de" ? "Suche" : "search"}` : ""}
          </span>
          <div className="row" style={{ gap: 8 }}>
            {view === "grid" && <window.ThumbSizeSlider size={thumbSize} setSize={setThumbSize} lang={lang} />}
            <div className="row" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 4, padding: 2 }}>
              <button className={"btn icon sm " + (view === "grid" ? "" : "ghost")} onClick={() => setView("grid")} style={{ border: "none" }}><window.Icon.grid size={13} /></button>
              <button className={"btn icon sm " + (view === "list" ? "" : "ghost")} onClick={() => setView("list")} style={{ border: "none" }}><window.Icon.list size={13} /></button>
            </div>
          </div>
        </div>
        {selection.size > 0 && (
          <div style={{ marginTop: 8 }}>
            <window.BulkBar
              count={selection.size} onClear={clearSel} lang={lang} allFavorited={selArr.length > 0 && selArr.every(id => favorites.has(id))}
              onFavorite={() => bulkSetFavorite(selArr, true)}
              onUnfavorite={() => bulkSetFavorite(selArr, false)}
              onShare={() => onShareTarget({ asset: { title: `${selection.size} ${t("items")}`, format: "Auswahl", width: 0, height: 0 } })}
              onApplyTag={(tagId) => { onBulkAddTag?.(selArr, tagId); }}
              onRemoveTag={(tagId) => { selArr.forEach(id => { const a = assets.find(x => x.id === id); if (a) window.updateAssetTags(id, a.tags.filter(t => t !== tagId)); }); }}
              selectedAssets={selArr.map(id => assets.find(a => a.id === id)).filter(Boolean)}
              onApplyAuthor={(user) => { onBulkSetAuthor?.(selArr, user); clearSel(); }}
              onMoveToFolder={(folderId) => { onBulkMoveAssets?.(selArr, folderId); clearSel(); }}
              folders={isPdf ? (pdfFolders || window.PDF_FOLDERS) : (imageFolders || window.FOLDERS)}
              onDelete={() => { onDeleteAssets?.(selArr); setSelection(new Set()); }}
              onDownload={() => bulkDownload(selArr.map(id => items.find(a => a.id === id)).filter(Boolean))}
            />
          </div>
        )}
      </div>

      {/* Folder / campaign search results */}
      {query && matchingFolders.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            {lang === "de" ? "Ordner & Kampagnen" : "Folders & campaigns"} · {matchingFolders.length}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {matchingFolders.map(f => (
              <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <window.FolderTile folder={f} kind={f._kind} onOpen={() => onOpenFolder?.(f.id)} />
                <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {f._kind === "pdf"
                    ? (f.category === "literatur" ? (lang === "de" ? "Literatur" : "Literature") : (lang === "de" ? "Kampagne" : "Campaign"))
                    : (lang === "de" ? "Bilder-Ordner" : "Image folder")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}


      {view === "list" ? (
        /* ── List view ── */
        <div className="card" style={{ overflowX: "auto", marginTop: 24 }}>
          <div className="row" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 700 }}>
            <div style={{ width: 24 }}></div>
            <div style={{ width: 44 }}></div>
            <div style={{ flex: 2 }}>{lang === "de" ? "Titel" : "Title"}</div>
            <div style={{ flex: 1 }}>{t("author")}</div>
            <div style={{ flex: 1 }}>{lang === "de" ? "Ordner" : "Folder"}</div>
            {tagCols.map(({ cat, label }) => <div key={String(cat)} style={{ flex: 1 }}>{label}</div>)}
            <div style={{ width: 110, textAlign: "right" }}>{lang === "de" ? "Datum" : "Date"}</div>
            <div style={{ width: 60 }}></div>
          </div>
          {items.map(a => {
            const folder = window.folderById(a.folderId);
            const author = window.TEAM.find(u => u.name === a.author);
            const isSel = selection.has(a.id);
            const isFav = favorites.has(a.id);
            return (
              <div key={a.id} className="row" style={{ padding: "8px 16px", borderBottom: "1px solid var(--line)", cursor: "pointer", fontSize: 13, minWidth: 700, background: isSel ? "var(--accent-soft)" : "transparent" }} onClick={() => onOpenAsset(a, items)}>
                <div style={{ width: 24 }} onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={isSel} onChange={e => onToggleSelect(a.id, e.nativeEvent.shiftKey)} style={{ accentColor: "var(--accent)", cursor: "pointer" }} />
                </div>
                <div style={{ width: 44, height: 30, marginRight: 12, overflow: "hidden", borderRadius: 2, position: "relative", flexShrink: 0 }}>
                  {a.kind === "pdf" ? <window.PHDark hue={a.hue} label="" /> : <window.AssetImg asset={a} w={120} />}
                </div>
                <div style={{ flex: 2, minWidth: 0 }} className="clamp-1">{a.title}</div>
                <div style={{ flex: 1, minWidth: 0 }} className="row">
                  {author && <window.Avatar user={author} size={18} />}
                  <span style={{ marginLeft: 6 }} className="clamp-1">{a.author}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, color: "var(--muted)" }} className="clamp-1">{folder?.name || "—"}</div>
                {tagCols.map(({ cat }) => <ListTagCell key={String(cat)} asset={a} lang={lang} category={cat} />)}
                <div style={{ width: 110, textAlign: "right", color: "var(--muted)", flexShrink: 0 }} className="mono">{window.fmtDate(a.takenAt || a.date, lang)}</div>
                <div style={{ width: 60, display: "flex", gap: 2, justifyContent: "flex-end", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <DlBtn asset={a} lang={lang} />
                  <button className={"list-fav" + (isFav ? " on" : "")} onClick={() => favorites.has(a.id)}><window.Icon.star size={14} fill={isFav ? "currentColor" : "none"} /></button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Grid view — grouped by import batch ── */
        batches.map((batch, bi) => (
          <div key={batch.batchId || batch.date} style={{ marginTop: 28 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
              <div className="row" style={{ gap: 12, alignItems: "baseline" }}>
                <span className="eyebrow" style={{ color: "var(--muted)", letterSpacing: "0.06em" }}>
                  {lang === "de" ? "Import" : "Import"}
                </span>
                <span className="h-3">{window.fmtDate(batch.date, lang)}</span>
                <span className="mono num" style={{ color: "var(--muted)" }}>{batch.assets.length}</span>
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
                {new Date(batch.date).toLocaleTimeString(lang === "de" ? "de-CH" : "en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="stagger" style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`, gap: 10 }}>
              {batch.assets.map(a => {
                const folder = window.folderById(a.folderId);
                const author = window.TEAM.find(u => u.name === a.author);
                return (
                  <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <window.AssetTile asset={a} onOpen={() => onOpenAsset(a, items)}
                      selectable selected={selection.has(a.id)} onToggleSelect={onToggleSelect}
                      dragIds={selection.has(a.id) ? selArr : [a.id]} />
                    {thumbSize >= 140 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <button className="row" style={{ gap: 5, fontSize: 11, color: "var(--muted)", background: "none", border: "none", padding: 0, cursor: "default", textAlign: "left" }}>
                          {author && <window.Avatar user={author} size={13} />}
                          <span className="clamp-1">{a.author.split(" ")[0]}</span>
                        </button>
                        {folder && (
                          <button className="row" style={{ gap: 4, fontSize: 11, color: "var(--muted)", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }} onClick={e => { e.stopPropagation(); onOpenFolder(folder.id); }}>
                            <window.Icon.folder size={10} />
                            <span className="clamp-1">{folder.name}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {items.length === 0 && (
        <window.Empty
          icon={window.Icon.upload}
          title={query || filterTags?.length || filterYear || filterMonth || filterAuthor ? (lang === "de" ? "Keine Treffer" : "No results") : (lang === "de" ? "Noch keine Uploads" : "No uploads yet")}
          hint={query || filterTags?.length || filterYear || filterMonth || filterAuthor ? (lang === "de" ? "Filter zurücksetzen." : "Clear filters.") : (lang === "de" ? "Lade Dateien hoch, um sie hier zu sehen." : "Upload files to see them here.")}
        />
      )}
    </div>
  );
}

// -------- All Assets (flat grid with filter/sort/view toggle) --------
function AllAssetsView({ assets: assetsProp, area, lang, onOpenAsset, onShareTarget, query, onDeleteAssets, onBulkAddTag, onBulkSetAuthor, onBulkMoveAssets, imageFolders, pdfFolders }) {
  const assets = assetsProp || window.ASSETS;
  const t = window.makeT(lang);
  const { favorites, toggleFavorite, bulkSetFavorite } = window.useFav();
  const [thumbSize, setThumbSize] = window.useThumbSize();
  const isPdf = area === "print";
  const [view, setView] = useStateV("grid");
  const [sort, setSort] = useStateV("newest");
  const [activeTags, setActiveTags] = useStateV(() => new Set());
  const [activeAuthor, setActiveAuthor] = useStateV(null);
  function toggleActiveTag(tid) {
    setActiveTags(prev => {
      const next = new Set(prev);
      next.has(tid) ? next.delete(tid) : next.add(tid);
      return next;
    });
  }
  const [selection, setSelection] = useStateV(() => new Set());
  const tagCols = useTagCols(lang);

  const lastSelRef = useRefV(null);
  function onToggleSelect(id, shift) {
    setSelection(prev => {
      const next = new Set(prev);
      if (shift && lastSelRef.current) {
        const ids = filtered.map(a => a.id);
        const from = ids.indexOf(lastSelRef.current);
        const to = ids.indexOf(id);
        if (from > -1 && to > -1) {
          const [lo, hi] = from < to ? [from, to] : [to, from];
          for (let i = lo; i <= hi; i++) next.add(ids[i]);
          return next;
        }
      }
      if (next.has(id)) next.delete(id); else next.add(id);
      lastSelRef.current = id;
      return next;
    });
  }
  function clearSel() { setSelection(new Set()); }
  useEffectV(() => {
    if (selection.size === 0) return;
    const fn = (e) => { if (e.key === "Escape") clearSel(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [selection.size]);
  const selArr = [...selection];
  const allFav = selArr.length > 0 && selArr.every(id => favorites.has(id));

  const pdfFolderIds = useMemoV(
    () => new Set((pdfFolders || window.PDF_FOLDERS).map(f => f.id)),
    [pdfFolders]
  );
  const all = useMemoV(() =>
    assets.filter(a => isPdf ? inPrint(a) : !inPrint(a)),
  [isPdf, assets]);

  const authors = useMemoV(() => Array.from(new Set(all.map(a => a.author))), [all]);
  const tagIds = useMemoV(() => {
    const s = new Set();
    all.forEach(a => a.tags.forEach(t => s.add(t)));
    // In the Bilder area only show motiv-category tags in the filter bar
    return [...s].filter(tid => {
      if (area === "images") {
        const tg = window.tagById(tid);
        return !tg || !tg.category || tg.category === "motiv";
      }
      return true;
    });
  }, [all, area]);

  const folderNameMap = useMemoV(() => {
    const map = {};
    [...(imageFolders || window.FOLDERS || []), ...(pdfFolders || window.PDF_FOLDERS || [])].forEach(f => { map[f.id] = f.name; });
    return map;
  }, [imageFolders, pdfFolders]);

  const filtered = useMemoV(() => {
    let arr = all;
    if (query) {
      const q = query.toLowerCase();
      arr = arr.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.author.toLowerCase().includes(q) ||
        (a.notes||"").toLowerCase().includes(q) ||
        (a.aiDescription||"").toLowerCase().includes(q) ||
        (folderNameMap[a.folderId] || "").toLowerCase().includes(q) ||
        (window.effectiveTags?.(a) || a.tags).some(tid => { const tg = window.tagById(tid); return tg && (tg.name.toLowerCase().includes(q) || (tg.name_en||"").toLowerCase().includes(q)); })
      );
    }
    if (activeTags.size > 0) arr = arr.filter(a => [...activeTags].every(tid => a.tags.includes(tid)));
    if (activeAuthor) arr = arr.filter(a => a.author === activeAuthor);
    arr = [...arr];
    if (sort === "newest") arr.sort((a, b) => (a.date < b.date ? 1 : -1));
    else if (sort === "oldest") arr.sort((a, b) => (a.date > b.date ? 1 : -1));
    else if (sort === "az") arr.sort((a, b) => a.title.localeCompare(b.title));
    return arr;
  }, [all, query, activeTags, activeAuthor, sort, folderNameMap]);

  return (
    <div style={{ padding: "32px 32px 64px" }}>
      {/* Sticky toolbar: count + filters + controls */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--bg)", margin: "-32px -32px 0", padding: "10px 32px", borderBottom: "1px solid var(--line)" }}>
        <div className="row" style={{ gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
            <span className="mono" style={{ color: "var(--muted)", fontSize: 11, flexShrink: 0 }}>
              {filtered.length}{filtered.length !== all.length ? ` / ${all.length}` : ""}
            </span>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className="eyebrow" style={{ marginRight: 4 }}>{t("filter_by_tag")}</span>
            <span className={"chip" + (activeTags.size === 0 ? " active" : "")} style={{ cursor: "pointer" }} onClick={() => setActiveTags(new Set())}>
              {lang === "de" ? "Alle" : "All"}
            </span>
            {tagIds.slice(0, 12).map(tid => {
              const tg = window.tagById(tid);
              if (!tg) return null;
              const active = activeTags.has(tid);
              return (
                <span key={tid} className="chip" style={{ cursor: "pointer", background: active ? window.tagColor(tg) : window.tagBg(tg), color: active ? "var(--bg)" : window.tagColor(tg), borderColor: active ? "transparent" : undefined, outline: active ? `2px solid ${window.tagColor(tg)}` : "none", outlineOffset: 1 }} onClick={() => toggleActiveTag(tid)}>
                  <span className="tag-dot" style={{ background: active ? "var(--bg)" : window.tagColor(tg) }} />
                  {window.tagLabel(tg, lang)}
                </span>
              );
            })}
          </div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <span className="eyebrow" style={{ marginRight: 4 }}>{t("author")}</span>
              <span className={"chip" + (activeAuthor === null ? " active" : "")} style={{ cursor: "pointer" }} onClick={() => setActiveAuthor(null)}>
                {lang === "de" ? "Alle" : "All"}
              </span>
              {authors.slice(0, 8).map(au => {
                const active = activeAuthor === au;
                const member = window.TEAM.find(u => u.name === au);
                return (
                  <span key={au} className={"chip" + (active ? " active" : "")} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }} onClick={() => setActiveAuthor(active ? null : au)}>
                    {member && <window.Avatar user={member} size={14} />}
                    {au.split(" ")[0]}
                  </span>
                );
              })}
            </div>
          </div>
          {/* Controls: thumbsize + grid/list + sort */}
          <div className="row" style={{ gap: 8, flexShrink: 0 }}>
            <window.ThumbSizeSlider size={thumbSize} setSize={setThumbSize} lang={lang} />
            <div className="row" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 4, padding: 2 }}>
              <button className={"btn icon sm " + (view === "grid" ? "" : "ghost")} onClick={() => setView("grid")} style={{ border: "none" }}><window.Icon.grid size={13} /></button>
              <button className={"btn icon sm " + (view === "list" ? "" : "ghost")} onClick={() => setView("list")} style={{ border: "none" }}><window.Icon.list size={13} /></button>
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ border: "1px solid var(--line-strong)", borderRadius: 4, padding: "6px 8px", background: "var(--panel)", color: "var(--fg)", fontSize: 12 }}>
              <option value="newest">{lang === "de" ? "Neueste zuerst" : "Newest first"}</option>
              <option value="oldest">{lang === "de" ? "Älteste zuerst" : "Oldest first"}</option>
              <option value="az">A → Z</option>
            </select>
          </div>
        </div>
        {selection.size > 0 && (
          <div style={{ marginTop: 8 }}>
        <window.BulkBar
          count={selection.size} onClear={clearSel} lang={lang} allFavorited={allFav}
          onFavorite={() => bulkSetFavorite(selArr, true)}
          onUnfavorite={() => bulkSetFavorite(selArr, false)}
          onShare={() => onShareTarget({ asset: { title: `${selection.size} ${t("items")}`, format: "Auswahl", width: 0, height: 0 } })}
          onApplyTag={(tagId) => { onBulkAddTag?.(selArr, tagId); }}
          onRemoveTag={(tagId) => { selArr.forEach(id => { const a = assets.find(x => x.id === id); if (a) window.updateAssetTags(id, a.tags.filter(t => t !== tagId)); }); }}
          selectedAssets={selArr.map(id => assets.find(a => a.id === id)).filter(Boolean)}
          onApplyAuthor={(user) => { onBulkSetAuthor?.(selArr, user); clearSel(); }}
          onMoveToFolder={(folderId) => { onBulkMoveAssets?.(selArr, folderId); clearSel(); }}
          folders={isPdf ? (pdfFolders || window.PDF_FOLDERS) : (imageFolders || window.FOLDERS)}
          onDelete={() => { onDeleteAssets?.(selArr); clearSel(); }}
          onDownload={() => bulkDownload(selArr.map(id => filtered.find(a => a.id === id)).filter(Boolean))}
        />
          </div>
        )}
      </div>

      {view === "grid" ? (
        <div className="stagger" style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`, gap: 12 }} onClick={clearSel}>
          {filtered.map(a => <window.AssetTile key={a.id} asset={a} onOpen={() => onOpenAsset(a, filtered)}
            selectable selected={selection.has(a.id)} onToggleSelect={onToggleSelect}
            dragIds={selection.has(a.id) ? selArr : [a.id]} />)}
        </div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          {(() => {
            const listRowH = Math.max(36, Math.min(120, Math.round(thumbSize * 0.28)));
            const listThumbW = Math.round(listRowH * 1.5);
            return (<>
              <div className="row" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 700 }}>
                <div style={{ width: 24 }}></div>
                <div style={{ width: listThumbW + 12 }}></div>
                <div style={{ flex: 2 }}>{lang === "de" ? "Titel" : "Title"}</div>
                <div style={{ flex: 1 }}>{t("author")}</div>
                <div style={{ flex: 1 }}>{lang === "de" ? "Ordner" : "Folder"}</div>
                {tagCols.map(({ cat, label }) => <div key={String(cat)} style={{ flex: 1 }}>{label}</div>)}
                <div style={{ width: 110, textAlign: "right" }}>{lang === "de" ? "Datum" : "Date"}</div>
                <div style={{ width: 60 }}></div>
              </div>
              {filtered.map(a => {
                const folder = window.folderById(a.folderId);
                const author = window.TEAM.find(u => u.name === a.author);
                const isSel = selection.has(a.id);
                const isFav = favorites.has(a.id);
                return (
                  <div key={a.id} className="row" style={{ padding: "6px 16px", borderBottom: "1px solid var(--line)", cursor: "pointer", fontSize: 13, minWidth: 700, minHeight: listRowH + 12, background: isSel ? "var(--accent-soft)" : "transparent" }} onClick={() => onOpenAsset(a, filtered)}>
                    <div style={{ width: 24 }} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isSel} onChange={(e) => onToggleSelect(a.id, e.nativeEvent.shiftKey)} style={{ accentColor: "var(--accent)", cursor: "pointer" }} />
                    </div>
                    <div style={{ width: listThumbW, height: listRowH, marginRight: 12, overflow: "hidden", borderRadius: 2, position: "relative", flexShrink: 0 }}>
                      {a.kind === "pdf" ? <window.PHDark hue={a.hue} label="" /> : <window.AssetImg asset={a} w={listThumbW * 2} />}
                    </div>
                    <div style={{ flex: 2, minWidth: 0 }} className="clamp-1">{a.title}</div>
                    <div style={{ flex: 1, minWidth: 0 }} className="row">
                      {author && <window.Avatar user={author} size={18} />}
                      <span style={{ marginLeft: 6 }} className="clamp-1">{a.author}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, color: "var(--muted)" }} className="clamp-1">{folder?.name || "—"}</div>
                    {tagCols.map(({ cat }) => <ListTagCell key={String(cat)} asset={a} lang={lang} category={cat} />)}
                    <div style={{ width: 110, textAlign: "right", color: "var(--muted)", flexShrink: 0 }} className="mono">{window.fmtDate(a.takenAt || a.date, lang)}</div>
                    <div style={{ width: 60, display: "flex", gap: 2, justifyContent: "flex-end", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <DlBtn asset={a} lang={lang} />
                      <button className={"list-fav" + (isFav ? " on" : "")} onClick={() => toggleFavorite(a.id)} title={isFav ? t("favorite_remove") : t("favorite_add")}>
                        <window.Icon.star size={14} fill={isFav ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </>);
          })()}
        </div>
      )}

      {filtered.length === 0 && (
        <window.Empty
          icon={window.Icon.image}
          title={lang === "de" ? "Keine Treffer" : "No results"}
          hint={lang === "de" ? "Filter anpassen oder Suche leeren." : "Adjust filters or clear search."}
        />
      )}
    </div>
  );
}

// -------- Favorites view --------
function FavoritesView({ assets: assetsProp, area, lang, onOpenAsset, onOpenFolder, onShareTarget, query, onDeleteAssets, onBulkAddTag, onBulkSetAuthor, onBulkMoveAssets, imageFolders, pdfFolders }) {
  const assets = assetsProp || window.ASSETS;
  const t = window.makeT(lang);
  const { favorites, toggleFavorite, bulkSetFavorite } = window.useFav();
  const [thumbSize, setThumbSize] = window.useThumbSize();
  const [view, setView] = useStateV("grid");
  const [selection, setSelection] = useStateV(() => new Set());

  const pdfFolderIds = useMemoV(
    () => new Set((pdfFolders || window.PDF_FOLDERS).map(f => f.id)),
    [pdfFolders]
  );
  const favFolderNameMap = useMemoV(() => {
    const map = {};
    [...(imageFolders || window.FOLDERS || []), ...(pdfFolders || window.PDF_FOLDERS || [])].forEach(f => { map[f.id] = f.name; });
    return map;
  }, [imageFolders, pdfFolders]);

  const items = useMemoV(() => {
    let xs = assets.filter(a => favorites.has(a.id));
    if (area === "print") xs = xs.filter(inPrint);
    else xs = xs.filter(a => !inPrint(a));
    if (query) {
      const q = query.toLowerCase();
      xs = xs.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.author.toLowerCase().includes(q) ||
        (a.notes||"").toLowerCase().includes(q) ||
        (a.aiDescription||"").toLowerCase().includes(q) ||
        (favFolderNameMap[a.folderId] || "").toLowerCase().includes(q) ||
        (window.effectiveTags?.(a) || a.tags).some(tid => { const tg = window.tagById(tid); return tg && (tg.name.toLowerCase().includes(q) || (tg.name_en||"").toLowerCase().includes(q)); })
      );
    }
    return [...xs].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [assets, favorites, area, query, favFolderNameMap]);

  const lastSelRef = useRefV(null);
  function onToggleSelect(id, shift) {
    setSelection(prev => {
      const next = new Set(prev);
      if (shift && lastSelRef.current) {
        const ids = items.map(a => a.id);
        const from = ids.indexOf(lastSelRef.current);
        const to = ids.indexOf(id);
        if (from > -1 && to > -1) {
          const [lo, hi] = from < to ? [from, to] : [to, from];
          for (let i = lo; i <= hi; i++) next.add(ids[i]);
          return next;
        }
      }
      if (next.has(id)) next.delete(id); else next.add(id);
      lastSelRef.current = id;
      return next;
    });
  }
  function clearSel() { setSelection(new Set()); }
  useEffectV(() => {
    if (selection.size === 0) return;
    const fn = (e) => { if (e.key === "Escape") clearSel(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [selection.size]);
  const selArr = [...selection];

  return (
    <div style={{ padding: "32px 32px 64px" }}>
      <window.SectionHeader
        eyebrow={t("nav_favorites")}
        title={lang === "de" ? "Deine markierten Assets" : "Your starred assets"}
        sub={`${items.length} ${area === "print" ? (lang === "de" ? "Dokumente" : "documents") : (lang === "de" ? "Bilder" : "images")}`}
        right={
          <div className="row" style={{ gap: 4 }}>
            <window.ThumbSizeSlider size={thumbSize} setSize={setThumbSize} lang={lang} />
            <button className={"btn icon" + (view === "grid" ? " primary" : "")} onClick={() => setView("grid")} title={t("view_grid")}><window.Icon.grid size={14} /></button>
            <button className={"btn icon" + (view === "list" ? " primary" : "")} onClick={() => setView("list")} title={t("view_list")}><window.Icon.list size={14} /></button>
          </div>
        }
      />

      {selection.size > 0 && (
        <window.BulkBar
          count={selection.size} onClear={() => setSelection(new Set())} lang={lang} allFavorited={true}
          onFavorite={() => {}} onUnfavorite={() => { bulkSetFavorite(selArr, false); clearSel(); }}
          onShare={() => onShareTarget({ asset: { title: `${selection.size} ${t("items")}`, format: "Auswahl", width: 0, height: 0 } })}
          onApplyTag={(tagId) => { onBulkAddTag?.(selArr, tagId); }}
          onRemoveTag={(tagId) => { selArr.forEach(id => { const a = assets.find(x => x.id === id); if (a) window.updateAssetTags(id, a.tags.filter(t => t !== tagId)); }); }}
          selectedAssets={selArr.map(id => assets.find(a => a.id === id)).filter(Boolean)}
          onApplyAuthor={(user) => { onBulkSetAuthor?.(selArr, user); clearSel(); }}
          onMoveToFolder={(folderId) => { onBulkMoveAssets?.(selArr, folderId); clearSel(); }}
          folders={area === "print" ? (pdfFolders || window.PDF_FOLDERS) : (imageFolders || window.FOLDERS)}
          onDelete={() => { onDeleteAssets?.(selArr); clearSel(); }}
          onDownload={() => bulkDownload(selArr.map(id => items.find(a => a.id === id)).filter(Boolean))}
        />
      )}

      {items.length === 0 ? (
        <window.Empty
          icon={window.Icon.star}
          title={t("favorites_empty")}
          hint={t("favorites_empty_hint")}
        />
      ) : view === "grid" ? (
        <div className="stagger" style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`, gap: 12 }} onClick={clearSel}>
          {items.map(a => (
            <window.AssetTile key={a.id} asset={a} onOpen={() => onOpenAsset(a, items)}
              selectable selected={selection.has(a.id)} onToggleSelect={onToggleSelect}
              dragIds={selection.has(a.id) ? selArr : [a.id]} />
          ))}
        </div>
      ) : (
        <div className="card">
          {items.map(a => {
            const isSel = selection.has(a.id);
            const folder = window.folderById(a.folderId);
            const favRowH = Math.max(36, Math.min(120, Math.round(thumbSize * 0.28)));
            const favThumbW = Math.round(favRowH * 1.5);
            return (
              <div key={a.id} className="row" onClick={() => onOpenAsset(a, items)} style={{ padding: "6px 16px", borderBottom: "1px solid var(--line)", cursor: "pointer", minHeight: favRowH + 12, background: isSel ? "var(--accent-soft)" : "transparent" }}>
                <div style={{ width: 24 }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isSel} onChange={(e) => onToggleSelect(a.id, e.nativeEvent.shiftKey)} style={{ accentColor: "var(--accent)", cursor: "pointer" }} />
                </div>
                <div style={{ width: favThumbW, height: favRowH, marginRight: 12, overflow: "hidden", borderRadius: 2, position: "relative", flexShrink: 0 }}>
                  {a.kind === "pdf" ? <window.PHDark hue={a.hue} label="" /> : <window.AssetImg asset={a} w={favThumbW * 2} />}
                </div>
                <div style={{ flex: 2, fontWeight: 500, fontSize: 13 }} className="clamp-1">{a.title}</div>
                <div style={{ flex: 1, fontSize: 12, color: "var(--muted)" }} className="clamp-1">{a.author}</div>
                <div style={{ flex: 1, fontSize: 12, color: "var(--muted)" }} className="clamp-1">{folder?.name || "—"}</div>
                <div style={{ width: 100, fontSize: 12, color: "var(--muted)" }} className="mono">{window.fmtDate(a.date, lang)}</div>
                <div style={{ width: 32 }} onClick={(e) => e.stopPropagation()}>
                  <button className="list-fav on" onClick={() => toggleFavorite(a.id)} title={t("favorite_remove")}>
                    <window.Icon.star size={14} fill="currentColor" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { RecentView, FavoritesView, RecentUploadsView, AllAssetsView, FoldersView, FolderDetailView, TagsView, SharedView, ExternalShareView });
