// Views: Recent, Folders, FolderDetail, PDFs, Tags, SharedLinks, Settings, ExternalShare

const { useState: useStateV, useEffect: useEffectV, useMemo: useMemoV, useRef: useRefV } = React;

// ---- Download helper — native browser download ----
function dlAsset(a, e) {
  e.preventDefault(); e.stopPropagation();
  const url = a.storageUrl;
  if (!url) return;
  const ext = a.kind === "pdf" ? "pdf" : (a.format || "jpg").toLowerCase().replace("jpeg", "jpg");
  const fname = (a.title || "download").replace(/[^\w\-]/g, "_") + "." + ext;
  const el = document.createElement("a");
  el.href = url; el.download = fname; el.target = "_blank";
  document.body.appendChild(el); el.click(); document.body.removeChild(el);
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

  useEffectV(() => { setSelection(new Set()); }, [area]);

  function onToggleSelect(id) {
    setSelection(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function clearSel() { setSelection(new Set()); }
  const selArr = [...selection];
  const allFav = selArr.length > 0 && selArr.every(id => favorites.has(id));

  const pinned = isPdf
    ? allPdfFolders.filter(f => f.pinned)
    : allFolders.filter(f => f.pinned);
  const pdfFolderIds = useMemoV(
    () => new Set((allPdfFolders).map(f => f.id)),
    [allPdfFolders]
  );
  const recentAssets = useMemoV(
    () => [...allAssets]
      .filter(a => isPdf ? a.kind === "pdf" : a.kind !== "pdf")
      .sort((a,b) => (a.date < b.date ? 1 : -1)).slice(0, 12),
    [allAssets, isPdf]
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

  return (
    <div style={{ padding: "32px 32px 64px" }}>
      <div className="row" style={{ alignItems: "end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div className="eyebrow">picpop · {isPdf ? "Print" : (lang === "de" ? "Übersicht" : "Overview")}</div>
          <div className="h-display" style={{ marginTop: 8 }}>
            {isPdf
              ? (lang === "de" ? "Drucksachen & Print" : "Print & documents")
              : (() => {
                  const name = currentUser?.displayName || currentUser?.email?.split("@")[0] || "";
                  const h = new Date().getHours();
                  const gr = lang === "de"
                    ? (h < 12 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend")
                    : (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
                  return name ? `${gr}, ${name.split(" ")[0]}` : gr;
                })()}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 8 }}>
            {isPdf
              ? (lang === "de"
                  ? `${allPdfFolders.length} Sammlungen · ${allAssets.filter(a => a.kind === "pdf").length} Dokumente`
                  : `${allPdfFolders.length} collections · ${allAssets.filter(a => a.kind === "pdf").length} documents`)
              : (() => {
                  const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().slice(0,10);
                  const uploadsThisWeek = allAssets.filter(a => a.kind !== "pdf" && a.date >= weekAgo).length;
                  const totalFolders = allFolders.length + allPdfFolders.length;
                  return lang === "de"
                    ? `${totalFolders} Ordner · ${sharedLinks.length} geteilte Links · ${uploadsThisWeek} Uploads diese Woche`
                    : `${totalFolders} folders · ${sharedLinks.length} shared links · ${uploadsThisWeek} uploads this week`;
                })()}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 32 }}>
        <div>
          {/* Pinned folders */}
          <window.SectionHeader eyebrow={t("pinned")} title={lang === "de" ? "Angeheftete Ordner" : "Pinned folders"} />
          <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {pinned.map(f => <window.FolderTile key={f.id} folder={f} kind={isPdf ? "pdf" : "image"} onOpen={() => onOpenFolder(f.id)} />)}
          </div>

          {/* Recent assets */}
          <div style={{ marginTop: 40 }}>
            <window.SectionHeader
              eyebrow={t("nav_recent")}
              title={lang === "de" ? "Zuletzt hinzugefügt" : "Recently added"}
              right={null}
            />
            {selection.size > 0 && (
              <window.BulkBar
                count={selection.size} onClear={clearSel} lang={lang} allFavorited={allFav}
                onFavorite={() => bulkSetFavorite(selArr, true)}
                onUnfavorite={() => bulkSetFavorite(selArr, false)}
                onShare={() => onShareTarget?.({ asset: { title: `${selection.size} ${t("items")}`, format: "Auswahl", width: 0, height: 0 } })}
                onApplyTag={(tagId) => { onBulkAddTag?.(selArr, tagId); }}
                onApplyAuthor={(user) => { onBulkSetAuthor?.(selArr, user); clearSel(); }}
                onMoveToFolder={(folderId) => { onBulkMoveAssets?.(selArr, folderId); clearSel(); }}
                folders={isPdf ? allPdfFolders : allFolders}
                onDelete={() => { onDeleteAssets?.(selArr); clearSel(); }}
              />
            )}
            <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {recentAssets.map(a => (
                <window.AssetTile key={a.id} asset={a} onOpen={() => onOpenAsset(a)}
                  selectable selected={selection.has(a.id)} onToggleSelect={onToggleSelect}
                  dragIds={selection.has(a.id) ? selArr : [a.id]} />
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Storage card — berechnet aus echten Asset-Größen */}
          {(() => {
            const imgMb  = allAssets.filter(a => a.kind !== "pdf").reduce((s,a) => s + (a.size || 0), 0);
            const pdfMb  = allAssets.filter(a => a.kind === "pdf").reduce((s,a) => s + (a.size || 0), 0);
            const totalMb = imgMb + pdfMb;
            const fmt = (mb) => mb >= 1024 ? `${(mb/1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
            const totalLabel = fmt(totalMb);
            const limitGb = 10; // Firebase Storage Free-Tier: 5 GB; Blaze: unbegrenzt — zeige als relativen Wert
            const pct = Math.min(100, (totalMb / (limitGb * 1024)) * 100);
            return (
              <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                <div className="eyebrow" style={{ marginBottom: 12 }}>{t("storage")}</div>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "end" }}>
                  <div className="h-1 num" style={{ fontSize: 36 }}>
                    {totalMb >= 1024
                      ? <>{(totalMb/1024).toFixed(1)} <span style={{ fontSize: 16, color: "var(--muted)" }}>GB</span></>
                      : <>{Math.round(totalMb)} <span style={{ fontSize: 16, color: "var(--muted)" }}>MB</span></>}
                  </div>
                  <div className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>
                    {allAssets.length} {lang === "de" ? "Dateien" : "files"}
                  </div>
                </div>
                <div style={{ height: 4, background: "var(--hover)", borderRadius: 2, marginTop: 12, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(pct, 1)}%`, height: "100%", background: "var(--fg)", transition: "width .4s" }} />
                </div>
                <div className="row" style={{ marginTop: 12, gap: 16, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
                  <span><span className="dot" style={{ background: "var(--fg)" }} /> {lang === "de" ? "Bilder" : "Images"} {fmt(imgMb)}</span>
                  {pdfMb > 0 && <span><span className="dot" style={{ background: "var(--accent)" }} /> PDF {fmt(pdfMb)}</span>}
                </div>
              </div>
            );
          })()}

          {/* Shared links — aus Firestore */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <div className="eyebrow">{t("nav_shared")}</div>
              <span className="mono num" style={{ color: "var(--muted)" }}>{sharedLinks.length}</span>
            </div>
            {sharedLinks.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 0" }}>
                {lang === "de" ? "Keine geteilten Links." : "No shared links yet."}
              </div>
            ) : sharedLinks.slice(0, 4).map(sl => {
              const target = sl.folder
                ? [...allFolders, ...allPdfFolders].find(f => f.id === sl.folder)
                : null;
              const label = target?.name || sl.asset || sl.title || sl.id;
              return (
                <div key={sl.id} className="row" style={{ gap: 10, padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                  <div style={{ width: 28, height: 28, background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <window.Icon.link size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="clamp-1" style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                    <div className="mono" style={{ color: "var(--muted)", fontSize: 10 }}>
                      {sl.views != null ? `${sl.views} views · ` : ""}
                      {sl.expires ? sl.expires : t("never")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Letzte Uploads */}
          <div className="card" style={{ padding: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              {lang === "de" ? "Zuletzt hochgeladen" : "Recently uploaded"}
            </div>
            {recentAssets.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 0" }}>
                {lang === "de" ? "Noch keine Dateien." : "No files yet."}
              </div>
            ) : recentAssets.slice(0, 5).map((a, i) => (
              <div key={a.id} className="row" style={{ gap: 10, padding: "9px 0", borderTop: i > 0 ? "1px solid var(--line)" : "none", cursor: "pointer" }}
                onClick={() => onOpenAsset(a)}>
                <div style={{ width: 36, height: 28, borderRadius: 3, overflow: "hidden", background: "var(--hover)", flexShrink: 0 }}>
                  {a.thumb
                    ? <img src={a.thumb} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <window.Icon.image size={12} style={{ color: "var(--muted)" }} />
                      </div>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="clamp-1" style={{ fontSize: 12, fontWeight: 500 }}>{a.title}</div>
                  <div className="mono" style={{ color: "var(--muted)", fontSize: 10, marginTop: 2 }}>
                    {a.author && <span style={{ marginRight: 6 }}>{a.author}</span>}
                    {a.date ? new Date(a.date).toLocaleDateString(lang === "de" ? "de-DE" : "en-US", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
function FolderDetailView({ assets: assetsProp, folder, onBack, onOpenAsset, onShareTarget, onUpload, onDeleteAssets, onBulkAddTag, onBulkSetAuthor, onBulkMoveAssets, imageFolders, pdfFolders, lang, kind = "image" }) {
  const allAssets = assetsProp || window.ASSETS;
  const t = window.makeT(lang);
  const { favorites, toggleFavorite, bulkSetFavorite } = window.useFav();
  const [thumbSize, setThumbSize] = window.useThumbSize();
  const [q, setQ] = useStateV("");
  const [view, setView] = useStateV("grid");
  const [sort, setSort] = useStateV("date");
  const [filterTag, setFilterTag] = useStateV(null);
  const [filterAuthor, setFilterAuthor] = useStateV(null);
  const [selection, setSelection] = useStateV(() => new Set());
  const lastSelRef = useRefV(null);

  const assets = useMemoV(() => {
    let xs = allAssets.filter(a => a.folderId === folder.id);
    if (q) xs = xs.filter(a => { const lq = q.toLowerCase(); return a.title.toLowerCase().includes(lq) || a.author.toLowerCase().includes(lq) || (a.notes||"").toLowerCase().includes(lq) || (a.aiDescription||"").toLowerCase().includes(lq); });
    if (filterTag) xs = xs.filter(a => a.tags.includes(filterTag));
    if (filterAuthor) xs = xs.filter(a => a.author === filterAuthor);
    if (sort === "date") xs = [...xs].sort((a,b) => (a.date < b.date ? 1 : -1));
    if (sort === "title") xs = [...xs].sort((a,b) => a.title.localeCompare(b.title));
    return xs;
  }, [allAssets, folder.id, q, sort, filterTag, filterAuthor]);

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

      {selection.size > 0 && (
        <window.BulkBar
          count={selection.size} onClear={clearSel} lang={lang} allFavorited={allFav}
          onFavorite={() => bulkSetFavorite(selArr, true)}
          onUnfavorite={() => bulkSetFavorite(selArr, false)}
          onShare={() => onShareTarget({ asset: { title: `${selection.size} ${t("items")}`, format: "Auswahl", width: 0, height: 0 } })}
          onApplyTag={(tagId) => { onBulkAddTag?.(selArr, tagId); }}
          onApplyAuthor={(user) => { onBulkSetAuthor?.(selArr, user); clearSel(); }}
          onMoveToFolder={(folderId) => { onBulkMoveAssets?.(selArr, folderId); clearSel(); }}
          folders={kind === "pdf" ? (pdfFolders || window.PDF_FOLDERS) : (imageFolders || window.FOLDERS)}
          onDelete={() => { onDeleteAssets?.(selArr); clearSel(); }}
        />
      )}

      {/* Toolbar */}
      <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
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
            {(filterTag || filterAuthor || q) && (
              <button className="btn ghost sm" onClick={() => { setFilterTag(null); setFilterAuthor(null); setQ(""); }}>
                <window.Icon.x size={12} /> {t("clear")}
              </button>
            )}
            <button className="btn ghost sm" onClick={selectAll}>{t("select_all")}</button>
          </div>
          <div className="row" style={{ gap: 4 }}>
            {view === "grid" && <window.ThumbSizeSlider size={thumbSize} setSize={setThumbSize} lang={lang} />}
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
            const active = filterTag === tg.id;
            return (
              <span key={tg.id} className="chip" style={{ cursor: "pointer", background: active ? window.tagColor(tg) : window.tagBg(tg), color: active ? "var(--bg)" : window.tagColor(tg), borderColor: "transparent" }}
                onClick={() => setFilterTag(active ? null : tg.id)}>
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

      {assets.length === 0 && <window.Empty title={t("no_results")} hint={t("no_results_hint")} />}

      {view === "grid" && assets.length > 0 && (
        <div className="stagger" style={{ display: "grid", gridTemplateColumns: kind === "pdf" ? `repeat(auto-fill, minmax(${Math.max(160, thumbSize - 20)}px, 1fr))` : `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`, gap: 12, gridAutoFlow: "dense" }}>
          {assets.map(a => (
            <window.AssetTile key={a.id} asset={a} onOpen={() => onOpenAsset(a)}
              selectable selected={selection.has(a.id)} onToggleSelect={onToggleSelect}
              dragIds={selection.has(a.id) ? selArr : [a.id]} />
          ))}
        </div>
      )}

      {view === "list" && assets.length > 0 && (
        <div className="card">
          <div className="row eyebrow" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontSize: 11 }}>
            <div style={{ width: 24 }}></div>
            <div style={{ width: 44 }}>—</div>
            <div style={{ flex: 2 }}>{t("title")}</div>
            <div style={{ flex: 1 }}>{t("author")}</div>
            <div style={{ flex: 1 }}>{t("tags")}</div>
            <div style={{ width: 100 }}>{t("date_taken")}</div>
            <div style={{ width: 70 }} className="num">{t("format")}</div>
            <div style={{ width: 60 }}></div>
          </div>
          {assets.map(a => {
            const isSel = selection.has(a.id);
            const isFav = favorites.has(a.id);
            return (
              <div key={a.id} className="row" onClick={() => onOpenAsset(a)} style={{ padding: "8px 16px", borderBottom: "1px solid var(--line)", cursor: "pointer", height: 56, background: isSel ? "var(--accent-soft)" : "transparent" }}>
                <div style={{ width: 24 }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isSel} onChange={(e) => onToggleSelect(a.id, e.nativeEvent.shiftKey)} style={{ accentColor: "var(--accent)", cursor: "pointer" }} />
                </div>
                <div style={{ width: 44, height: 36, marginRight: 12, overflow: "hidden", borderRadius: 2, position: "relative" }}>
                  {a.kind === "pdf"
                    ? (a.thumbnailUrl
                        ? <img src={a.thumbnailUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <window.PHDark hue={a.hue} label="" />)
                    : <window.AssetImg asset={a} w={120} />}
                </div>
                <div style={{ flex: 2, fontWeight: 500, fontSize: 13 }} className="clamp-1">{a.title}</div>
                <div style={{ flex: 1, fontSize: 12, color: "var(--muted)" }} className="clamp-1">{a.author}</div>
                <div style={{ flex: 1, display: "flex", gap: 4, overflow: "hidden" }}>
                  {a.tags.slice(0,2).map(tid => { const tg = window.tagById(tid); return tg ? <window.TagPill key={tid} tag={tg} lang={lang} /> : null; })}
                </div>
                <div style={{ width: 100, fontSize: 12, color: "var(--muted)" }}>{window.fmtDate(a.date, lang)}</div>
                <div style={{ width: 70 }} className="mono">{a.format}</div>
                <div style={{ width: 60, display: "flex", gap: 2, justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                  <DlBtn asset={a} lang={lang} />
                  <button className={"list-fav" + (isFav ? " on" : "")} onClick={() => toggleFavorite(a.id)} title={isFav ? t("favorite_remove") : t("favorite_add")}>
                    <window.Icon.star size={14} fill={isFav ? "currentColor" : "none"} />
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
            {filtered.map(a => <window.AssetTile key={a.id} asset={a} onOpen={() => onOpenAsset(a)} />)}
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
function RecentUploadsView({ assets: assetsProp, area, lang, onOpenAsset, onOpenFolder, onShareTarget, onDeleteAssets, onBulkAddTag, onBulkSetAuthor, onBulkMoveAssets, imageFolders, pdfFolders }) {
  const assets = assetsProp || window.ASSETS;
  const t = window.makeT(lang);
  const { favorites, bulkSetFavorite } = window.useFav();
  const isPdf = area === "print";
  const [activeTag, setActiveTag] = useStateV(null);
  const [activeAuthor, setActiveAuthor] = useStateV(null);
  const [selection, setSelection] = useStateV(() => new Set());

  // Reset filters when area changes
  useEffectV(() => { setActiveTag(null); setActiveAuthor(null); setSelection(new Set()); }, [area]);

  const pdfFolderIds = useMemoV(
    () => new Set((pdfFolders || window.PDF_FOLDERS).map(f => f.id)),
    [pdfFolders]
  );
  const allItems = useMemoV(() =>
    [...assets]
      .filter(a => isPdf ? a.kind === "pdf" : a.kind !== "pdf")
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
  [isPdf, assets]);

  const items = useMemoV(() => {
    let xs = allItems;
    if (activeTag) xs = xs.filter(a => a.tags.includes(activeTag));
    if (activeAuthor) xs = xs.filter(a => a.author === activeAuthor);
    return xs;
  }, [allItems, activeTag, activeAuthor]);

  const availableTags = useMemoV(() => {
    const s = new Set();
    allItems.forEach(a => a.tags.forEach(tid => s.add(tid)));
    return [...s].map(id => window.tagById(id)).filter(Boolean);
  }, [allItems]);

  const availableAuthors = useMemoV(() =>
    Array.from(new Set(allItems.map(a => a.author))),
  [allItems]);

  function onToggleSelect(id) {
    setSelection(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  const selArr = [...selection];
  const allFav = selArr.length > 0 && selArr.every(id => favorites.has(id));

  // Group by day-bucket
  const groups = useMemoV(() => {
    const now = new Date("2026-05-12T11:00:00").getTime();
    const buckets = { today: [], yesterday: [], week: [], month: [], older: [] };
    items.forEach(a => {
      const d = new Date(a.date).getTime();
      const days = Math.floor((now - d) / 86400000);
      if (days <= 0) buckets.today.push(a);
      else if (days === 1) buckets.yesterday.push(a);
      else if (days <= 7) buckets.week.push(a);
      else if (days <= 30) buckets.month.push(a);
      else buckets.older.push(a);
    });
    return buckets;
  }, [items]);

  const labels = {
    today: lang === "de" ? "Heute" : "Today",
    yesterday: lang === "de" ? "Gestern" : "Yesterday",
    week: lang === "de" ? "Diese Woche" : "This week",
    month: lang === "de" ? "Diesen Monat" : "This month",
    older: lang === "de" ? "Älter" : "Earlier",
  };

  return (
    <div style={{ padding: "32px 32px 64px" }}>
      <window.SectionHeader
        eyebrow={t("nav_uploads")}
        title={lang === "de" ? "Was zuletzt in die Datenbank kam" : "What was uploaded recently"}
        sub={lang === "de"
          ? `${items.length} ${items.length !== allItems.length ? `von ${allItems.length} ` : ""}${isPdf ? "Dokumente" : "Bilder"} · neueste zuerst`
          : `${items.length} ${items.length !== allItems.length ? `of ${allItems.length} ` : ""}${isPdf ? "documents" : "images"} · newest first`}
      />

      {/* Tag + Author filters */}
      {(availableTags.length > 0 || availableAuthors.length > 1) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {availableTags.length > 0 && (
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <span className="eyebrow" style={{ marginRight: 4, alignSelf: "center" }}>{t("filter_by_tag")}</span>
              <span className={"chip" + (activeTag === null ? " active" : "")} style={{ cursor: "pointer" }} onClick={() => setActiveTag(null)}>
                {lang === "de" ? "Alle" : "All"}
              </span>
              {availableTags.map(tg => {
                const active = activeTag === tg.id;
                return (
                  <span key={tg.id} className="chip" style={{ cursor: "pointer", background: active ? window.tagColor(tg) : window.tagBg(tg), color: active ? "var(--bg)" : window.tagColor(tg), borderColor: "transparent" }} onClick={() => setActiveTag(active ? null : tg.id)}>
                    <span className="tag-dot" style={{ background: active ? "var(--bg)" : window.tagColor(tg) }} />
                    {window.tagLabel(tg, lang)}
                  </span>
                );
              })}
            </div>
          )}
          {availableAuthors.length > 1 && (
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <span className="eyebrow" style={{ marginRight: 4, alignSelf: "center" }}>{t("author")}</span>
              <span className={"chip" + (activeAuthor === null ? " active" : "")} style={{ cursor: "pointer" }} onClick={() => setActiveAuthor(null)}>
                {lang === "de" ? "Alle" : "All"}
              </span>
              {availableAuthors.map(au => {
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
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selection.size > 0 && (
        <window.BulkBar
          count={selection.size} onClear={() => setSelection(new Set())} lang={lang} allFavorited={allFav}
          onFavorite={() => bulkSetFavorite(selArr, true)}
          onUnfavorite={() => bulkSetFavorite(selArr, false)}
          onShare={() => onShareTarget({ asset: { title: `${selection.size} ${t("items")}`, format: "Auswahl", width: 0, height: 0 } })}
          onApplyTag={(tagId) => { onBulkAddTag?.(selArr, tagId); }}
          onApplyAuthor={(user) => { onBulkSetAuthor?.(selArr, user); setSelection(new Set()); }}
          onMoveToFolder={(folderId) => { onBulkMoveAssets?.(selArr, folderId); setSelection(new Set()); }}
          folders={isPdf ? (pdfFolders || window.PDF_FOLDERS) : (imageFolders || window.FOLDERS)}
          onDelete={() => { onDeleteAssets?.(selArr); setSelection(new Set()); }}
        />
      )}

      {Object.keys(groups).map(key => {
        const bucket = groups[key];
        if (bucket.length === 0) return null;
        return (
          <div key={key} style={{ marginTop: 28 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
              <div className="row" style={{ gap: 12, alignItems: "baseline" }}>
                <span className="h-3">{labels[key]}</span>
                <span className="mono num" style={{ color: "var(--muted)" }}>{bucket.length}</span>
              </div>
              <span className="mono" style={{ color: "var(--muted)" }}>
                {window.fmtDate(bucket[0].date, lang)}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
              {bucket.map(a => {
                const folder = window.folderById(a.folderId);
                const author = window.TEAM.find(u => u.name === a.author);
                return (
                  <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <window.AssetTile
                      asset={a}
                      onOpen={() => onOpenAsset(a)}
                      selectable
                      selected={selection.has(a.id)}
                      onToggleSelect={onToggleSelect}
                      dragIds={selection.has(a.id) ? selArr : [a.id]}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button
                        className="row"
                        style={{ gap: 5, fontSize: 11, color: "var(--muted)", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                        onClick={() => setActiveAuthor(activeAuthor === a.author ? null : a.author)}
                        title={a.author}
                      >
                        {author && <window.Avatar user={author} size={14} />}
                        <span className="clamp-1">{a.author.split(" ")[0]}</span>
                      </button>
                      {folder && (
                        <button
                          className="row"
                          style={{ gap: 4, fontSize: 11, color: "var(--muted)", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                          onClick={(e) => { e.stopPropagation(); onOpenFolder(folder.id); }}
                          title={folder.name}
                        >
                          <window.Icon.folder size={10} />
                          <span className="clamp-1">{folder.name}</span>
                        </button>
                      )}
                      {a.tags.length > 0 && (
                        <div className="row" style={{ gap: 3, flexWrap: "wrap" }}>
                          {a.tags.slice(0, 2).map(tid => {
                            const tg = window.tagById(tid);
                            if (!tg) return null;
                            return (
                              <span key={tid} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, padding: "1px 5px", borderRadius: 3, background: window.tagBg(tg), color: window.tagColor(tg), cursor: "pointer" }} onClick={() => setActiveTag(activeTag === tid ? null : tid)}>
                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: window.tagColor(tg), flexShrink: 0 }} />
                                {window.tagLabel(tg, lang)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {items.length === 0 && (
        <window.Empty
          icon={window.Icon.upload}
          title={activeTag || activeAuthor ? (lang === "de" ? "Keine Treffer" : "No results") : (lang === "de" ? "Noch keine Uploads" : "No uploads yet")}
          hint={activeTag || activeAuthor ? (lang === "de" ? "Filter zurücksetzen." : "Clear filters.") : (lang === "de" ? "Lade Dateien hoch, um sie hier zu sehen." : "Upload files to see them here.")}
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
  const [activeTag, setActiveTag] = useStateV(null);
  const [activeAuthor, setActiveAuthor] = useStateV(null);
  const [selection, setSelection] = useStateV(() => new Set());

  function onToggleSelect(id) {
    setSelection(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  const selArr = [...selection];
  const allFav = selArr.length > 0 && selArr.every(id => favorites.has(id));

  const pdfFolderIds = useMemoV(
    () => new Set((pdfFolders || window.PDF_FOLDERS).map(f => f.id)),
    [pdfFolders]
  );
  const all = useMemoV(() =>
    assets.filter(a => isPdf ? a.kind === "pdf" : a.kind !== "pdf"),
  [isPdf, assets]);

  const authors = useMemoV(() => Array.from(new Set(all.map(a => a.author))), [all]);
  const tagIds = useMemoV(() => {
    const s = new Set();
    all.forEach(a => a.tags.forEach(t => s.add(t)));
    return [...s];
  }, [all]);

  const filtered = useMemoV(() => {
    let arr = all;
    if (query) {
      const q = query.toLowerCase();
      arr = arr.filter(a => a.title.toLowerCase().includes(q) || a.author.toLowerCase().includes(q) || (a.notes||"").toLowerCase().includes(q) || (a.aiDescription||"").toLowerCase().includes(q));
    }
    if (activeTag) arr = arr.filter(a => a.tags.includes(activeTag));
    if (activeAuthor) arr = arr.filter(a => a.author === activeAuthor);
    arr = [...arr];
    if (sort === "newest") arr.sort((a, b) => (a.date < b.date ? 1 : -1));
    else if (sort === "oldest") arr.sort((a, b) => (a.date > b.date ? 1 : -1));
    else if (sort === "az") arr.sort((a, b) => a.title.localeCompare(b.title));
    return arr;
  }, [all, query, activeTag, activeAuthor, sort]);

  return (
    <div style={{ padding: "32px 32px 64px" }}>
      <window.SectionHeader
        eyebrow={isPdf ? t("nav_all_pdfs") : t("nav_all_images")}
        title={isPdf
          ? (lang === "de" ? "Alle Dokumente" : "All documents")
          : (lang === "de" ? "Alle Bilder" : "All images")}
        sub={`${filtered.length} ${lang === "de" ? "von" : "of"} ${all.length}`}
        right={
          <div className="row" style={{ gap: 8 }}>
            {view === "grid" && <window.ThumbSizeSlider size={thumbSize} setSize={setThumbSize} lang={lang} />}
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
        }
      />

      {/* Filters */}
      <div className="row" style={{ gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>{t("filter_by_tag")}</span>
          <span className={"chip" + (activeTag === null ? " active" : "")} style={{ cursor: "pointer" }} onClick={() => setActiveTag(null)}>
            {lang === "de" ? "Alle" : "All"}
          </span>
          {tagIds.slice(0, 8).map(tid => {
            const tg = window.tagById(tid);
            if (!tg) return null;
            const active = activeTag === tid;
            return (
              <span key={tid} className="chip" style={{ cursor: "pointer", background: active ? window.tagColor(tg) : window.tagBg(tg), color: active ? "var(--bg)" : window.tagColor(tg), borderColor: "transparent" }} onClick={() => setActiveTag(active ? null : tid)}>
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

      {/* Body */}
      {selection.size > 0 && (
        <window.BulkBar
          count={selection.size} onClear={() => setSelection(new Set())} lang={lang} allFavorited={allFav}
          onFavorite={() => bulkSetFavorite(selArr, true)}
          onUnfavorite={() => bulkSetFavorite(selArr, false)}
          onShare={() => onShareTarget({ asset: { title: `${selection.size} ${t("items")}`, format: "Auswahl", width: 0, height: 0 } })}
          onApplyTag={(tagId) => { onBulkAddTag?.(selArr, tagId); }}
          onApplyAuthor={(user) => { onBulkSetAuthor?.(selArr, user); setSelection(new Set()); }}
          onMoveToFolder={(folderId) => { onBulkMoveAssets?.(selArr, folderId); setSelection(new Set()); }}
          folders={isPdf ? (pdfFolders || window.PDF_FOLDERS) : (imageFolders || window.FOLDERS)}
          onDelete={() => { onDeleteAssets?.(selArr); setSelection(new Set()); }}
        />
      )}
      {view === "grid" ? (
        <div className="stagger" style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`, gap: 12 }}>
          {filtered.map(a => <window.AssetTile key={a.id} asset={a} onOpen={() => onOpenAsset(a)}
            selectable selected={selection.has(a.id)} onToggleSelect={onToggleSelect}
            dragIds={selection.has(a.id) ? selArr : [a.id]} />)}
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="row" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <div style={{ width: 24 }}></div>
            <div style={{ width: 44 }}></div>
            <div style={{ flex: 2 }}>{lang === "de" ? "Titel" : "Title"}</div>
            <div style={{ flex: 1 }}>{t("author")}</div>
            <div style={{ flex: 1 }}>{lang === "de" ? "Ordner" : "Folder"}</div>
            <div style={{ width: 110, textAlign: "right" }}>{lang === "de" ? "Datum" : "Date"}</div>
            <div style={{ width: 100, textAlign: "right" }}>{t("format")}</div>
            <div style={{ width: 60 }}></div>
          </div>
          {filtered.map(a => {
            const folder = window.folderById(a.folderId);
            const author = window.TEAM.find(u => u.name === a.author);
            const isSel = selection.has(a.id);
            const isFav = favorites.has(a.id);
            return (
              <div key={a.id} className="row" style={{ padding: "8px 16px", borderBottom: "1px solid var(--line)", cursor: "pointer", fontSize: 13, background: isSel ? "var(--accent-soft)" : "transparent" }} onClick={() => onOpenAsset(a)}>
                <div style={{ width: 24 }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isSel} onChange={() => onToggleSelect(a.id)} style={{ accentColor: "var(--accent)", cursor: "pointer" }} />
                </div>
                <div style={{ width: 44, height: 30, marginRight: 12, overflow: "hidden", borderRadius: 2, position: "relative", flexShrink: 0 }}>
                  {a.kind === "pdf" ? <window.PHDark hue={a.hue} label="" /> : <window.AssetImg asset={a} w={120} />}
                </div>
                <div style={{ flex: 2, minWidth: 0 }} className="clamp-1">{a.title}</div>
                <div style={{ flex: 1, minWidth: 0 }} className="row" >
                  {author && <window.Avatar user={author} size={18} />}
                  <span style={{ marginLeft: 6 }} className="clamp-1">{a.author}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, color: "var(--muted)" }} className="clamp-1">{folder?.name || "—"}</div>
                <div style={{ width: 110, textAlign: "right", color: "var(--muted)" }} className="mono">{window.fmtDate(a.date, lang)}</div>
                <div style={{ width: 100, textAlign: "right", color: "var(--muted)" }} className="mono">{a.format}</div>
                <div style={{ width: 60, display: "flex", gap: 2, justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                  <DlBtn asset={a} lang={lang} />
                  <button className={"list-fav" + (isFav ? " on" : "")} onClick={() => toggleFavorite(a.id)} title={isFav ? t("favorite_remove") : t("favorite_add")}>
                    <window.Icon.star size={14} fill={isFav ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            );
          })}
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
  const items = useMemoV(() => {
    let xs = assets.filter(a => favorites.has(a.id));
    if (area === "print") xs = xs.filter(a => a.kind === "pdf");
    else xs = xs.filter(a => a.kind !== "pdf");
    if (query) {
      const q = query.toLowerCase();
      xs = xs.filter(a => a.title.toLowerCase().includes(q) || a.author.toLowerCase().includes(q) || (a.notes||"").toLowerCase().includes(q) || (a.aiDescription||"").toLowerCase().includes(q));
    }
    return [...xs].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [assets, favorites, area, query]);

  function onToggleSelect(id) {
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const selArr = [...selection];

  return (
    <div style={{ padding: "32px 32px 64px" }}>
      <window.SectionHeader
        eyebrow={t("nav_favorites")}
        title={lang === "de" ? "Deine markierten Assets" : "Your starred assets"}
        sub={`${items.length} ${area === "print" ? (lang === "de" ? "Dokumente" : "documents") : (lang === "de" ? "Bilder" : "images")}`}
        right={
          <div className="row" style={{ gap: 4 }}>
            {view === "grid" && <window.ThumbSizeSlider size={thumbSize} setSize={setThumbSize} lang={lang} />}
            <button className={"btn icon" + (view === "grid" ? " primary" : "")} onClick={() => setView("grid")} title={t("view_grid")}><window.Icon.grid size={14} /></button>
            <button className={"btn icon" + (view === "list" ? " primary" : "")} onClick={() => setView("list")} title={t("view_list")}><window.Icon.list size={14} /></button>
          </div>
        }
      />

      {selection.size > 0 && (
        <window.BulkBar
          count={selection.size} onClear={() => setSelection(new Set())} lang={lang} allFavorited={true}
          onFavorite={() => {}} onUnfavorite={() => { bulkSetFavorite(selArr, false); setSelection(new Set()); }}
          onShare={() => onShareTarget({ asset: { title: `${selection.size} ${t("items")}`, format: "Auswahl", width: 0, height: 0 } })}
          onApplyTag={(tagId) => { onBulkAddTag?.(selArr, tagId); }}
          onApplyAuthor={(user) => { onBulkSetAuthor?.(selArr, user); setSelection(new Set()); }}
          onMoveToFolder={(folderId) => { onBulkMoveAssets?.(selArr, folderId); setSelection(new Set()); }}
          folders={area === "print" ? (pdfFolders || window.PDF_FOLDERS) : (imageFolders || window.FOLDERS)}
          onDelete={() => { onDeleteAssets?.(selArr); setSelection(new Set()); }}
        />
      )}

      {items.length === 0 ? (
        <window.Empty
          icon={window.Icon.star}
          title={t("favorites_empty")}
          hint={t("favorites_empty_hint")}
        />
      ) : view === "grid" ? (
        <div className="stagger" style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`, gap: 12 }}>
          {items.map(a => (
            <window.AssetTile key={a.id} asset={a} onOpen={() => onOpenAsset(a)}
              selectable selected={selection.has(a.id)} onToggleSelect={onToggleSelect}
              dragIds={selection.has(a.id) ? selArr : [a.id]} />
          ))}
        </div>
      ) : (
        <div className="card">
          {items.map(a => {
            const isSel = selection.has(a.id);
            const folder = window.folderById(a.folderId);
            return (
              <div key={a.id} className="row" onClick={() => onOpenAsset(a)} style={{ padding: "8px 16px", borderBottom: "1px solid var(--line)", cursor: "pointer", height: 56, background: isSel ? "var(--accent-soft)" : "transparent" }}>
                <div style={{ width: 24 }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isSel} onChange={() => onToggleSelect(a.id)} style={{ accentColor: "var(--accent)", cursor: "pointer" }} />
                </div>
                <div style={{ width: 44, height: 36, marginRight: 12, overflow: "hidden", borderRadius: 2, position: "relative" }}>
                  {a.kind === "pdf" ? <window.PHDark hue={a.hue} label="" /> : <window.AssetImg asset={a} w={120} />}
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
