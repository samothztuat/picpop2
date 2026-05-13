// Modals: Asset detail, Share dialog, Upload flow

const { useState: useStateM, useEffect: useEffectM, useRef: useRefM, useMemo: useMemoM } = React;

function AssetDetailModal({ open, asset, peerAssets, onNavigate, onClose, onShare, onChange, onDelete, lang }) {
  // ── ALL HOOKS FIRST — never call hooks conditionally (Rules of Hooks) ──────
  const t = window.makeT(lang);
  const [tags, setTags] = useStateM(asset?.tags ?? []);
  const [notes, setNotes] = useStateM(asset?.notes ?? "");
  const [title, setTitle] = useStateM(asset?.title ?? "");
  const [showTagPicker, setShowTagPicker] = useStateM(false);
  const [showAuthorPicker, setShowAuthorPicker] = useStateM(false);
  const [lightbox, setLightbox] = useStateM(false);
  const [downloadRes, setDownloadRes] = useStateM(0);
  // New-tag creation state
  const [newTagName, setNewTagName] = useStateM("");
  const newTagInputRef = useRefM(null);
  const titleInputRef  = useRefM(null);
  // PDF dimensions — from Firestore fields (set during upload) or null
  const [pdfDims, setPdfDims] = useStateM(null);
  // AI description
  const [aiDesc, setAiDesc] = useStateM(asset?.aiDescription ?? "");

  // Sync local state whenever the opened asset changes
  useEffectM(() => {
    if (!asset) return;
    setTags(asset.tags); setNotes(asset.notes || ""); setTitle(asset.title);
    setAiDesc(asset.aiDescription || "");
    setShowTagPicker(false); setShowAuthorPicker(false);
    setNewTagName(""); setDownloadRes(0);
    // Read dimensions from Firestore fields (stored during upload)
    if (asset?.widthMm && asset?.heightMm) {
      setPdfDims({ w: asset.widthMm, h: asset.heightMm });
    } else {
      setPdfDims(null);
    }
  }, [asset?.id]);

  // Focus input when picker opens
  useEffectM(() => {
    if (showTagPicker) setTimeout(() => newTagInputRef.current?.focus(), 60);
  }, [showTagPicker]);

  // Keyboard navigation + fullscreen
  useEffectM(() => {
    if (!open) return;
    const peers = peerAssets || [];
    const idx = asset ? peers.findIndex(a => a.id === asset.id) : -1;
    const prev = idx > 0 ? peers[idx - 1] : null;
    const next = idx >= 0 && idx < peers.length - 1 ? peers[idx + 1] : null;
    function handleKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Escape") { setLightbox(false); }
      if (e.key === "ArrowLeft"  && prev) { onNavigate?.(prev); }
      if (e.key === "ArrowRight" && next) { onNavigate?.(next); }
      if ((e.key === "f" || e.key === "F") && asset?.kind !== "pdf") { setLightbox(v => !v); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, asset?.id, peerAssets]);

  // Guard AFTER all hooks — safe early-exit when modal is closed / no asset
  if (!asset) return null;

  // Detect print area from asset's folder
  const isPrintArea = (window.PDF_FOLDERS || []).some(f => f.id === asset.folderId);

  // Prev / next within peerAssets
  const peers = peerAssets || [];
  const peerIdx = peers.findIndex(a => a.id === asset.id);
  const prevAsset = peerIdx > 0 ? peers[peerIdx - 1] : null;
  const nextAsset = peerIdx >= 0 && peerIdx < peers.length - 1 ? peers[peerIdx + 1] : null;

  const availableTags = (window.TAGS || []).filter(tg => !tags.includes(tg.id));
  const folder = window.folderById(asset.folderId);
  const author = (window.TEAM || []).find(u => u.name === asset.author);

  function save(patch) {
    onChange({ ...asset, ...patch });
  }

  function createTag() {
    const name = newTagName.trim();
    if (!name) return;
    const id = "t-" + Date.now();
    const tag = { id, name, name_en: name, hue: 0 };
    // Save to Firestore
    window.dbSaveTag(tag);
    // Add to local window.TAGS so it's immediately available
    window.TAGS = [...window.TAGS, tag];
    // Add to this asset
    const next = [...tags, id];
    setTags(next);
    save({ tags: next });
    setNewTagName("");
    setShowTagPicker(false);
  }

  // Native browser download — uses browser's own save/download dialog
  function nativeDownload(url, fname) {
    const a = document.createElement("a");
    a.href = url; a.download = fname; a.target = "_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  // Download helper — resizes via canvas for images, native link for original / PDFs
  function triggerDownload(a, maxPx) {
    const url = a.storageUrl;
    if (!url) return;
    const ext = (a.format || "jpg").toLowerCase().replace("jpeg", "jpg");
    const safe = (a.title || "download").replace(/[^\w\-]/g, "_");
    const fname = safe + (maxPx ? `_${maxPx}px` : "") + "." + ext;
    if (!maxPx) {
      nativeDownload(url, fname);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxPx) { h = Math.round(h * maxPx / w); w = maxPx; }
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      cv.toBlob(blob => {
        const burl = URL.createObjectURL(blob);
        const el = document.createElement("a");
        el.href = burl; el.download = fname;
        document.body.appendChild(el); el.click(); document.body.removeChild(el);
        setTimeout(() => URL.revokeObjectURL(burl), 2000);
      }, "image/jpeg", 0.92);
    };
    img.onerror = () => { window.open(url, "_blank"); };
    img.src = url;
  }

  // Always show PDF viewer for real PDFs
  const isPdfViewer = asset.kind === "pdf" && !!asset.storageUrl;

  const navBtnStyle = { position: "fixed", top: "50%", transform: "translateY(-50%)", zIndex: 65, background: "rgba(20,20,18,0.72)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", borderRadius: 8, width: 48, height: 48, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", transition: "background .15s" };

  return (
    <>
    {/* Navigation arrows — outside the modal frame */}
    {open && prevAsset && (
      <button style={{ ...navBtnStyle, left: 16 }} onClick={() => onNavigate?.(prevAsset)} title={prevAsset.title}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(40,40,36,0.92)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(20,20,18,0.72)"}
      >
        <window.Icon.arrowL size={20} />
      </button>
    )}
    {open && nextAsset && (
      <button style={{ ...navBtnStyle, right: 16 }} onClick={() => onNavigate?.(nextAsset)} title={nextAsset.title}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(40,40,36,0.92)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(20,20,18,0.72)"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    )}
    <window.Modal open={open} onClose={onClose} width={1584} padding={0} overflow="hidden">
      {/* Lightbox — fullscreen overlay */}
      {lightbox && asset.kind !== "pdf" && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9900, background: "rgba(0,0,0,0.96)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setLightbox(false)}
        >
          {/* Close */}
          <button onClick={e => { e.stopPropagation(); setLightbox(false); }} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 6, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
            <window.Icon.x size={16} />
          </button>
          {/* Prev */}
          {prevAsset && (
            <button onClick={e => { e.stopPropagation(); onNavigate?.(prevAsset); }} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, width: 44, height: 44, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
              <window.Icon.arrowL size={18} />
            </button>
          )}
          {/* Next */}
          {nextAsset && (
            <button onClick={e => { e.stopPropagation(); onNavigate?.(nextAsset); }} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, width: 44, height: 44, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </button>
          )}
          {/* Image */}
          <img
            src={asset.storageUrl || window.imgUrl(asset.id + "-" + asset.title, 3200, Math.round(3200 / (asset.ratio || 1)))}
            alt={asset.title}
            draggable={false}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "95vw", maxHeight: "92vh", objectFit: "contain", display: "block", borderRadius: 2 }}
          />
          {/* Caption */}
          <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 12, pointerEvents: "none" }}>
            {asset.title}
            {peers.length > 1 && peerIdx >= 0 && (
              <span style={{ marginLeft: 14, opacity: 0.45 }}>{peerIdx + 1} / {peers.length}</span>
            )}
          </div>
        </div>
      )}

      {/* Fixed height grid so both preview column and sidebar can use height:100% */}
      <div style={{
        display: "grid", gridTemplateColumns: "1.4fr 1fr",
        height: "min(90vh, 1296px)",
      }}>
        {/* Preview — always fills column, content-fit via contain / iframe */}
        <div style={{
          background: "var(--bg)", position: "relative",
          borderRight: "1px solid var(--line)",
          display: "flex", flexDirection: "column",
          height: "100%", overflow: "hidden",
        }}>
          <button className="btn icon ghost" onClick={onClose} style={{ position: "absolute", top: 16, left: 16, zIndex: 2 }} aria-label={t("close")}>
            <window.Icon.arrowL size={16} />
          </button>

          {/* Expand to fullscreen — images only */}
          {asset.kind !== "pdf" && (
            <button
              onClick={() => setLightbox(true)}
              style={{ position: "absolute", top: 16, right: 16, zIndex: 2 }}
              className="btn icon ghost"
              title={lang === "de" ? "Vollbild (F)" : "Fullscreen (F)"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            </button>
          )}

          {isPdfViewer ? (
            <window.PdfViewer url={asset.storageUrl} lang={lang} pages={asset.pages || 1} />
          ) : asset.kind === "pdf" ? (
            // Mock PDF (no storageUrl) — placeholder centred
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
              <div style={{ width: "100%", maxWidth: 420, aspectRatio: asset.ratio || 0.71, position: "relative" }}>
                <window.PHDark hue={asset.hue} label={asset.format} />
              </div>
            </div>
          ) : (
            // Real image — fill column, longest side fits, no crop
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, minHeight: 0 }}>
              <img
                src={asset.storageUrl || window.imgUrl(asset.id + "-" + asset.title, 1200, Math.round(1200 / (asset.ratio || 1)))}
                alt={asset.title}
                draggable={false}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
              />
            </div>
          )}
        </div>

        {/* Sidebar — fixed height, inner content scrolls */}
        <div style={{
          display: "flex", flexDirection: "column", height: "100%", overflow: "hidden",
        }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <div className="eyebrow">{folder ? folder.name : ""}</div>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn sm icon ghost" title={t("delete")} onClick={() => onDelete?.([asset.id])}><window.Icon.trash size={14} /></button>
              </div>
            </div>
            <div className="row" style={{ gap: 6, alignItems: "flex-start" }}>
              <input
                ref={titleInputRef}
                className="h-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => { if (title.trim()) save({ title: title.trim() }); else setTitle(asset.title); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.currentTarget.blur(); }
                  if (e.key === "Escape") { setTitle(asset.title); e.currentTarget.blur(); }
                }}
                style={{ flex: 1, border: "none", background: "transparent", outline: "none", padding: 0,
                  borderBottom: "1px dashed transparent", transition: "border-color .15s" }}
                onMouseEnter={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderBottomColor = "var(--line-strong)"; }}
                onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderBottomColor = "transparent"; }}
                onFocus={e => { e.currentTarget.style.borderBottomColor = "var(--accent)"; e.currentTarget.select(); }}
              />
              <button
                className="btn icon ghost sm"
                style={{ flexShrink: 0, marginTop: 4, opacity: 0.45 }}
                onClick={() => titleInputRef.current?.focus()}
                title={lang === "de" ? "Umbenennen" : "Rename"}
                onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                onMouseLeave={e => e.currentTarget.style.opacity = "0.45"}
              >
                <window.Icon.edit size={13} />
              </button>
            </div>
            <div className="row" style={{ gap: 12, marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
              <span>{window.fmtDate(asset.date, lang)}</span>
              <span>·</span>
              <span className="num">{asset.kind === "pdf" ? `${asset.pages} ${t("pdf_pages",{n:asset.pages}).split(" ")[1]} · ${asset.size} MB` : `${asset.width}×${asset.height}`}</span>
              {asset.kind === "pdf" && pdfDims && (
                <>
                  <span>·</span>
                  <span className="num" title={lang === "de" ? "Seitenformat" : "Page size"}>{pdfDims.w} × {pdfDims.h} mm</span>
                </>
              )}
              <span>·</span>
              <span>{asset.format}</span>
            </div>
          </div>

          <div className="scroll" style={{ padding: "16px 24px", flex: 1 }}>
            {/* Author — clickable picker */}
            <div style={{ marginBottom: 16, position: "relative" }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>{t("author")}</div>
              <div
                className="row"
                style={{ gap: 10, cursor: "pointer", padding: "6px 8px", borderRadius: 6, border: `1px solid ${showAuthorPicker ? "var(--accent)" : "var(--line)"}`, background: showAuthorPicker ? "var(--hover)" : "transparent", transition: "border-color .15s" }}
                onClick={() => setShowAuthorPicker(v => !v)}
              >
                {author
                  ? <window.Avatar user={author} size={28} />
                  : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--hover)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>?</div>
                }
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{asset.author}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{t(asset.authorRole === "designer" ? "designer" : asset.authorRole === "agency" ? "agency" : asset.authorRole === "in_house" ? "in_house" : "photographer")}</div>
                </div>
                <window.Icon.chevD size={13} style={{ color: "var(--muted)", flexShrink: 0 }} />
              </div>
              {showAuthorPicker && (
                <div className="card" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 40, padding: 6, boxShadow: "var(--shadow)", maxHeight: 260, overflow: "auto" }}>
                  {window.TEAM.map(u => {
                    const isActive = asset.author === u.name;
                    return (
                      <div key={u.id} className="row"
                        style={{ padding: "8px 10px", borderRadius: 4, cursor: "pointer", gap: 10, background: isActive ? "var(--accent-soft)" : "transparent" }}
                        onClick={() => { save({ author: u.name, authorRole: "in_house" }); setShowAuthorPicker(false); }}
                      >
                        <window.Avatar user={u} size={24} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{u.dept} · {u.role}</div>
                        </div>
                        {isActive && <window.Icon.check size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tags */}
            <div style={{ marginBottom: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>{t("tags")}</div>
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                {tags.map(tid => {
                  const tg = window.tagById(tid);
                  if (!tg) return null;
                  return <window.TagPill key={tid} tag={tg} lang={lang} onRemove={() => { const next = tags.filter(x => x !== tid); setTags(next); save({ tags: next }); }} />;
                })}
                <span className="chip" style={{ cursor: "pointer", color: showTagPicker ? "var(--fg)" : "var(--muted)", borderStyle: "dashed", background: showTagPicker ? "var(--hover)" : "transparent" }} onClick={() => setShowTagPicker(v => !v)}>
                  {showTagPicker ? <window.Icon.x size={10} /> : <window.Icon.plus size={10} />}
                  {showTagPicker ? (lang === "de" ? "Schließen" : "Close") : t("add_tag")}
                </span>
              </div>
              {showTagPicker && (
                <div className="card" style={{ marginTop: 8, padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>

                  {/* Tag chips — grouped by category for print area */}
                  {(() => {
                    if (availableTags.length === 0) return (
                      <div style={{ fontSize: 12, color: "var(--muted)", padding: "2px 4px" }}>
                        {lang === "de" ? "Alle Tags vergeben." : "All tags applied."}
                      </div>
                    );
                    const addTag = (id) => { const next = [...tags, id]; setTags(next); save({ tags: next }); };
                    const renderChip = (tg) => (
                      <span key={tg.id} className="chip" style={{ cursor: "pointer", background: window.tagBg(tg), color: window.tagColor(tg), borderColor: "transparent" }}
                        onClick={() => addTag(tg.id)}>
                        <span className="tag-dot" style={{ background: window.tagColor(tg) }} />
                        {window.tagLabel(tg, lang)}
                      </span>
                    );
                    if (!isPrintArea) return (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {availableTags.filter(tg => !tg.area).map(renderChip)}
                      </div>
                    );
                    // Print area: show grouped categories
                    const mediumTags    = availableTags.filter(tg => tg.category === "medium");
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {mediumTags.length > 0 && (
                          <div>
                            <div className="eyebrow" style={{ marginBottom: 6, fontSize: 10 }}>Medium</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {mediumTags.map(renderChip)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Divider */}
                  <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                    <div className="eyebrow" style={{ marginBottom: 8, fontSize: 10 }}>
                      {lang === "de" ? "Neuen Tag erstellen" : "Create new tag"}
                    </div>

                    {/* Name input */}
                    <input
                      ref={newTagInputRef}
                      type="text"
                      value={newTagName}
                      onChange={e => setNewTagName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") createTag(); if (e.key === "Escape") setShowTagPicker(false); }}
                      placeholder={lang === "de" ? "Tag-Name…" : "Tag name…"}
                      style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 4, padding: "6px 8px", background: "var(--bg)", color: "var(--fg)", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                    />

                    {/* Preview chip */}
                    {newTagName.trim() && (
                      <div style={{ marginTop: 6 }}>
                        <span className="chip" style={{ background: "var(--hover)", color: "var(--fg-2)", borderColor: "transparent", pointerEvents: "none" }}>
                          <span className="tag-dot" style={{ background: "var(--fg-2)" }} />
                          {newTagName.trim()}
                        </span>
                      </div>
                    )}

                    {/* Create button */}
                    <button
                      onClick={createTag}
                      disabled={!newTagName.trim()}
                      style={{ marginTop: 10, all: "unset", cursor: newTagName.trim() ? "pointer" : "not-allowed", padding: "6px 14px", background: newTagName.trim() ? "var(--fg)" : "var(--hover)", color: newTagName.trim() ? "var(--bg)" : "var(--muted)", fontSize: 12, borderRadius: 4, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <window.Icon.plus size={11} />
                      {lang === "de" ? "Erstellen & hinzufügen" : "Create & add"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* KI-Beschreibung — nur für Bilder */}
            {asset.kind !== "pdf" && (
              <div style={{ marginBottom: 16 }}>
                <div className="row" style={{ gap: 6, marginBottom: 8, alignItems: "center" }}>
                  <div className="eyebrow" style={{ marginBottom: 0 }}>{t("ai_description")}</div>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", padding: "1px 6px", background: "oklch(52% 0.17 145 / 0.1)", color: "oklch(40% 0.15 145)", border: "1px solid oklch(52% 0.17 145 / 0.2)", borderRadius: 3 }}>
                    GPT-4o mini
                  </span>
                  {window.AI_CONFIG?.openaiKey && !aiDesc && (
                    <button
                      className="btn sm ghost"
                      style={{ marginLeft: "auto", fontSize: 11 }}
                      onClick={async () => {
                        if (!asset.storageUrl) return;
                        const desc = await window.describeImageWithAI?.(asset.storageUrl);
                        if (desc) { setAiDesc(desc); save({ aiDescription: desc }); }
                      }}
                      title={lang === "de" ? "KI-Beschreibung jetzt generieren" : "Generate AI description now"}
                    >
                      ✦ {lang === "de" ? "Generieren" : "Generate"}
                    </button>
                  )}
                </div>
                <textarea
                  value={aiDesc}
                  onChange={e => setAiDesc(e.target.value)}
                  onBlur={() => save({ aiDescription: aiDesc })}
                  placeholder={
                    window.AI_CONFIG?.openaiKey
                      ? (lang === "de" ? "KI-Beschreibung wird beim nächsten Upload generiert…" : "AI description generated on next upload…")
                      : (lang === "de" ? "OpenAI-Key in den Einstellungen hinterlegen" : "Add OpenAI key in settings")
                  }
                  rows={3}
                  style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 4, padding: 10, background: "var(--bg)", color: "var(--fg)", resize: "vertical", outline: "none", fontFamily: "inherit", fontSize: 13, lineHeight: 1.5 }}
                />
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>{t("notes")}</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => save({ notes })}
                placeholder={t("add_note")}
                rows={4}
                style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 4, padding: 10, background: "var(--bg)", color: "var(--fg)", resize: "vertical", outline: "none", fontFamily: "inherit", fontSize: 13, lineHeight: 1.5 }}
              />
            </div>

            {/* Meta grid */}
            <div className="eyebrow" style={{ marginBottom: 8 }}>{t("info")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>{t("date_taken")}</span>
              <span>{window.fmtDate(asset.date, lang)}</span>
              <span style={{ color: "var(--muted)" }}>{t("format")}</span>
              <span>{asset.format}</span>
              <span style={{ color: "var(--muted)" }}>{t("resolution")}</span>
              <span className="num">
                {asset.kind === "pdf"
                  ? `${asset.pages} ${asset.pages === 1 ? (lang === "de" ? "Seite" : "page") : (lang === "de" ? "Seiten" : "pages")}`
                  : `${asset.width} × ${asset.height} px`}
              </span>
              {asset.kind === "pdf" && (
                <>
                  <span style={{ color: "var(--muted)" }}>{lang === "de" ? "Seitenformat" : "Page size"}</span>
                  <span className="num">
                    {pdfDims
                      ? `${pdfDims.w} × ${pdfDims.h} mm`
                      : <span style={{ color: "var(--faint)" }}>—</span>
                    }
                  </span>
                </>
              )}
              <span style={{ color: "var(--muted)" }}>{t("embargo")}</span>
              <span>{asset.embargo ? window.fmtDate(asset.embargo, lang) : t("no_embargo")}</span>
            </div>
          </div>

          <div style={{ padding: "12px 24px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <button className="btn ghost" onClick={onClose}>{t("close")}</button>

            {/* Download — resolution picker for images, direct link for PDFs */}
            {asset.storageUrl && (
              asset.kind === "pdf" ? (
                <button
                  className="btn"
                  onClick={() => nativeDownload(asset.storageUrl, (asset.title || "document").replace(/[^\w\-]/g, "_") + ".pdf")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  PDF {lang === "de" ? "herunterladen" : "download"}
                </button>
              ) : (
                <div className="row" style={{ gap: 0, border: "1px solid var(--line-strong)", borderRadius: 4, overflow: "hidden" }}>
                  <select
                    value={downloadRes}
                    onChange={e => setDownloadRes(Number(e.target.value))}
                    style={{ border: "none", borderRight: "1px solid var(--line-strong)", padding: "6px 10px", background: "var(--panel)", color: "var(--fg)", fontSize: 12, cursor: "pointer", outline: "none", fontFamily: "inherit" }}
                  >
                    <option value={0}>{lang === "de" ? "Original" : "Original"}</option>
                    <option value={3000}>{lang === "de" ? "Druck — 3000 px" : "Print — 3000 px"}</option>
                    <option value={1920}>Web L — 1920 px</option>
                    <option value={1200}>Web M — 1200 px</option>
                    <option value={800}>Social — 800 px</option>
                    <option value={400}>{lang === "de" ? "Vorschau — 400 px" : "Preview — 400 px"}</option>
                  </select>
                  <button
                    className="btn"
                    style={{ border: "none", borderRadius: 0, paddingLeft: 12, paddingRight: 14 }}
                    onClick={() => triggerDownload(asset, downloadRes)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    {lang === "de" ? "Laden" : "Download"}
                  </button>
                </div>
              )
            )}

            <button className="btn primary" onClick={() => onShare(asset)}>
              <window.Icon.share size={14} /> {t("share")}
            </button>
          </div>
        </div>
      </div>
    </window.Modal>
    </>
  );
}

// -------- Share Dialog --------
function ShareDialog({ open, target, onClose, onShared, lang }) {
  const t = window.makeT(lang);
  const [viewOnly, setViewOnly] = useStateM(true);
  const [expires, setExpires] = useStateM("2026-08-12");
  const [recipients, setRecipients] = useStateM("");
  const [message, setMessage] = useStateM("");
  const [link, setLink] = useStateM("");
  const [copied, setCopied] = useStateM(false);

  useEffectM(() => {
    if (!open || !target) return;
    const slug = (target.folder ? "f-" : "a-") + Math.random().toString(36).slice(2, 8);
    setLink(`https://picpop.app/s/${slug}`);
    setCopied(false);
  }, [open, target]);

  if (!target) return null;
  const label = target.folder ? target.folder.name : target.asset.title;
  const count = target.folder ? target.folder.count : 1;

  function copy() {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    onShared?.(t("link_copied"));
  }

  return (
    <window.Modal open={open} onClose={onClose} width={520}>
      <div style={{ padding: 24, borderBottom: "1px solid var(--line)" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{t("share")}</div>
        <div className="h-2 clamp-1">{label}</div>
        <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
          {target.folder
            ? t("asset_count_other", { n: count })
            : `${target.asset.format} · ${target.asset.width}×${target.asset.height}`}
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {/* Link box */}
        <div className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10, background: "var(--bg)" }}>
          <div style={{ width: 28, height: 28, background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <window.Icon.link size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("link_active")} · {t("share_view_only")}</div>
            <div className="num clamp-1" style={{ fontSize: 13 }}>{link}</div>
          </div>
          <button className="btn primary sm" onClick={copy}>
            {copied ? <><window.Icon.check size={12} /> {t("copy")}</> : <><window.Icon.copy size={12} /> {t("copy")}</>}
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{t("share_settings")}</div>

          <div className="row" style={{ justifyContent: "space-between", padding: "10px 0" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{t("share_view_only")}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", maxWidth: 320 }}>{t("share_view_only_hint")}</div>
            </div>
            <div className={"toggle " + (viewOnly ? "on" : "")} onClick={() => setViewOnly(v => !v)} />
          </div>

          <div className="row" style={{ justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{t("expires")}</div>
            <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} style={{ border: "1px solid var(--line-strong)", borderRadius: 4, padding: "4px 8px", background: "var(--panel)", color: "var(--fg)" }} />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{t("recipients")}</div>
          <input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="presse@example.com, redaktion@…" style={{ width: "100%", border: "1px solid var(--line-strong)", borderRadius: 4, padding: "8px 10px", background: "var(--panel)", color: "var(--fg)", outline: "none", fontSize: 13 }} />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{t("recipients_hint")}</div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{t("message")}</div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("message_placeholder")} rows={3} style={{ width: "100%", border: "1px solid var(--line-strong)", borderRadius: 4, padding: "8px 10px", background: "var(--panel)", color: "var(--fg)", outline: "none", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
        </div>
      </div>

      <div style={{ padding: "12px 24px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", gap: 8 }}>
        <button className="btn ghost" onClick={onClose}>{t("cancel")}</button>
        <button className="btn primary" onClick={copy}><window.Icon.copy size={14} /> {t("copy_link")}</button>
      </div>
    </window.Modal>
  );
}

// -------- UploadMeta — folder / author / tags sub-form --------
function UploadMeta({ folder, setFolder, folderList, pdfFolder, setPdfFolder, hasPdfs, hasImages, author, setAuthor, tags, setTags, lang, t, area }) {
  const isPrintArea = area === "print";
  const [newTagName,    setNewTagName]    = useStateM("");
  const [showNew,       setShowNew]       = useStateM(false);
  const [newFolderName, setNewFolderName] = useStateM("");
  const [showNewFolder, setShowNewFolder] = useStateM(false);
  const [newPdfFolderName, setNewPdfFolderName] = useStateM("");
  const [showNewPdfFolder, setShowNewPdfFolder] = useStateM(false);
  const newTagRef       = useRefM(null);
  const newFolderRef    = useRefM(null);
  const newPdfFolderRef = useRefM(null);

  useEffectM(() => { if (showNew)       setTimeout(() => newTagRef.current?.focus(), 50); }, [showNew]);
  useEffectM(() => { if (showNewFolder) setTimeout(() => newFolderRef.current?.focus(), 50); }, [showNewFolder]);
  useEffectM(() => { if (showNewPdfFolder) setTimeout(() => newPdfFolderRef.current?.focus(), 50); }, [showNewPdfFolder]);

  function createTag() {
    const name = newTagName.trim();
    if (!name) return;
    const id  = "t-" + Date.now();
    const tag = { id, name, name_en: name, hue: 0 };
    window.dbSaveTag(tag);
    window.TAGS = [...window.TAGS, tag];
    setTags(prev => [...prev, id]);
    setNewTagName(""); setShowNew(false);
  }

  function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const id = "f-" + Date.now();
    const hues = [25, 200, 290, 90, 140, 320];
    const hue  = hues[Math.floor(Math.random() * hues.length)];
    const f    = { id, name, hue, count: 0 };
    window.dbSaveFolder(f);
    window.FOLDERS = [...(window.FOLDERS || []), f];
    setFolder(id);
    setNewFolderName(""); setShowNewFolder(false);
  }

  function createPdfFolder() {
    const name = newPdfFolderName.trim();
    if (!name) return;
    const id = "p-" + Date.now();
    const hues = [25, 200, 290, 90, 140, 320];
    const hue  = hues[Math.floor(Math.random() * hues.length)];
    const f    = { id, name, hue, count: 0 };
    window.dbSavePdfFolder(f);
    window.PDF_FOLDERS = [...(window.PDF_FOLDERS || []), f];
    setPdfFolder(id);
    setNewPdfFolderName(""); setShowNewPdfFolder(false);
  }

  // Render helper (not a React component — avoids remount-on-rerender focus loss)
  function renderNewFolderRow(value, setValue, onCreate, onCancel, inputRef) {
    return (
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onCreate(); if (e.key === "Escape") onCancel(); }}
          placeholder={lang === "de" ? "Ordner-Name…" : "Folder name…"}
          style={{ flex: 1, border: "1px solid var(--line-strong)", borderRadius: 4, padding: "6px 8px", background: "var(--panel)", color: "var(--fg)", fontSize: 12, outline: "none", fontFamily: "inherit" }}
        />
        <button onClick={onCreate} disabled={!value.trim()}
          style={{ all: "unset", cursor: value.trim() ? "pointer" : "not-allowed", padding: "6px 10px", background: value.trim() ? "var(--fg)" : "var(--hover)", color: value.trim() ? "var(--bg)" : "var(--muted)", fontSize: 12, borderRadius: 4, fontFamily: "inherit", whiteSpace: "nowrap" }}>
          {lang === "de" ? "Anlegen" : "Create"}
        </button>
        <button onClick={onCancel}
          style={{ all: "unset", cursor: "pointer", padding: "6px 6px", color: "var(--muted)", fontSize: 12 }}>✕</button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Row 1: Ordner + Urheber */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}>

        {/* Ordner — one or two selects depending on file mix */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Image folder: always shown in print area, or when queue has at least one non-PDF */}
          {(isPrintArea || hasImages) && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                {hasPdfs && !isPrintArea
                  ? (lang === "de" ? "Ordner (Bilder)" : "Folder (images)")
                  : t("add_to_folder")}
              </div>
              <select value={folder} onChange={(e) => setFolder(e.target.value)}
                style={{ width: "100%", border: "1px solid var(--line-strong)", borderRadius: 4, padding: "8px 10px", background: "var(--panel)", color: "var(--fg)", outline: "none", fontSize: 13 }}>
                {folderList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              {!showNewFolder
                ? <span style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 5 }}
                    onClick={() => setShowNewFolder(true)}>
                    <window.Icon.plus size={9} />{lang === "de" ? "Neuen Ordner anlegen" : "Create new folder"}
                  </span>
                : renderNewFolderRow(newFolderName, setNewFolderName, createFolder, () => { setShowNewFolder(false); setNewFolderName(""); }, newFolderRef)
              }
            </div>
          )}
          {/* PDF folder: shown when queue has PDFs and we're not already in print area */}
          {hasPdfs && !isPrintArea && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div className="eyebrow" style={{ marginBottom: 0 }}>
                  {lang === "de" ? "Druckbereich-Ordner" : "Print area folder"}
                </div>
                <span style={{ fontSize: 10, background: "rgba(251,191,36,0.15)", color: "#b45309", borderRadius: 3, padding: "1px 5px", fontWeight: 600 }}>
                  PDF → Print
                </span>
              </div>
              <select value={pdfFolder} onChange={(e) => setPdfFolder(e.target.value)}
                style={{ width: "100%", border: "1px solid var(--line-strong)", borderRadius: 4, padding: "8px 10px", background: "var(--panel)", color: "var(--fg)", outline: "none", fontSize: 13 }}>
                {(window.PDF_FOLDERS || []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              {!showNewPdfFolder
                ? <span style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 5 }}
                    onClick={() => setShowNewPdfFolder(true)}>
                    <window.Icon.plus size={9} />{lang === "de" ? "Neuen Ordner anlegen" : "Create new folder"}
                  </span>
                : renderNewFolderRow(newPdfFolderName, setNewPdfFolderName, createPdfFolder, () => { setShowNewPdfFolder(false); setNewPdfFolderName(""); }, newPdfFolderRef)
              }
            </div>
          )}
        </div>

        {/* Urheber */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{lang === "de" ? "Urheber" : "Author"}</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {window.TEAM.map(u => {
              const active = author === u.name;
              return (
                <span key={u.id} className="chip" style={{ cursor: "pointer", background: active ? `oklch(70% 0.1 ${u.hue})` : "var(--hover)", color: active ? "white" : "var(--fg)", borderColor: active ? "transparent" : "var(--line)" }}
                  onClick={() => setAuthor(u.name)}>
                  <window.Avatar user={u} size={13} />
                  {u.name.split(" ")[0]}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Tags — full width, grouped by file type in queue */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{t("apply_tags")}</div>

        {(() => {
          const renderTagChip = (tg) => {
            const active = tags.includes(tg.id);
            return (
              <span key={tg.id} className="chip" style={{ cursor: "pointer", background: active ? window.tagColor(tg) : window.tagBg(tg), color: active ? "var(--bg)" : window.tagColor(tg), borderColor: "transparent" }}
                onClick={() => setTags(active ? tags.filter(x => x !== tg.id) : [...tags, tg.id])}>
                <span className="tag-dot" style={{ background: active ? "var(--bg)" : window.tagColor(tg) }} />
                {window.tagLabel(tg, lang)}
              </span>
            );
          };

          const imageTags   = window.TAGS.filter(tg => !tg.area);
          const mediumTags  = window.TAGS.filter(tg => tg.category === "medium");

          // Show image tags when images are present (or no PDFs at all)
          const showImageTags = hasImages || (!hasPdfs && !isPrintArea);
          // Show print tags when PDFs are present or we're in print area
          const showPrintTags = hasPdfs || isPrintArea;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 8 }}>

              {/* Image tags */}
              {showImageTags && (
                <div>
                  {showPrintTags && (
                    <div className="eyebrow" style={{ marginBottom: 5, fontSize: 10, color: "var(--muted)" }}>
                      {lang === "de" ? "Bilder" : "Images"}
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {imageTags.map(renderTagChip)}
                    {!showNew && (
                      <span className="chip" style={{ cursor: "pointer", color: "var(--muted)", borderStyle: "dashed" }} onClick={() => setShowNew(true)}>
                        <window.Icon.plus size={10} /> {lang === "de" ? "Neuer Tag" : "New tag"}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Print tags (Medium + Kampagne) */}
              {showPrintTags && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {mediumTags.length > 0 && (
                    <div>
                      <div className="eyebrow" style={{ marginBottom: 5, fontSize: 10, color: "var(--muted)" }}>
                        {showImageTags ? "PDF — Medium" : "Medium"}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{mediumTags.map(renderTagChip)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Inline new-tag form */}
        {showNew && (
          <div style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg)" }}>
            <div className="eyebrow" style={{ marginBottom: 8, fontSize: 10 }}>{lang === "de" ? "Neuen Tag erstellen" : "Create new tag"}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                ref={newTagRef}
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createTag(); if (e.key === "Escape") { setShowNew(false); setNewTagName(""); } }}
                placeholder={lang === "de" ? "Tag-Name…" : "Tag name…"}
                style={{ flex: 1, border: "1px solid var(--line-strong)", borderRadius: 4, padding: "6px 8px", background: "var(--panel)", color: "var(--fg)", fontSize: 12, outline: "none", fontFamily: "inherit" }}
              />
              <button onClick={createTag} disabled={!newTagName.trim()}
                style={{ all: "unset", cursor: newTagName.trim() ? "pointer" : "not-allowed", padding: "6px 12px", background: newTagName.trim() ? "var(--fg)" : "var(--hover)", color: newTagName.trim() ? "var(--bg)" : "var(--muted)", fontSize: 12, borderRadius: 4, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {lang === "de" ? "Erstellen" : "Create"}
              </button>
              <button onClick={() => { setShowNew(false); setNewTagName(""); }}
                style={{ all: "unset", cursor: "pointer", padding: "6px 8px", color: "var(--muted)", fontSize: 12 }}>
                {lang === "de" ? "Abbrechen" : "Cancel"}
              </button>
            </div>
            {newTagName.trim() && (
              <div style={{ marginTop: 6 }}>
                <span className="chip" style={{ background: "var(--hover)", color: "var(--fg-2)", borderColor: "transparent", pointerEvents: "none", fontSize: 11 }}>
                  <span className="tag-dot" style={{ background: "var(--fg-2)" }} />
                  {newTagName.trim()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// -------- Upload Modal --------
function UploadModal({ open, onClose, defaultFolder, area, onUploaded, lang }) {
  const t = window.makeT(lang);
  const [over, setOver] = useStateM(false);
  const [files, setFiles] = useStateM([]);
  const [folder, setFolder] = useStateM(defaultFolder || "f-unsorted");
  // pdfFolder: initialized eagerly so it's never an empty string
  const [pdfFolder, setPdfFolder] = useStateM(
    () => (window.PDF_FOLDERS || []).find(f => f.id === "p-unsorted")?.id || (window.PDF_FOLDERS || [])[0]?.id || "p-unsorted"
  );
  const [tags, setTags] = useStateM([]);
  const [author, setAuthor] = useStateM(window.TEAM[0]?.name || "");
  const [uploading, setUploading] = useStateM(false);
  const fileInputRef = useRefM(null);

  const isPrintArea = area === "print";
  const folderList = isPrintArea ? (window.PDF_FOLDERS || []) : (window.FOLDERS || []);
  const defaultFolderFallback = isPrintArea ? "p-unsorted" : "f-unsorted";
  // Recomputed every render so it's always up-to-date even after Firestore loads
  const defaultPdfFolder = (window.PDF_FOLDERS || []).find(f => f.id === "p-unsorted")?.id || (window.PDF_FOLDERS || [])[0]?.id || "p-unsorted";

  useEffectM(() => {
    if (open) {
      setFiles([]); setTags([]);
      setFolder(defaultFolder || defaultFolderFallback);
      setPdfFolder(defaultPdfFolder);
      setAuthor(window.TEAM[0]?.name || "");
      setUploading(false);
    }
  }, [open, defaultFolder, isPrintArea]);

  const hasPdfs   = files.some(f =>  f.isPdf);
  const hasImages = files.some(f => !f.isPdf);

  function addFiles(fileList) {
    const hues = [25, 90, 200, 290, 50, 140, 320, 160];
    const next = Array.from(fileList).map((f, i) => ({
      id: "u-" + Math.random().toString(36).slice(2),
      name: f.name,
      size: (f.size / 1024 / 1024).toFixed(1),
      hue: hues[i % hues.length],
      progress: 0,
      status: "pending",
      file: f,
      isPdf: f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
      // Blob URL for both images and PDFs; images rendered as <img>, PDFs rendered via PDF.js
      previewUrl: URL.createObjectURL(f),
    }));
    setFiles(prev => [...prev, ...next]);
  }

  function removeFile(id) {
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  async function startUpload() {
    setUploading(true);
    let successCount = 0;
    for (const entry of files) {
      setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: "uploading" } : f));
      try {
        const member = window.TEAM.find(u => u.name === author);
        const authorRole = member?.role === "Admin" ? "in_house" : member?.dept?.toLowerCase().includes("agentur") ? "agency" : "in_house";
        // PDFs always go to the print area unless we're already in it.
        // Use pdfFolder (user selection) with fallback to defaultPdfFolder so
        // an empty/stale state never causes a PDF to land in the images area.
        const resolvedPdfFolder = pdfFolder || defaultPdfFolder;
        const targetFolder = entry.isPdf
          ? (isPrintArea ? folder : resolvedPdfFolder)
          : folder;
        await window.uploadAsset(entry.file, targetFolder, tags, (pct) => {
          setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, progress: pct } : f));
        }, author, authorRole);
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, progress: 100, status: "done" } : f));
        successCount++;
      } catch (err) {
        console.error("Upload failed:", entry.name, err);
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: "error" } : f));
      }
    }
    onUploaded(successCount);
    onClose();
  }

  const doneCount  = files.filter(f => f.status === "done").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const overallPct = files.length > 0
    ? Math.round(files.reduce((s, f) => s + f.progress, 0) / files.length)
    : 0;

  const safeClose = uploading ? () => {} : onClose;

  const folderName = folderList.find(f => f.id === folder)?.name || "";

  return (
    <window.Modal open={open} onClose={safeClose} width={720} closeOnBackdrop={false}>

      {/* ── Header ── */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>{t("upload")}</div>
          <div className="h-2">
            {uploading
              ? (lang === "de" ? `${doneCount} von ${files.length} fertig` : `${doneCount} of ${files.length} done`)
              : files.length === 0 ? t("drop_files") : `${files.length} ${t("files")}`}
          </div>
        </div>
        {/* Overall progress ring / percent when uploading */}
        {uploading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600, color: "var(--fg)" }}>{overallPct}%</div>
            <div style={{ width: 160, height: 4, background: "var(--line)", borderRadius: 2 }}>
              <div style={{ height: "100%", width: overallPct + "%", background: "var(--accent)", borderRadius: 2, transition: "width .2s" }} />
            </div>
            {errorCount > 0 && (
              <div style={{ fontSize: 11, color: "#f87171" }}>{errorCount} {lang === "de" ? "Fehler" : "error(s)"}</div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: 24, maxHeight: "65vh", overflowY: "auto" }}>

        {/* ── Dropzone — hidden while uploading ── */}
        {!uploading && (
          <label
            className={"dropzone" + (over ? " over" : "")}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
            style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", padding: files.length > 0 ? "14px 0" : undefined }}
          >
            <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf"
              style={{ position: "absolute", width: 0, height: 0, opacity: 0, overflow: "hidden" }}
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <window.Icon.upload size={files.length > 0 ? 16 : 22} />
            <div className={files.length > 0 ? "" : "h-3"} style={{ marginTop: 8, fontSize: files.length > 0 ? 13 : undefined }}>{t("drop_files")}</div>
            {files.length === 0 && <>
              <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>{t("or_browse")}</div>
              <div className="mono" style={{ marginTop: 12, color: "var(--muted)" }}>{t("upload_hint")}</div>
            </>}
          </label>
        )}

        {/* ── File list ── */}
        {files.length > 0 && (
          <div style={{ marginTop: uploading ? 0 : 20 }}>
            {!uploading && <div className="eyebrow" style={{ marginBottom: 10 }}>{t("files")} — {files.length}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {files.map((f, i) => {
                const isDone      = f.status === "done";
                const isUploading = f.status === "uploading";
                const isError     = f.status === "error";
                const isPending   = f.status === "pending";
                return (
                  <div key={f.id} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "10px 12px",
                    background: isDone ? "rgba(34,197,94,0.06)" : isError ? "rgba(248,113,113,0.08)" : isUploading ? "var(--hover)" : "transparent",
                    borderRadius: 6, border: "1px solid",
                    borderColor: isDone ? "rgba(34,197,94,0.2)" : isError ? "rgba(248,113,113,0.25)" : "transparent",
                    transition: "background .3s",
                  }}>

                    {/* Thumbnail */}
                    <div style={{ width: 56, height: 56, borderRadius: 4, overflow: "hidden", flexShrink: 0, position: "relative", background: `oklch(86% 0.06 ${f.hue})` }}>
                      {f.isPdf
                        ? <window.PdfThumbnail url={f.previewUrl} hue={f.hue} label="PDF" />
                        : f.previewUrl
                          ? <img src={f.previewUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          : <window.PH hue={f.hue} ratio={1} label="" />
                      }
                    </div>

                    {/* Name + size + progress */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2 }} className="clamp-1">{f.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 10 }}>
                        <span className="num">{f.size} MB</span>
                        <span>{f.isPdf ? "PDF" : (lang === "de" ? "Bild" : "Image")}</span>
                        {isPending && uploading && <span style={{ color: "var(--faint)" }}>{lang === "de" ? "Wartend…" : "Waiting…"}</span>}
                        {isUploading && <span style={{ color: "var(--accent)" }}>{lang === "de" ? "Wird hochgeladen…" : "Uploading…"}</span>}
                        {isDone && <span style={{ color: "#22c55e" }}>✓ {lang === "de" ? "Fertig" : "Done"}</span>}
                        {isError && <span style={{ color: "#f87171" }}>✕ {lang === "de" ? "Fehler" : "Error"}</span>}
                      </div>
                      {(isUploading || isDone) && (
                        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 5, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: f.progress + "%", background: isDone ? "#22c55e" : "var(--accent)", borderRadius: 3, transition: "width .15s" }} />
                          </div>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", width: 32, textAlign: "right", flexShrink: 0 }}>
                            {f.progress}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Status icon / remove button */}
                    <div style={{ flexShrink: 0, width: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isUploading && (
                        <div style={{ width: 18, height: 18, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                      )}
                      {isDone && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                      {isError && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      )}
                      {isPending && !uploading && (
                        <button onClick={() => removeFile(f.id)}
                          style={{ all: "unset", cursor: "pointer", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", color: "var(--muted)" }}
                          onMouseEnter={e => e.currentTarget.style.color = "var(--fg)"}
                          onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}
                          title={lang === "de" ? "Entfernen" : "Remove"}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Folder / Author / Tags meta — hidden while uploading ── */}
        {files.length > 0 && !uploading && (
          <UploadMeta
            folder={folder} setFolder={setFolder} folderList={folderList}
            pdfFolder={pdfFolder} setPdfFolder={setPdfFolder} hasPdfs={hasPdfs} hasImages={hasImages}
            author={author} setAuthor={setAuthor}
            tags={tags} setTags={setTags}
            lang={lang} t={t} area={area}
          />
        )}

        {/* ── Upload summary — shown while uploading ── */}
        {uploading && files.length > 0 && (
          <div style={{ marginTop: 16, padding: "10px 12px", background: "var(--panel)", borderRadius: 6, border: "1px solid var(--line)", display: "flex", gap: 24, fontSize: 12, color: "var(--muted)" }}>
            <span>📁 {folderName}</span>
            <span>👤 {author.split(" ")[0]}</span>
            {tags.length > 0 && (
              <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {tags.map(tid => { const tg = window.tagById(tid); return tg ? <window.TagPill key={tid} tag={tg} lang={lang} /> : null; })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: "12px 24px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <button className="btn ghost" onClick={safeClose} disabled={uploading}>{t("cancel")}</button>
        <button className="btn primary" disabled={files.length === 0 || uploading} onClick={startUpload}
          style={{ opacity: files.length === 0 ? 0.5 : 1, gap: 8 }}>
          <window.Icon.upload size={14} />
          {uploading
            ? (lang === "de" ? "Hochladen…" : "Uploading…")
            : `${t("upload")}${files.length > 0 ? ` (${files.length})` : ""}`}
        </button>
      </div>
    </window.Modal>
  );
}

Object.assign(window, { AssetDetailModal, ShareDialog, UploadModal });
