// Main App — sidebar with area switcher + folder CRUD, topbar, routing, tweaks

const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA, useRef: useRefA } = React;

// ── PicpopLogo ────────────────────────────────────────────────────────────────
function PicpopLogo({ theme, iconOnly = false, height = 28 }) {
  const dark  = theme === "dark" ? "#ffffff" : "#14120f";
  const darkF = theme === "dark" ? "#ffffff" : "#1d1d1b";
  const vb = iconOnly ? "0 0 146.75 146.75" : "0 0 581.02 146.75";
  const w  = iconOnly ? height : Math.round(height * (581.02 / 146.75));
  return (
    <svg width={w} height={height} viewBox={vb} xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <clipPath id="pp-clip"><rect width="581.02" height="146.75"/></clipPath>
      <g clipPath="url(#pp-clip)">
        {/* Icon square background */}
        <path fill={dark} d="M36.69,0h73.38C130.33,0,146.75,16.43,146.75,36.69v73.38c0,20.26-16.43,36.69-36.69,36.69H36.69c-20.26,0-36.69-16.43-36.69-36.69V36.69C0,16.43,16.43,0,36.69,0"/>
        {/* Wheel segments */}
        <path fill="#f05e69" d="M73.38,73.38l23.99-43.59c8.21,7.16,13.88,16.79,16.15,27.45l-40.13,16.15Z"/>
        <path fill="#ebc745" d="M73.38,73.38l49.75-1.02c-2.09,10.69-7.6,20.42-15.7,27.71l-34.05-26.68Z"/>
        <path fill="#5cc9a3" d="M73.38,73.38l25.76,42.57c-10.31,3.53-21.48,3.62-31.84.26l6.08-42.83Z"/>
        <path fill="#598ceb" d="M73.38,73.38l-23.99,43.59c-8.21-7.16-13.88-16.79-16.15-27.45l40.13-16.15Z"/>
        <path fill="#f05e69" d="M73.38,73.38l-49.75,1.02c2.09-10.69,7.6-20.42,15.7-27.71l34.05,26.68Z"/>
        <path fill="#ebc745" d="M73.38,73.38l-25.76-42.57c10.31-3.53,21.48-3.62,31.84-.26l-6.08,42.83Z"/>
        {/* Center circle */}
        <path fill={darkF} d="M73.38,60.32c7.21,0,13.06,5.85,13.06,13.06s-5.85,13.06-13.06,13.06-13.06-5.85-13.06-13.06,5.85-13.06,13.06-13.06"/>
        {/* Text — only rendered when not iconOnly */}
        {!iconOnly && <>
          <path fill={dark} d="M221.23,94.05c5.05,0,9.22-1.61,12.52-4.82,3.29-3.21,4.94-7.9,4.94-14.06v-1.28c0-6.17-1.67-10.85-5.01-14.06-3.34-3.21-7.49-4.82-12.46-4.82s-9.12,1.6-12.46,4.82c-3.34,3.21-5.01,7.89-5.01,14.06v1.28c0,6.17,1.67,10.85,5.01,14.06,3.34,3.21,7.49,4.82,12.46,4.82M187.84,132.06V42.69h15.92v7.71h2.31c1.46-2.48,3.72-4.69,6.81-6.61,3.08-1.93,7.49-2.89,13.23-2.89,5.14,0,9.89,1.26,14.25,3.79,4.36,2.53,7.87,6.23,10.53,11.11,2.65,4.88,3.98,10.79,3.98,17.72v2.05c0,6.93-1.33,12.84-3.98,17.72-2.65,4.88-6.16,8.58-10.53,11.11-4.37,2.52-9.12,3.79-14.25,3.79-3.85,0-7.08-.45-9.69-1.35-2.61-.9-4.71-2.06-6.29-3.47-1.58-1.41-2.85-2.84-3.79-4.3h-2.31v33h-16.18Z"/>
          <path fill={dark} d="M264.63,42.69h16.18v63.69h-16.18v-63.69ZM272.72,35.24c-2.91,0-5.37-.94-7.38-2.82-2.01-1.88-3.02-4.37-3.02-7.45s1.01-5.56,3.02-7.45c2.01-1.88,4.47-2.83,7.38-2.83s5.48.95,7.45,2.83c1.97,1.88,2.95,4.37,2.95,7.45s-.98,5.56-2.95,7.45c-1.97,1.88-4.45,2.82-7.45,2.82"/>
          <path fill={dark} d="M323.57,108.18c-6.16,0-11.75-1.28-16.76-3.85-5.01-2.57-8.97-6.29-11.88-11.17-2.91-4.88-4.37-10.79-4.37-17.72v-1.8c0-6.93,1.45-12.84,4.37-17.72,2.91-4.88,6.87-8.6,11.88-11.17,5.01-2.57,10.59-3.85,16.76-3.85s11.3,1.07,15.67,3.21c4.37,2.14,7.9,5.07,10.59,8.79,2.7,3.72,4.47,7.94,5.33,12.65l-15.67,3.34c-.35-2.57-1.11-4.88-2.31-6.93-1.2-2.06-2.89-3.68-5.07-4.88-2.18-1.2-4.9-1.8-8.15-1.8s-6.19.71-8.8,2.12c-2.61,1.41-4.67,3.51-6.16,6.29-1.5,2.78-2.25,6.18-2.25,10.21v1.28c0,4.03.75,7.43,2.25,10.21,1.5,2.78,3.55,4.88,6.16,6.29,2.61,1.41,5.54,2.12,8.8,2.12,4.88,0,8.58-1.26,11.11-3.79,2.52-2.53,4.13-5.85,4.82-9.95l15.67,3.72c-1.11,4.54-3.02,8.67-5.71,12.39-2.7,3.72-6.23,6.66-10.59,8.8-4.36,2.14-9.59,3.21-15.67,3.21"/>
          <path fill={dark} d="M397.15,94.05c5.05,0,9.22-1.61,12.52-4.82,3.3-3.21,4.94-7.9,4.94-14.06v-1.28c0-6.17-1.67-10.85-5.01-14.06-3.34-3.21-7.49-4.82-12.46-4.82s-9.12,1.6-12.46,4.82c-3.34,3.21-5.01,7.89-5.01,14.06v1.28c0,6.17,1.67,10.85,5.01,14.06,3.34,3.21,7.49,4.82,12.46,4.82M363.76,132.06V42.69h15.92v7.71h2.31c1.45-2.48,3.72-4.69,6.8-6.61,3.08-1.93,7.49-2.89,13.23-2.89,5.14,0,9.89,1.26,14.26,3.79,4.37,2.53,7.87,6.23,10.53,11.11,2.65,4.88,3.98,10.79,3.98,17.72v2.05c0,6.93-1.33,12.84-3.98,17.72-2.65,4.88-6.16,8.58-10.53,11.11-4.37,2.52-9.12,3.79-14.26,3.79-3.85,0-7.08-.45-9.69-1.35-2.61-.9-4.71-2.06-6.29-3.47-1.59-1.41-2.85-2.84-3.79-4.3h-2.31v33h-16.18Z"/>
          <path fill={dark} d="M470.85,93.79c4.96,0,9.07-1.6,12.33-4.81,3.25-3.21,4.88-7.81,4.88-13.81v-1.28c0-5.99-1.6-10.59-4.81-13.81-3.21-3.21-7.34-4.81-12.39-4.81s-9.08,1.61-12.33,4.81c-3.25,3.21-4.88,7.82-4.88,13.81v1.28c0,5.99,1.62,10.59,4.88,13.81,3.25,3.21,7.36,4.81,12.33,4.81M470.85,108.18c-6.34,0-12.03-1.28-17.08-3.85-5.05-2.57-9.03-6.29-11.94-11.17-2.91-4.88-4.37-10.74-4.37-17.59v-2.05c0-6.85,1.45-12.71,4.37-17.59,2.91-4.88,6.89-8.6,11.94-11.17,5.05-2.57,10.74-3.85,17.08-3.85s12.02,1.28,17.08,3.85c5.05,2.57,9.03,6.29,11.94,11.17,2.91,4.88,4.36,10.74,4.36,17.59v2.05c0,6.85-1.46,12.71-4.36,17.59-2.91,4.88-6.89,8.6-11.94,11.17-5.05,2.57-10.74,3.85-17.08,3.85"/>
          <path fill={dark} d="M547.38,94.05c5.05,0,9.22-1.61,12.52-4.82,3.3-3.21,4.94-7.9,4.94-14.06v-1.28c0-6.17-1.67-10.85-5.01-14.06-3.34-3.21-7.49-4.82-12.46-4.82s-9.12,1.6-12.46,4.82c-3.34,3.21-5.01,7.89-5.01,14.06v1.28c0,6.17,1.67,10.85,5.01,14.06,3.34,3.21,7.49,4.82,12.46,4.82M513.99,132.06V42.69h15.92v7.71h2.31c1.46-2.48,3.73-4.69,6.81-6.61,3.08-1.93,7.49-2.89,13.22-2.89,5.14,0,9.89,1.26,14.26,3.79,4.36,2.53,7.87,6.23,10.53,11.11,2.65,4.88,3.98,10.79,3.98,17.72v2.05c0,6.93-1.33,12.84-3.98,17.72-2.65,4.88-6.16,8.58-10.53,11.11-4.37,2.52-9.12,3.79-14.26,3.79-3.85,0-7.08-.45-9.7-1.35-2.61-.9-4.71-2.06-6.29-3.47-1.59-1.41-2.85-2.84-3.79-4.3h-2.31v33h-16.18Z"/>
        </>}
      </g>
    </svg>
  );
}

// ── FolderRow ────────────────────────────────────────────────────────────────
function FolderRow({ folder, active, onOpen, onRename, onDelete, onPin, onMoveAssets, onMoveFolder, allFolders, onDragStart, onDragOver, onDrop, dragOverHint, lang, liveCount, hasChildren, isExpanded, onToggleExpand }) {
  const t = window.makeT(lang);
  const [editing, setEditing] = useStateA(false);
  const [name, setName] = useStateA(folder.name);
  const [menu, setMenu] = useStateA(false);
  const [confirmDel, setConfirmDel] = useStateA(false);
  const [showMove, setShowMove] = useStateA(false);
  const inputRef = useRefA(null);

  useEffectA(() => { setName(folder.name); }, [folder.name]);
  useEffectA(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function commit() {
    const v = name.trim();
    if (v && v !== folder.name) onRename(folder.id, v);
    else setName(folder.name);
    setEditing(false);
  }

  function closeMenu() { setMenu(false); setConfirmDel(false); setShowMove(false); }

  return (
    <div
      className={"nav-item folder-row" + (active ? " active" : "") + (dragOverHint ? " drop-target" : "")}
      draggable={!editing}
      onDragStart={(e) => { onDragStart(folder.id); e.dataTransfer.setData("application/picpop-folder", folder.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(folder.id); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation(); // don't bubble to container (would reset to top-level)
        const assetData = e.dataTransfer.getData("application/picpop-assets");
        if (assetData) {
          try { onMoveAssets?.(JSON.parse(assetData), folder.id); } catch (_) {}
        } else {
          // Another folder dropped on this one → nest it
          onDrop(folder.id);
        }
      }}
      onClick={() => !editing && onOpen(folder.id)}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      style={{ position: "relative" }}
    >
      {hasChildren ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand?.(folder.id); }}
          style={{ all: "unset", cursor: "pointer", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--muted)", marginRight: -2 }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
            <path d="M2 1l4 3-4 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      ) : (
        <span style={{ width: 14, flexShrink: 0 }} />
      )}
      <window.Icon.folder size={13} />
      {editing ? (
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setName(folder.name); setEditing(false); } }}
          onClick={(e) => e.stopPropagation()}
          style={{ flex: 1, minWidth: 0, border: "1px solid var(--accent)", borderRadius: 3, padding: "2px 6px", background: "var(--panel)", color: "var(--fg)", outline: "none", fontSize: 13, marginLeft: -4 }}
        />
      ) : (
        <span className="clamp-1" style={{ flex: 1, minWidth: 0 }}>{folder.name}</span>
      )}
      {folder.pinned && (
        <window.Icon.pin size={11} style={{ color: "var(--accent)", flexShrink: 0, opacity: 0.8 }} />
      )}
      <span className="count num">{liveCount ?? folder.count}</span>
      <button className="folder-more" onClick={(e) => { e.stopPropagation(); setMenu(v => !v); setConfirmDel(false); }} aria-label="more">
        <window.Icon.more size={12} />
      </button>
      {menu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={(e) => { e.stopPropagation(); closeMenu(); }} />
          <div className="card" style={{ position: "absolute", right: 0, top: "100%", zIndex: 31, marginTop: 4, minWidth: 170, boxShadow: "var(--shadow)", padding: 4 }} onClick={(e) => e.stopPropagation()}>
            {confirmDel ? (
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 12, color: "var(--fg)", marginBottom: 8 }}>
                  {lang === "de" ? "Ordner wirklich löschen?" : "Delete folder?"}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    style={{ all: "unset", cursor: "pointer", flex: 1, textAlign: "center", padding: "5px 0", fontSize: 12, background: "var(--accent)", color: "#fff", borderRadius: 3 }}
                    onClick={() => { closeMenu(); onDelete(folder.id); }}
                  >
                    {lang === "de" ? "Löschen" : "Delete"}
                  </button>
                  <button
                    style={{ all: "unset", cursor: "pointer", flex: 1, textAlign: "center", padding: "5px 0", fontSize: 12, border: "1px solid var(--line-strong)", borderRadius: 3, color: "var(--muted)" }}
                    onClick={() => setConfirmDel(false)}
                  >
                    {lang === "de" ? "Abbrechen" : "Cancel"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="menu-item" onClick={() => { closeMenu(); setEditing(true); }}>
                  <window.Icon.edit size={12} /> {lang === "de" ? "Umbenennen" : "Rename"}
                </div>
                <div className="menu-item" onClick={() => { closeMenu(); onPin?.(folder.id); }}>
                  <window.Icon.pin size={12} />
                  {folder.pinned
                    ? (lang === "de" ? "Von Home entfernen" : "Unpin from home")
                    : (lang === "de" ? "Auf Home anheften" : "Pin to home")}
                </div>
                <div className="menu-item" onClick={() => { closeMenu(); onOpen(folder.id); }}>
                  <window.Icon.eye size={12} /> {t("open")}
                </div>
                {!["f-unsorted", "p-unsorted"].includes(folder.id) && onMoveFolder && (
                  <div>
                    <div className="menu-item" onClick={(e) => { e.stopPropagation(); setShowMove(v => !v); setConfirmDel(false); }}>
                      <window.Icon.folder size={12} /> {lang === "de" ? "Verschieben nach…" : "Move to…"}
                      <span style={{ marginLeft: "auto", opacity: 0.5 }}>{showMove ? "▲" : "▶"}</span>
                    </div>
                    {showMove && (
                      <div style={{ borderTop: "1px solid var(--line)", maxHeight: 180, overflowY: "auto" }}>
                        {folder.parent && (
                          <div className="menu-item" onClick={() => { closeMenu(); onMoveFolder(folder.id, null); }}
                            style={{ paddingLeft: 20, fontSize: 12 }}>
                            <window.Icon.arrowL size={11} /> {lang === "de" ? "Oberste Ebene" : "Top level"}
                          </div>
                        )}
                        {(allFolders || [])
                          .filter(f => f.id !== folder.id && f.id !== folder.parent && !["f-unsorted","p-unsorted"].includes(f.id))
                          .map(f => (
                            <div key={f.id} className="menu-item" style={{ paddingLeft: 20, fontSize: 12 }}
                              onClick={() => { closeMenu(); onMoveFolder(folder.id, f.id); }}>
                              <window.Icon.folder size={11} /> {f.name}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                )}
                {!["f-unsorted", "p-unsorted"].includes(folder.id) && (
                  <div className="menu-item danger" onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }}>
                    <window.Icon.trash size={12} /> {t("delete")}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── TagCollectionRow ─────────────────────────────────────────────────────────
function TagCollectionRow({ col, active, onClick, onRename, onDelete, lang }) {
  const [menu, setMenu] = useStateA(false);
  const [editing, setEditing] = useStateA(false);
  const [name, setName] = useStateA(col.name);
  const [confirmDel, setConfirmDel] = useStateA(false);
  const inputRef = useRefA(null);

  useEffectA(() => { setName(col.name); }, [col.name]);
  useEffectA(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function commit() {
    const v = name.trim();
    if (v && v !== col.name) onRename?.(col.id, v);
    else setName(col.name);
    setEditing(false);
  }

  // Build a compact filter summary (tag names + year)
  const filterSummary = (() => {
    const parts = [];
    (col.filterTags || []).forEach(tid => {
      const tg = window.tagById?.(tid);
      if (tg) parts.push(window.tagLabel?.(tg, lang) || tg.name);
    });
    if (col.filterYear) parts.push(String(col.filterYear));
    if (col.filterAuthor) parts.push(col.filterAuthor.split(" ")[0]);
    return parts.slice(0, 4).join(" · ");
  })();

  return (
    <div
      className={"nav-item folder-row" + (active ? " active" : "")}
      onClick={() => !editing && onClick(col)}
      style={{ position: "relative", flexDirection: "column", alignItems: "flex-start", padding: "5px 8px 5px 10px", gap: 0 }}
    >
      <div className="row" style={{ width: "100%", gap: 6 }}>
        <span style={{ width: 14, flexShrink: 0 }} />
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--accent)", opacity: 0.8 }}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
          <line x1="7" y1="7" x2="7.01" y2="7"/>
        </svg>
        {editing ? (
          <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
            onBlur={commit} onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setName(col.name); setEditing(false); } }}
            style={{ flex: 1, minWidth: 0, border: "1px solid var(--accent)", borderRadius: 3, padding: "2px 6px", background: "var(--panel)", color: "var(--fg)", outline: "none", fontSize: 13, marginLeft: -4 }}
          />
        ) : (
          <span className="clamp-1" style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{col.name}</span>
        )}
        <button className="folder-more" onClick={e => { e.stopPropagation(); setMenu(v => !v); setConfirmDel(false); }} aria-label="more">
          <window.Icon.more size={12} />
        </button>
      </div>
      {filterSummary && !editing && (
        <div style={{ paddingLeft: 32, fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", marginTop: 1, lineHeight: 1.3 }} className="clamp-1">
          {filterSummary}
        </div>
      )}
      {menu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={e => { e.stopPropagation(); setMenu(false); setConfirmDel(false); }} />
          <div className="card" style={{ position: "absolute", right: 0, top: "100%", zIndex: 31, marginTop: 4, minWidth: 160, boxShadow: "var(--shadow)", padding: 4 }} onClick={e => e.stopPropagation()}>
            {confirmDel ? (
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 12, color: "var(--fg)", marginBottom: 8 }}>{lang === "de" ? "Sammlung löschen?" : "Delete collection?"}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ all: "unset", cursor: "pointer", flex: 1, textAlign: "center", padding: "5px 0", fontSize: 12, background: "var(--accent)", color: "#fff", borderRadius: 3 }}
                    onClick={() => { setMenu(false); setConfirmDel(false); onDelete?.(col.id); }}>
                    {lang === "de" ? "Löschen" : "Delete"}
                  </button>
                  <button style={{ all: "unset", cursor: "pointer", flex: 1, textAlign: "center", padding: "5px 0", fontSize: 12, border: "1px solid var(--line-strong)", borderRadius: 3, color: "var(--muted)" }}
                    onClick={() => setConfirmDel(false)}>
                    {lang === "de" ? "Abbrechen" : "Cancel"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="menu-item" onClick={() => { setMenu(false); setEditing(true); }}>
                  <window.Icon.edit size={12} /> {lang === "de" ? "Umbenennen" : "Rename"}
                </div>
                <div className="menu-item danger" onClick={e => { e.stopPropagation(); setConfirmDel(true); }}>
                  <window.Icon.trash size={12} /> {lang === "de" ? "Löschen" : "Delete"}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ area, setArea, folders, route, setRoute, lang, onUpload, onCreateFolder, onRenameFolder, onDeleteFolder, onPinFolder, onReorderFolders, onMoveAssets, onMoveAssetsToArea, onMoveFolder, onDevOpen, assets, currentUser, companyName, onSignOut, tagCollections, onLoadTagCollection, onDeleteTagCollection, onRenameTagCollection, activeTagColId, collapsed, onCollapse, onResize, theme }) {
  const t = window.makeT(lang);
  const [creating, setCreating] = useStateA(false);
  const [newName, setNewName] = useStateA("");
  const newInputRef = useRefA(null);
  const [dragId, setDragId] = useStateA(null);
  const [overId, setOverId] = useStateA(null);
  const [areaDropOver, setAreaDropOver] = useStateA(null); // "images" | "print" | null
  const [creatingCategory, setCreatingCategory] = useStateA("kampagne"); // for print: which section
  const [expandedIds, setExpandedIds] = useStateA(() => new Set());
  const [lineOverId, setLineOverId] = useStateA(null); // folder id whose "before" line is hovered

  const toggleExpand = (id) => setExpandedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  useEffectA(() => { if (creating) newInputRef.current?.focus(); }, [creating]);

  function commitNew() {
    const v = newName.trim();
    if (v) onCreateFolder(v, creatingCategory);
    setNewName("");
    setCreating(false);
  }

  const baseRoute = route.split(":")[0];
  const detailId = route.split(":")[1];

  const col = collapsed; // shorthand

  // Resize handle drag logic
  const sidebarRef = useRefA(null);
  function startResize(e) {
    if (col) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarRef.current?.getBoundingClientRect().width || 240;
    function onMove(ev) {
      const w = startW + ev.clientX - startX;
      if (w < 100) { onCollapse(true); return; }
      onResize(w);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <aside ref={sidebarRef} className="sidebar" style={{ position: "relative", overflow: "visible" }}>
      {/* Drag-to-resize / collapse handle on right edge */}
      <div
        className="sidebar-resize-handle"
        onPointerDown={startResize}
        onDoubleClick={() => onCollapse(!col)}
        style={{ cursor: col ? "e-resize" : "col-resize" }}
        title={col ? (lang === "de" ? "Aufklappen" : "Expand") : (lang === "de" ? "Ziehen zum Skalieren · Doppelklick zum Einklappen" : "Drag to resize · double-click to collapse")}
      >
        <div className="sidebar-resize-line" />
      </div>

      {/* Brand */}
      {col ? (
        <div style={{ padding: "14px 0 10px", display: "flex", justifyContent: "center" }}>
          <div onClick={() => onCollapse(false)} title="picpop – aufklappen" style={{ cursor: "pointer" }}>
            <PicpopLogo theme={theme} iconOnly height={28} />
          </div>
        </div>
      ) : (
        <div style={{ padding: "16px 16px 12px" }}>
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <PicpopLogo theme={theme} iconOnly={false} height={24} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {(companyName || window.TENANT_ID) && (
                <div className="mono" style={{ color: "var(--muted)", fontSize: 9, marginTop: 2 }}>{companyName || window.TENANT_ID}</div>
              )}
            </div>
            {/* Collapse toggle */}
            <button
              className="btn icon ghost sm"
              onClick={() => onCollapse(true)}
              title={lang === "de" ? "Einklappen" : "Collapse"}
              style={{ color: "var(--faint)", flexShrink: 0 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Area switcher */}
      <div style={{ padding: col ? "0 6px 8px" : "0 12px 8px" }}>
        <div className="area-switcher" style={col ? { gridTemplateColumns: "1fr", gap: 2 } : undefined}>
          {["images", "print"].map(tab => {
            const isActive = area === tab;
            const isDragTarget = areaDropOver === tab && !isActive;
            function handleAreaDragOver(e) {
              if (isActive) return;
              if (!e.dataTransfer.types.includes("application/picpop-assets")) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setAreaDropOver(tab);
            }
            function handleAreaDrop(e) {
              e.preventDefault();
              setAreaDropOver(null);
              if (isActive) return;
              const raw = e.dataTransfer.getData("application/picpop-assets");
              if (!raw) return;
              try { onMoveAssetsToArea?.(JSON.parse(raw), tab); } catch (_) {}
            }
            return (
              <button key={tab}
                className={"area-tab" + (isActive ? " active" : "")}
                style={{ ...(isDragTarget ? { outline: "2px solid var(--accent)", outlineOffset: -2, background: "var(--accent-soft)" } : {}), ...(col ? { justifyContent: "center", padding: "6px 0" } : {}) }}
                onClick={() => setArea(tab)}
                onDragOver={handleAreaDragOver}
                onDragLeave={() => setAreaDropOver(null)}
                onDrop={handleAreaDrop}
                title={col ? (tab === "images" ? (lang === "de" ? "Bilder" : "Images") : "Print") : undefined}
              >
                {tab === "images" ? <window.Icon.image size={13} /> : <window.Icon.pdf size={13} />}
                {!col && <span>{tab === "images" ? (lang === "de" ? "Bilder" : "Images") : "Print"}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Upload */}
      <div style={{ padding: col ? "4px 6px 8px" : "8px 12px 12px" }}>
        <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={onUpload} title={col ? t("upload") : undefined}>
          <window.Icon.upload size={14} />
          {!col && <span style={{ marginLeft: 6 }}>{t("upload")}</span>}
        </button>
      </div>

      <nav className="scroll" style={{ padding: col ? "4px 4px 12px" : "4px 8px 12px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Overview links */}
        <div className="nav-item" onClick={() => setRoute("recent")} data-active={baseRoute === "recent"} style={col ? { justifyContent: "center", padding: "7px 0" } : undefined} title={col ? "Home" : undefined}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path d="M8 1.5L1.5 7v7h4.5v-4h4v4h4.5V7L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
          </svg>
          {!col && <span>Home</span>}
        </div>
        <div className="nav-item" onClick={() => setRoute("favorites")} data-active={baseRoute === "favorites"} style={col ? { justifyContent: "center", padding: "7px 0" } : undefined} title={col ? t("nav_favorites") : undefined}>
          <window.Icon.star size={13} />
          {!col && <span>{t("nav_favorites")}</span>}
          {!col && <span className="count num">{window.__favorites?.size || 0}</span>}
        </div>
        <div className="nav-item" onClick={() => setRoute("uploads")} data-active={baseRoute === "uploads"} style={col ? { justifyContent: "center", padding: "7px 0" } : undefined} title={col ? t("nav_uploads") : undefined}>
          <window.Icon.upload size={13} />
          {!col && <span>{t("nav_uploads")}</span>}
        </div>
        <div className="nav-item" onClick={() => { setArea("images"); setRoute("all"); }} data-active={baseRoute === "all" && area === "images"} style={col ? { justifyContent: "center", padding: "7px 0" } : undefined} title={col ? (lang === "de" ? "Alle Bilder" : "All images") : undefined}>
          <window.Icon.image size={13} />
          {!col && <span>{lang === "de" ? "Alle Bilder" : "All images"}</span>}
        </div>
        <div className="nav-item" onClick={() => { setArea("print"); setRoute("all"); }} data-active={baseRoute === "all" && area === "print"} style={col ? { justifyContent: "center", padding: "7px 0" } : undefined} title={col ? (lang === "de" ? "Alles Print" : "All print") : undefined}>
          <window.Icon.pdf size={13} />
          {!col && <span>{lang === "de" ? "Alles Print" : "All print"}</span>}
        </div>
        {!col && (area === "print" ? (() => {
          // Split pdfFolders into Kampagnen + Literatur
          const kampagneFolders = folders.filter(f => !f.category || f.category === "kampagne");
          const literaturFolders = folders.filter(f => f.category === "literatur");
          const newInput = (cat) => creating && creatingCategory === cat && (
            <div className="nav-item folder-row" style={{ background: "var(--hover)" }}>
              <window.Icon.folder size={13} />
              <input ref={newInputRef} value={newName} onChange={(e) => setNewName(e.target.value)}
                onBlur={commitNew}
                onKeyDown={(e) => { if (e.key === "Enter") commitNew(); if (e.key === "Escape") { setNewName(""); setCreating(false); } }}
                placeholder={lang === "de" ? "Name…" : "Name…"}
                style={{ flex: 1, minWidth: 0, border: "1px solid var(--accent)", borderRadius: 3, padding: "2px 6px", background: "var(--panel)", color: "var(--fg)", outline: "none", fontSize: 13, marginLeft: -4 }}
              />
            </div>
          );
          // Build depth-first flat tree for a folder list (respects expandedIds)
          const flatTree = (list) => {
            const byId = {};
            list.forEach(f => { byId[f.id] = { ...f, _children: [] }; });
            const roots = [];
            list.forEach(f => {
              if (f.parent && byId[f.parent]) byId[f.parent]._children.push(byId[f.id]);
              else roots.push(byId[f.id]);
            });
            const out = [];
            const walk = (nodes, depth) => nodes.forEach(n => {
              const hasChildren = n._children.length > 0;
              const isExpanded = expandedIds.has(n.id);
              out.push({ f: n, depth, hasChildren, isExpanded });
              if (hasChildren && isExpanded) walk(n._children, depth + 1);
            });
            walk(roots, 0);
            return out;
          };
          const folderList = (list, routeBase) => (
            <div onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverId(null); }}
              onDrop={(e) => {
                e.preventDefault();
                // Dropped on background → move dragged folder to top level
                if (dragId) onMoveFolder?.(dragId, null);
                setDragId(null); setOverId(null);
              }}>
              {flatTree(list).map(({ f, depth, hasChildren, isExpanded }) => (
                <div key={f.id} style={{ paddingLeft: depth * 14 }}>
                  {/* Drop line for reordering — visible only while dragging */}
                  {dragId && dragId !== f.id && (
                    <div
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setLineOverId(f.id); setOverId(null); }}
                      onDragLeave={() => setLineOverId(null)}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragId) onReorderFolders?.(dragId, f.id); setDragId(null); setOverId(null); setLineOverId(null); }}
                      style={{ height: 4, margin: "1px 4px", borderRadius: 2, background: lineOverId === f.id ? "var(--accent)" : "transparent", transition: "background 0.1s" }}
                    />
                  )}
                  <FolderRow folder={f}
                    liveCount={(() => {
                      const all = (assets || window.ASSETS || []).filter(a => a.folderId === f.id);
                      return (f.id === "f-unsorted" || f.id === "p-unsorted")
                        ? all.filter(a => (a.tags || []).length === 0).length
                        : all.length;
                    })()}
                    active={baseRoute === routeBase && detailId === f.id}
                    dragOverHint={overId === f.id && dragId !== f.id && dragId !== null}
                    hasChildren={hasChildren} isExpanded={isExpanded} onToggleExpand={toggleExpand}
                    onOpen={(id) => setRoute(routeBase + ":" + id)}
                    onRename={onRenameFolder} onDelete={onDeleteFolder} onPin={onPinFolder}
                    onMoveAssets={(ids, folderId) => { onMoveAssets?.(ids, folderId); setOverId(null); }}
                    onMoveFolder={onMoveFolder} allFolders={list}
                    onDragStart={(id) => setDragId(id)} onDragOver={(id) => setOverId(id)}
                    onDrop={(id) => { if (dragId && dragId !== id) onMoveFolder?.(dragId, id); setDragId(null); setOverId(null); }}
                    lang={lang}
                  />
                </div>
              ))}
            </div>
          );
          const sectionHeader = (label, cat) => (
            <div className="row" style={{ padding: "16px 10px 6px", justifyContent: "space-between", alignItems: "center" }}>
              <div className="eyebrow">{label}</div>
              <button className="btn icon ghost" style={{ width: 20, height: 20 }} title={t("new_folder")}
                onClick={() => { setCreatingCategory(cat); setCreating(true); }}>
                <window.Icon.plus size={12} />
              </button>
            </div>
          );
          return (
            <>
              {sectionHeader(lang === "de" ? "Kampagnen" : "Campaigns", "kampagne")}
              <div className={"nav-item" + (baseRoute === "pdfs" && !detailId ? " active" : "")}
                onClick={() => setRoute("pdfs")}>
                <window.Icon.grid size={13} />
                <span>{lang === "de" ? "Alle Kampagnen" : "All campaigns"}</span>
                <span className="count">{kampagneFolders.length}</span>
              </div>
              {newInput("kampagne")}
              {folderList(kampagneFolders, "pdfs")}

              {sectionHeader(lang === "de" ? "Literatur" : "Literature", "literatur")}
              <div className={"nav-item" + (baseRoute === "literatur" && !detailId ? " active" : "")}
                onClick={() => setRoute("literatur")}>
                <window.Icon.grid size={13} />
                <span>{lang === "de" ? "Alle Literatur" : "All literature"}</span>
                <span className="count">{literaturFolders.length}</span>
              </div>
              {newInput("literatur")}
              {folderList(literaturFolders, "literatur")}
            </>
          );
        })() : (
          // IMAGES area — single "Sammlungen" section
          <>
            <div className="row" style={{ padding: "16px 10px 6px", justifyContent: "space-between", alignItems: "center" }}>
              <div className="eyebrow">{lang === "de" ? "Sammlungen" : "Collections"}</div>
              <button className="btn icon ghost" style={{ width: 20, height: 20 }} onClick={() => setCreating(true)} title={t("new_folder")}>
                <window.Icon.plus size={12} />
              </button>
            </div>
            <div className={"nav-item" + (baseRoute === "folders" && !detailId ? " active" : "")}
              onClick={() => setRoute("folders")}>
              <window.Icon.grid size={13} />
              <span>{lang === "de" ? "Alle Sammlungen" : "All collections"}</span>
              <span className="count">{folders.length}</span>
            </div>
            {creating && (
              <div className="nav-item folder-row" style={{ background: "var(--hover)" }}>
                <window.Icon.folder size={13} />
                <input ref={newInputRef} value={newName} onChange={(e) => setNewName(e.target.value)}
                  onBlur={commitNew}
                  onKeyDown={(e) => { if (e.key === "Enter") commitNew(); if (e.key === "Escape") { setNewName(""); setCreating(false); } }}
                  placeholder={lang === "de" ? "Ordnername…" : "Folder name…"}
                  style={{ flex: 1, minWidth: 0, border: "1px solid var(--accent)", borderRadius: 3, padding: "2px 6px", background: "var(--panel)", color: "var(--fg)", outline: "none", fontSize: 13, marginLeft: -4 }}
                />
              </div>
            )}
            <div onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverId(null); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) onMoveFolder?.(dragId, null);
                setDragId(null); setOverId(null);
              }}>
              {(() => {
                const byId = {};
                folders.forEach(f => { byId[f.id] = { ...f, _children: [] }; });
                const roots = [];
                folders.forEach(f => { if (f.parent && byId[f.parent]) byId[f.parent]._children.push(byId[f.id]); else roots.push(byId[f.id]); });
                const flat = [];
                const walk = (nodes, depth) => nodes.forEach(n => {
                  const hasChildren = n._children.length > 0;
                  const isExpanded = expandedIds.has(n.id);
                  flat.push({ f: n, depth, hasChildren, isExpanded });
                  if (hasChildren && isExpanded) walk(n._children, depth + 1);
                });
                walk(roots, 0);
                return flat.map(({ f, depth, hasChildren, isExpanded }) => (
                  <div key={f.id} style={{ paddingLeft: depth * 14 }}>
                    {dragId && dragId !== f.id && (
                      <div
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setLineOverId(f.id); setOverId(null); }}
                        onDragLeave={() => setLineOverId(null)}
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragId) onReorderFolders?.(dragId, f.id); setDragId(null); setOverId(null); setLineOverId(null); }}
                        style={{ height: 4, margin: "1px 4px", borderRadius: 2, background: lineOverId === f.id ? "var(--accent)" : "transparent", transition: "background 0.1s" }}
                      />
                    )}
                    <FolderRow folder={f}
                      liveCount={(() => {
                        const all = (assets || window.ASSETS || []).filter(a => a.folderId === f.id);
                        return (f.id === "f-unsorted" || f.id === "p-unsorted")
                          ? all.filter(a => (a.tags || []).length === 0).length
                          : all.length;
                      })()}
                      active={baseRoute === "folders" && detailId === f.id}
                      dragOverHint={overId === f.id && dragId !== f.id && dragId !== null}
                      hasChildren={hasChildren} isExpanded={isExpanded} onToggleExpand={toggleExpand}
                      onOpen={(id) => setRoute("folders:" + id)}
                      onRename={onRenameFolder} onDelete={onDeleteFolder} onPin={onPinFolder}
                      onMoveAssets={(ids, folderId) => { onMoveAssets?.(ids, folderId); setOverId(null); }}
                      onMoveFolder={onMoveFolder} allFolders={folders}
                      onDragStart={(id) => setDragId(id)} onDragOver={(id) => setOverId(id)}
                      onDrop={(id) => { if (dragId && dragId !== id) onMoveFolder?.(dragId, id); setDragId(null); setOverId(null); }}
                      lang={lang}
                    />
                  </div>
                ));
              })()}
              {folders.length === 0 && (
                <div style={{ padding: "8px 10px", color: "var(--muted)", fontSize: 12 }}>
                  {lang === "de" ? "Keine Ordner. Lege einen neuen an." : "No folders yet. Create one."}
                </div>
              )}
            </div>
          </>
        ))}

        {/* Tag-Sammlungen — versteckt wenn collapsed */}
        {!col && (
          <>
            <div className="row" style={{ padding: "16px 10px 6px", justifyContent: "space-between", alignItems: "center" }}>
              <div className="eyebrow">{lang === "de" ? "Tag-Sammlungen" : "Tag Collections"}</div>
            </div>
            {(tagCollections || []).length === 0 ? (
              <div style={{ padding: "2px 10px 6px", color: "var(--muted)", fontSize: 11 }}>
                {lang === "de" ? "Noch keine gespeichert." : "None saved yet."}
              </div>
            ) : (tagCollections || []).map(tc => (
              <TagCollectionRow
                key={tc.id}
                col={tc}
                active={activeTagColId === tc.id}
                onClick={onLoadTagCollection}
                onRename={onRenameTagCollection}
                onDelete={onDeleteTagCollection}
                lang={lang}
              />
            ))}
          </>
        )}

        {/* Geteilte Links — eigene Sektion */}
        {!col && <div className="eyebrow" style={{ padding: "16px 10px 4px" }}>{lang === "de" ? "Teilen" : "Sharing"}</div>}
        <div className={"nav-item" + (baseRoute === "shared" ? " active" : "")} onClick={() => setRoute("shared")} style={col ? { justifyContent: "center", padding: "7px 0" } : undefined} title={col ? t("nav_shared") : undefined}>
          <window.Icon.link size={13} />
          {!col && <span>{t("nav_shared")}</span>}
          {!col && <span className="count">{window.SHARED_LINKS.length}</span>}
        </div>

        {/* Context */}
        {!col && <div className="eyebrow" style={{ padding: "16px 10px 4px" }}>{lang === "de" ? "Bibliothek" : "Library"}</div>}
        <div className={"nav-item" + (baseRoute === "tags" ? " active" : "")} onClick={() => setRoute("tags")} style={col ? { justifyContent: "center", padding: "7px 0" } : undefined} title={col ? t("nav_tags") : undefined}>
          <window.Icon.tag size={13} />
          {!col && <span>{t("nav_tags")}</span>}
          {!col && <span className="count">{window.TAGS.length}</span>}
        </div>
        {!col && (
          <div className={"nav-item" + (route === "external" ? " active" : "")} onClick={() => setRoute("external")}>
            <window.Icon.globe size={13} />
            <span>{lang === "de" ? "Externe Ansicht" : "External preview"}</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Settings + Admin + Dev — icon-only in collapsed mode */}
        {!col && <div className="eyebrow" style={{ padding: "8px 10px 4px" }}>{lang === "de" ? "Konto" : "Account"}</div>}
        <div className={"nav-item" + (baseRoute === "settings" ? " active" : "")} onClick={() => setRoute("settings")} style={col ? { justifyContent: "center", padding: "7px 0" } : undefined} title={col ? t("nav_team") : undefined}>
          <window.Icon.settings size={13} />
          {!col && <span>{t("nav_team")}</span>}
        </div>
        {currentUser?.email === window.SUPERADMIN_EMAIL && (
          <div className={"nav-item" + (baseRoute === "admin" ? " active" : "")} onClick={() => setRoute("admin")} style={col ? { justifyContent: "center", padding: "7px 0" } : undefined} title={col ? "Admin" : undefined}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            {!col && <span>Admin</span>}
          </div>
        )}
        {!col && (
          <div className="nav-item" onClick={() => onDevOpen?.()} style={{ opacity: 0.45 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
            <span>Dev</span>
          </div>
        )}
        {/* User row — compact icon + avatar when collapsed, full row when expanded */}
        {currentUser && (
          col ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "8px 0 10px", borderTop: "1px solid var(--line)", marginTop: 4 }}>
              <div
                style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--line-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}
                title={currentUser.displayName || currentUser.email}
                onClick={onSignOut}
              >
                {(currentUser.email || "?")[0].toUpperCase()}
              </div>
            </div>
          ) : (
            <div className="row" style={{ gap: 10, padding: "10px 10px 12px", borderTop: "1px solid var(--line)", marginTop: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--line-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>
                {(currentUser.email || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }} className="clamp-1">
                  {currentUser.displayName || currentUser.email?.split("@")[0] || "Nutzer"}
                </div>
                <div className="mono" style={{ color: "var(--muted)", fontSize: 9 }}>
                  {window.TENANT_ID}
                </div>
              </div>
              <button className="btn icon ghost sm" title={lang === "de" ? "Abmelden" : "Sign out"} onClick={onSignOut} style={{ flexShrink: 0, color: "var(--muted)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          )
        )}
      </nav>
    </aside>
  );
}

// ── Topbar ───────────────────────────────────────────────────────────────────
function Topbar({ lang, setLang, theme, setTheme, query, setQuery,
  assets, area,
  filterYear, setFilterYear, filterMonth, setFilterMonth,
  filterTags, setFilterTags, filterAuthor, setFilterAuthor,
  onClearFilters, onSaveFilters }) {

  const t = window.makeT(lang);
  const [filterOpen, setFilterOpen] = useStateA(false);
  const [saveCollName, setSaveCollName] = useStateA("");
  const { useState: useStateT, useMemo: useMemoT, useEffect: useEffectT, useRef: useRefT } = React;
  const panelRef = useRefT(null);
  const filterBtnRef = useRefT(null);

  const activeCount = (filterYear !== null ? 1 : 0) + (filterMonth !== null ? 1 : 0) + filterTags.length + (filterAuthor !== null ? 1 : 0);

  // Close on outside click — but NOT when clicking the toggle button itself
  // (the button's own onClick handles open/close; catching it here would fight with it)
  useEffectT(() => {
    if (!filterOpen) return;
    function onDown(e) {
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      if (filterBtnRef.current && filterBtnRef.current.contains(e.target)) return;
      setFilterOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filterOpen]);

  // Derived options from assets
  const allAssets = assets || [];
  const availableYears = useMemoT(() => {
    const s = new Set();
    allAssets.forEach(a => { const d = new Date(a.takenAt || a.date); if (!isNaN(d)) s.add(d.getFullYear()); });
    return [...s].sort((a, b) => b - a);
  }, [allAssets]);

  const availableMonths = useMemoT(() => {
    const s = new Set();
    allAssets.forEach(a => {
      const d = new Date(a.takenAt || a.date);
      if (!isNaN(d) && (!filterYear || d.getFullYear() === filterYear)) s.add(d.getMonth());
    });
    return [...s].sort((a, b) => a - b);
  }, [allAssets, filterYear]);

  const allTags = window.TAGS || [];
  const mediumTags   = allTags.filter(tg => tg.category === "medium");
  const kampagneTags = allTags.filter(tg => tg.category === "kampagne");
  const motivTags    = allTags.filter(tg => tg.category === "motiv");

  const availableAuthors = useMemoT(() => {
    const s = new Set(); allAssets.forEach(a => { if (a.author) s.add(a.author); }); return [...s].sort();
  }, [allAssets]);

  const MONTHS_DE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
  const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function toggleTag(id) {
    setFilterTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function FilterRow({ label, children }) {
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", minWidth: 72, flexShrink: 0 }}>{label}</span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{children}</div>
      </div>
    );
  }

  function Chip({ active, onClick, children }) {
    return (
      <span onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, padding: "0 8px", borderRadius: 4, fontSize: 11, cursor: "pointer", border: `1px solid ${active ? "transparent" : "var(--line)"}`, background: active ? "var(--fg)" : "var(--panel)", color: active ? "var(--bg)" : "var(--fg-2)", transition: "background .12s, color .12s, border-color .12s" }}>
        {children}
      </span>
    );
  }

  function TagChip({ tg }) {
    const active = filterTags.includes(tg.id);
    return (
      <span onClick={() => toggleTag(tg.id)} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, padding: "0 8px", borderRadius: 4, fontSize: 11, cursor: "pointer", border: "1px solid transparent", background: active ? window.tagColor(tg) : window.tagBg(tg), color: active ? "var(--bg)" : window.tagColor(tg), transition: "background .12s" }}>
        {window.tagLabel(tg, lang)}
      </span>
    );
  }

  return (
    <header className="topbar" style={{ flexDirection: "column", alignItems: "stretch", padding: 0, height: "auto", position: "relative", zIndex: 30 }}>
      {/* Toolbar row */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 24px", height: 56, flexShrink: 0 }}>
      {/* Search */}
      <div className="input ghost" style={{ flex: 1, maxWidth: 600 }}>
        <window.Icon.search size={14} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search_placeholder")} />
        {query
          ? <button onClick={() => setQuery("")} style={{ all: "unset", cursor: "pointer", color: "var(--muted)", lineHeight: 1, fontSize: 16, display: "flex" }} title={lang === "de" ? "Suche leeren" : "Clear search"}>×</button>
          : <span className="kbd">⌘K</span>}
      </div>

      {/* Filter toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <button
          ref={filterBtnRef}
          onClick={() => setFilterOpen(v => !v)}
          style={{ all: "unset", cursor: "pointer", height: 32, padding: "0 10px", display: "flex", alignItems: "center", gap: 6, borderRadius: activeCount > 0 ? "4px 0 0 4px" : 4, border: `1px solid ${filterOpen || activeCount > 0 ? "var(--fg)" : "var(--line-strong)"}`, borderRight: activeCount > 0 ? "none" : undefined, background: activeCount > 0 ? "var(--fg)" : "var(--panel)", color: activeCount > 0 ? "var(--bg)" : "var(--fg-2)", fontSize: 12, fontWeight: 500, transition: "all .15s" }}
          title={lang === "de" ? "Filter" : "Filters"}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          {lang === "de" ? "Filter" : "Filters"}
          {activeCount > 0 && <span style={{ background: "var(--bg)", color: "var(--fg)", borderRadius: 10, padding: "0 5px", fontSize: 10, fontFamily: "var(--font-mono)" }}>{activeCount}</span>}
        </button>
        {activeCount > 0 && (
          <button
            onClick={() => { onClearFilters(); setFilterOpen(false); }}
            title={lang === "de" ? "Filter zurücksetzen" : "Clear filters"}
            style={{ all: "unset", cursor: "pointer", height: 32, width: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 4px 4px 0", border: "1px solid var(--fg)", borderLeft: "1px solid rgba(255,255,255,0.25)", background: "var(--fg)", color: "var(--bg)", fontSize: 14, lineHeight: 1, transition: "all .15s" }}
          >×</button>
        )}
      </div>

      <div style={{ flex: 1 }} />
      <div className="row" style={{ gap: 6 }}>
        <button className="btn sm" onClick={() => setLang(lang === "de" ? "en" : "de")} title="Language">
          <window.Icon.globe size={12} /> {lang.toUpperCase()}
        </button>
        <button className="btn icon sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Theme">
          {theme === "dark" ? <window.Icon.sun size={14} /> : <window.Icon.moon size={14} />}
        </button>
        <button className="btn icon sm" title="Notifications"><window.Icon.inbox size={14} /></button>
      </div>
      </div>

      {/* Filter panel — in normal flow, pushes content down */}
      {filterOpen && (
        <div ref={panelRef} style={{ borderTop: "1px solid var(--line)", background: "var(--panel)", padding: "4px 24px 12px" }}>
          {availableYears.length > 0 && (
            <FilterRow label={lang === "de" ? "Jahr" : "Year"}>
              <Chip active={filterYear === null} onClick={() => { setFilterYear(null); setFilterMonth(null); }}>{lang === "de" ? "Alle" : "All"}</Chip>
              {availableYears.map(y => (
                <Chip key={y} active={filterYear === y} onClick={() => { setFilterYear(filterYear === y ? null : y); setFilterMonth(null); }}>
                  {y}
                </Chip>
              ))}
            </FilterRow>
          )}
          {availableMonths.length > 0 && (
            <FilterRow label={lang === "de" ? "Monat" : "Month"}>
              <Chip active={filterMonth === null} onClick={() => setFilterMonth(null)}>{lang === "de" ? "Alle" : "All"}</Chip>
              {availableMonths.map(m => (
                <Chip key={m} active={filterMonth === m} onClick={() => setFilterMonth(filterMonth === m ? null : m)}>
                  {lang === "de" ? MONTHS_DE[m] : MONTHS_EN[m]}
                </Chip>
              ))}
            </FilterRow>
          )}
          {area !== "images" && mediumTags.length > 0 && (
            <FilterRow label="Medium">
              {mediumTags.map(tg => <TagChip key={tg.id} tg={tg} />)}
            </FilterRow>
          )}
          {area !== "images" && kampagneTags.length > 0 && (
            <FilterRow label={lang === "de" ? "Kampagne" : "Campaign"}>
              {kampagneTags.map(tg => <TagChip key={tg.id} tg={tg} />)}
            </FilterRow>
          )}
          {motivTags.length > 0 && (
            <FilterRow label={lang === "de" ? "Bilder" : "Images"}>
              {motivTags.map(tg => <TagChip key={tg.id} tg={tg} />)}
            </FilterRow>
          )}
          {availableAuthors.length > 0 && (
            <FilterRow label={lang === "de" ? "Urheber" : "Author"}>
              <Chip active={filterAuthor === null} onClick={() => setFilterAuthor(null)}>{lang === "de" ? "Alle" : "All"}</Chip>
              {availableAuthors.map(au => {
                const member = (window.TEAM || []).find(u => u.name === au);
                return (
                  <Chip key={au} active={filterAuthor === au} onClick={() => setFilterAuthor(filterAuthor === au ? null : au)}>
                    {member && <window.Avatar user={member} size={13} />}
                    {au.split(" ")[0]}
                  </Chip>
                );
              })}
            </FilterRow>
          )}
          {activeCount > 0 && (
            <div style={{ paddingTop: 10, display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line)", marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)", flexShrink: 0 }}>
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                <input
                  value={saveCollName}
                  onChange={e => setSaveCollName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && saveCollName.trim()) {
                      onSaveFilters?.(saveCollName.trim());
                      setSaveCollName("");
                      setFilterOpen(false);
                    }
                    if (e.key === "Escape") setSaveCollName("");
                  }}
                  placeholder={lang === "de" ? "Als Tag-Sammlung speichern…" : "Save as tag collection…"}
                  style={{ flex: 1, border: "1px solid var(--line-strong)", borderRadius: 4, padding: "5px 8px", background: "var(--panel)", color: "var(--fg)", fontSize: 11, outline: "none" }}
                />
                <button
                  className="btn sm"
                  style={{ flexShrink: 0, opacity: saveCollName.trim() ? 1 : 0.4, pointerEvents: saveCollName.trim() ? "auto" : "none" }}
                  onClick={() => {
                    if (saveCollName.trim()) {
                      onSaveFilters?.(saveCollName.trim());
                      setSaveCollName("");
                      setFilterOpen(false);
                    }
                  }}
                >
                  {lang === "de" ? "Speichern" : "Save"}
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn ghost sm" onClick={() => { onClearFilters(); setFilterOpen(false); }} style={{ color: "var(--muted)", fontSize: 11 }}>
                  {lang === "de" ? "Filter zurücksetzen" : "Clear filters"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

// Removes t-unassigned-{cat} for any category that now has a real tag
function cleanUnassignedTags(tagIds) {
  const CATS = ["motiv", "kampagne", "medium"];
  let result = [...tagIds];
  CATS.forEach(cat => {
    const uid = `t-unassigned-${cat}`;
    if (!result.includes(uid)) return;
    const hasReal = result.some(tid => {
      if (tid === uid) return false;
      const tg = (window.TAGS || []).find(t => t.id === tid);
      return tg && tg.category === cat;
    });
    if (hasReal) result = result.filter(t => t !== uid);
  });
  return result;
}

// ── App ──────────────────────────────────────────────────────────────────────
function App() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "dark",
    "density": "comfortable",
    "accent": "#dc2c2c",
    "lang": "de"
  }/*EDITMODE-END*/;

  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  // ── Auth gate ─────────────────────────────────────────────────────────────
  const { user, authReady, signOut } = window.useAuth();

  const [lang, setLangState] = useStateA(tweaks.lang);
  const [theme, setThemeState] = useStateA(tweaks.theme);
  const [density, setDensityState] = useStateA(tweaks.density);

  useEffectA(() => { setLangState(tweaks.lang); }, [tweaks.lang]);
  useEffectA(() => { setThemeState(tweaks.theme); }, [tweaks.theme]);
  useEffectA(() => { setDensityState(tweaks.density); }, [tweaks.density]);

  useEffectA(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    document.documentElement.style.setProperty("--accent", tweaks.accent);
    document.documentElement.style.setProperty("--accent-soft", tweaks.accent + "18");
  }, [theme, density, tweaks.accent]);

  function setLang(l) { setLangState(l); setTweak("lang", l); }
  function setTheme(v) { setThemeState(v); setTweak("theme", v); }
  function setDensity(v) { setDensityState(v); setTweak("density", v); }

  const t = window.makeT(lang);

  const [area, setArea] = useStateA("images"); // "images" | "print"
  const [route, setRoute] = useStateA("recent");

  // ── Sidebar resize / collapse ─────────────────────────────────────────────
  const [sidebarWidth, setSidebarWidthRaw] = useStateA(() => {
    try { return parseInt(localStorage.getItem("picpop-sidebar-w") || "240", 10); } catch { return 240; }
  });
  const [sidebarCollapsed, setSidebarCollapsedRaw] = useStateA(() => {
    try { return localStorage.getItem("picpop-sidebar-collapsed") === "1"; } catch { return false; }
  });
  function setSidebarWidth(w) {
    const clamped = Math.max(160, Math.min(480, w));
    setSidebarWidthRaw(clamped);
    try { localStorage.setItem("picpop-sidebar-w", String(clamped)); } catch {}
  }
  function setSidebarCollapsed(c) {
    setSidebarCollapsedRaw(c);
    try { localStorage.setItem("picpop-sidebar-collapsed", c ? "1" : "0"); } catch {}
  }
  const [query, setQuery] = useStateA("");
  const [filterYear, setFilterYear] = useStateA(null);
  const [filterMonth, setFilterMonth] = useStateA(null);
  const [filterTags, setFilterTags] = useStateA([]);
  const [filterAuthor, setFilterAuthor] = useStateA(null);
  const hasFilter = filterYear !== null || filterMonth !== null || filterTags.length > 0 || filterAuthor !== null;
  function clearFilters() { setFilterYear(null); setFilterMonth(null); setFilterTags([]); setFilterAuthor(null); setActiveTagColId(null); }

  const [openAsset, setOpenAsset] = useStateA(null);
  const [openPeers, setOpenPeers] = useStateA(null);
  // Opens an asset and captures the visible peer list for prev/next navigation
  function openAssetWith(a, peers) { setOpenAsset(a); setOpenPeers(peers || null); }

  // Zoom: Trackpad-Pinch (Ctrl+Wheel), Mausrad (Ctrl+Wheel) und Tastatur (Ctrl+Plus/Minus/0).
  // Gilt für images UND print — contentRef wraps die gemeinsame .content.scroll-Box.
  // Must listen on document with passive:false — child listeners get it too late for preventDefault.
  const contentRef = useRefA(null);
  useEffectA(() => {
    function getThumb() { return parseInt(localStorage.getItem("picpop.thumbSize") || "220", 10); }

    function onWheel(e) {
      if (!e.ctrlKey) return;                        // regular scroll — ignore
      const el = contentRef.current;
      if (!el || !el.contains(e.target)) return;    // pointer not over grid area
      if (openAsset) return;                         // detail modal open — don't interfere
      e.preventDefault();                            // stop browser page-zoom
      window.setGlobalThumbSize(getThumb() - e.deltaY * 1.5);
    }

    function onKeyDown(e) {
      if (!e.ctrlKey && !e.metaKey) return;         // only Ctrl / Cmd combos
      if (openAsset) return;                         // modal open — leave alone
      const el = contentRef.current;
      if (!el) return;
      const k = e.key;
      if (k === "+" || k === "=" || k === "ArrowUp") {
        e.preventDefault();
        window.setGlobalThumbSize(getThumb() + 30);
      } else if (k === "-" || k === "ArrowDown") {
        e.preventDefault();
        window.setGlobalThumbSize(getThumb() - 30);
      } else if (k === "0") {
        e.preventDefault();
        window.setGlobalThumbSize(220);              // reset to default
      }
    }

    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openAsset]);
  const [devOpen, setDevOpen] = useStateA(false);
  const [shareTarget, setShareTarget] = useStateA(null);
  const [uploadOpen, setUploadOpen] = useStateA(false);
  const [toast, setToast] = useStateA(null);
  const [companyName, setCompanyName] = useStateA("");

  // Favorites — persisted in localStorage per tenant
  const favKey = () => `picpop.fav.${window.TENANT_ID || "default"}`;
  const [favorites, setFavorites] = useStateA(() => {
    try { return new Set(JSON.parse(localStorage.getItem(favKey()) || "[]")); }
    catch(_) { return new Set(); }
  });
  function toggleFavorite(id) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(favKey(), JSON.stringify([...next])); } catch(_) {}
      return next;
    });
  }
  function bulkSetFavorite(ids, fav) {
    setFavorites(prev => {
      const next = new Set(prev);
      ids.forEach(id => { if (fav) next.add(id); else next.delete(id); });
      try { localStorage.setItem(favKey(), JSON.stringify([...next])); } catch(_) {}
      return next;
    });
  }

  // Mutable state — driven by Firestore snapshots after init
  // Start with empty arrays so mock data never flashes before real data loads
  const [imageFolders, setImageFolders] = useStateA([]);
  const [pdfFolders, setPdfFolders] = useStateA([]);
  const [assets, setAssets] = useStateA([]);
  const [tags, setTags] = useStateA(window.TAGS);
  const [team, setTeam] = useStateA(window.TEAM);
  const [sharedLinks, setSharedLinks] = useStateA([]);
  const [tagCollections, setTagCollections] = useStateA([]);
  const [activeTagColId, setActiveTagColId] = useStateA(null);
  const [dbReady, setDbReady] = useStateA(false);

  // Keep window globals in sync so views that read them directly stay current
  useEffectA(() => { window.currentArea = area; }, [area]);
  useEffectA(() => { window.FOLDERS = imageFolders; }, [imageFolders]);
  useEffectA(() => { window.PDF_FOLDERS = pdfFolders; }, [pdfFolders]);
  useEffectA(() => { window.ASSETS = assets; }, [assets]);
  useEffectA(() => { window.TAGS = tags; }, [tags]);
  useEffectA(() => { window.TEAM = team; }, [team]);
  useEffectA(() => { window.SHARED_LINKS = sharedLinks; }, [sharedLinks]);

  // Firestore: seed on first load, then subscribe to live updates
  // Only runs when user is authenticated (user changes from null → object)
  useEffectA(() => {
    if (!user) {
      // Reset data state on logout
      setDbReady(false);
      setImageFolders([]); setPdfFolders([]); setAssets([]); setTags(window.TAGS); setTeam(window.TEAM); setSharedLinks([]);
      return;
    }

    // Load AI config + company name from tenant settings
    window.loadAiConfig?.();
    window.tenantSettingsDoc?.().get()
      .then(snap => { if (snap.exists) setCompanyName(snap.data().companyName || ""); })
      .catch(() => {});

    let unsubFolders, unsubPdfs, unsubAssets, unsubTags, unsubTeam, unsubTagCols;
    window.seedIfEmpty()
      .then(() => {
        unsubFolders = window.subscribeToFolders(data => setImageFolders(data));
        unsubPdfs    = window.subscribeToPdfFolders(data => setPdfFolders(data));
        unsubAssets  = window.subscribeToAssets(data => {
          window.ASSETS = data;
          setAssets(data);
          setDbReady(true);
        });
        unsubTags = window.subscribeToTags(data => {
          // Strip any persisted t-unassigned-* docs and inject virtual objects instead
          const real = data.filter(t => !t.id.startsWith("t-unassigned-"));
          const merged = [...real, ...(window.VIRTUAL_UNASSIGNED_TAGS || [])];
          if (merged.length > 0) { window.TAGS = merged; setTags(merged); }
        });
        unsubTeam = window.subscribeToTeam(data => {
          if (data.length > 0) { window.TEAM = data; setTeam(data); }
        });
        window.subscribeToSharedLinks(data => {
          window.SHARED_LINKS = data; setSharedLinks(data);
        });
        unsubTagCols = window.subscribeToTagCollections?.(data => setTagCollections(data));
      })
      .catch(err => {
        console.error("Firestore init error:", err);
        setDbReady(true);
      });
    return () => { unsubFolders?.(); unsubPdfs?.(); unsubAssets?.(); unsubTags?.(); unsubTeam?.(); unsubTagCols?.(); };
  }, [user]);

  const folders = area === "images" ? imageFolders : pdfFolders;
  const setFolders = area === "images" ? setImageFolders : setPdfFolders;

  // Switch route when area switches
  useEffectA(() => {
    if (route.startsWith("folders") || route.startsWith("pdfs") || route.startsWith("literatur")) {
      const base = area === "print" ? "pdfs" : "folders";
      setRoute(base);
    }
  }, [area]);

  // Peer assets for prev/next navigation — only within the same folder
  const peerAssets = useMemoA(
    () => {
      if (!openAsset) return [];
      return [...assets]
        .filter(a => a.folderId === openAsset.folderId && (area === "print" ? (a.kind === "pdf" || a.area === "print") : (a.kind !== "pdf" && a.area !== "print")))
        .sort((a, b) => a.date < b.date ? 1 : -1);
    },
    [assets, openAsset?.folderId, area]
  );

  function changeAsset(next) {
    setAssets(prev => prev.map(a => a.id === next.id ? next : a));
    setOpenAsset(next);
    window.dbSaveAsset(next).catch(console.error);
  }

  function deleteAssets(ids) {
    if (!ids.length) return;
    const toDelete = assets.filter(a => ids.includes(a.id));
    const next = assets.filter(a => !ids.includes(a.id));
    window.ASSETS = next; // sync so views see it immediately on re-render
    setAssets(next);
    if (openAsset && ids.includes(openAsset.id)) setOpenAsset(null);
    toDelete.forEach(a => window.dbDeleteAsset(a).catch(console.error));
    setToast(lang === "de"
      ? `${ids.length} ${ids.length === 1 ? "Datei" : "Dateien"} gelöscht`
      : `${ids.length} ${ids.length === 1 ? "file" : "files"} deleted`);
  }

  // ── Bulk operations ───────────────────────────────────────────────────────
  function bulkPatch(ids, patchFn) {
    setAssets(prev => {
      const next = prev.map(a => ids.includes(a.id) ? patchFn(a) : a);
      window.ASSETS = next;
      next.filter(a => ids.includes(a.id)).forEach(a => window.dbSaveAsset(a).catch(console.error));
      return next;
    });
  }

  function bulkAddTag(ids, tagId) {
    bulkPatch(ids, a => {
      const next = a.tags.includes(tagId) ? a.tags : [...a.tags, tagId];
      return { ...a, tags: cleanUnassignedTags(next) };
    });
    const tg = window.TAGS.find(t => t.id === tagId);
    setToast(lang === "de" ? `Tag hinzugefügt${tg ? ": " + tg.name : ""}` : `Tag added${tg ? ": " + tg.name_en : ""}`);
  }

  function bulkSetAuthor(ids, user) {
    const authorRole = user.role === "Admin" ? "in_house" : "in_house";
    bulkPatch(ids, a => ({ ...a, author: user.name, authorRole }));
    setToast(lang === "de" ? `Urheber gesetzt: ${user.name}` : `Author set: ${user.name}`);
  }

  // ── Tag CRUD ──────────────────────────────────────────────────────────────
  function saveTag(tag) {
    setTags(prev => {
      const next = prev.find(t => t.id === tag.id) ? prev.map(t => t.id === tag.id ? tag : t) : [...prev, tag];
      window.TAGS = next;
      return next;
    });
    window.dbSaveTag(tag).catch(console.error);
  }
  window.saveTag = saveTag;

  function updateAssetTags(id, newTags) {
    bulkPatch([id], a => ({ ...a, tags: cleanUnassignedTags(newTags) }));
  }
  window.updateAssetTags = updateAssetTags;

  function deleteTag(id) {
    setTags(prev => { const next = prev.filter(t => t.id !== id); window.TAGS = next; return next; });
    // Remove deleted tag from all assets
    setAssets(prev => {
      const affected = prev.filter(a => a.tags.includes(id));
      if (!affected.length) return prev;
      const next = prev.map(a => a.tags.includes(id) ? { ...a, tags: a.tags.filter(t => t !== id) } : a);
      window.ASSETS = next;
      affected.forEach(a => window.dbSaveAsset({ ...a, tags: a.tags.filter(t => t !== id) }).catch(console.error));
      return next;
    });
    window.dbDeleteTag(id).catch(console.error);
    setToast(lang === "de" ? "Tag gelöscht" : "Tag deleted");
  }

  // ── Tag-Collection CRUD ───────────────────────────────────────────────────
  function saveTagCollection(name) {
    const id = "tc-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    const col = {
      id, name, area,
      filterTags: [...filterTags],
      filterYear: filterYear ?? null,
      filterMonth: filterMonth ?? null,
      filterAuthor: filterAuthor ?? null,
      createdAt: new Date().toISOString(),
    };
    setTagCollections(prev => [col, ...prev]);
    setActiveTagColId(id);
    window.dbSaveTagCollection?.(col).catch(console.error);
    setToast(lang === "de" ? `Tag-Sammlung gespeichert: „${name}"` : `Tag collection saved: "${name}"`);
  }

  function loadTagCollection(col) {
    if (col.area) setArea(col.area);
    setFilterTags(col.filterTags || []);
    setFilterYear(col.filterYear ?? null);
    setFilterMonth(col.filterMonth ?? null);
    setFilterAuthor(col.filterAuthor ?? null);
    setQuery("");
    setActiveTagColId(col.id);
  }

  function renameTagCollection(id, name) {
    setTagCollections(prev => {
      const next = prev.map(c => c.id === id ? { ...c, name } : c);
      const col = next.find(c => c.id === id);
      if (col) window.dbSaveTagCollection?.(col).catch(console.error);
      return next;
    });
  }

  function deleteTagCollection(id) {
    setTagCollections(prev => prev.filter(c => c.id !== id));
    if (activeTagColId === id) setActiveTagColId(null);
    window.dbDeleteTagCollection?.(id).catch(console.error);
    setToast(lang === "de" ? "Tag-Sammlung gelöscht" : "Tag collection deleted");
  }

  // ── Team CRUD ─────────────────────────────────────────────────────────────
  function saveTeamMember(member) {
    setTeam(prev => {
      const next = prev.find(u => u.id === member.id) ? prev.map(u => u.id === member.id ? member : u) : [...prev, member];
      window.TEAM = next;
      return next;
    });
    window.dbSaveTeamMember(member).catch(console.error);
  }

  function deleteTeamMember(id) {
    setTeam(prev => { const next = prev.filter(u => u.id !== id); window.TEAM = next; return next; });
    window.dbDeleteTeamMember(id).catch(console.error);
    setToast(lang === "de" ? "Mitglied entfernt" : "Member removed");
  }

  function pinFolder(id) {
    const imgFolder = imageFolders.find(f => f.id === id);
    const pdfFolder = pdfFolders.find(f => f.id === id);
    if (imgFolder) {
      const updated = { ...imgFolder, pinned: !imgFolder.pinned };
      setImageFolders(prev => prev.map(f => f.id === id ? updated : f));
      window.dbSaveFolder(updated).catch(console.error);
      setToast(updated.pinned ? (lang === "de" ? "Auf Home angeheftet" : "Pinned to home") : (lang === "de" ? "Von Home entfernt" : "Unpinned from home"));
    } else if (pdfFolder) {
      const updated = { ...pdfFolder, pinned: !pdfFolder.pinned };
      setPdfFolders(prev => prev.map(f => f.id === id ? updated : f));
      window.dbSavePdfFolder(updated).catch(console.error);
      setToast(updated.pinned ? (lang === "de" ? "Auf Home angeheftet" : "Pinned to home") : (lang === "de" ? "Von Home entfernt" : "Unpinned from home"));
    }
  }

  function bulkMoveAssets(ids, folderId) {
    bulkPatch(ids, a => ({ ...a, folderId }));
    const f = [...imageFolders, ...pdfFolders].find(x => x.id === folderId);
    setToast(lang === "de" ? `Verschoben nach: ${f?.name || folderId}` : `Moved to: ${f?.name || folderId}`);
  }

  function moveFolderParent(id, parentId) {
    const isPdf = !!pdfFolders.find(f => f.id === id);
    const setter = isPdf ? setPdfFolders : setImageFolders;
    const save   = isPdf ? window.dbSavePdfFolder : window.dbSaveFolder;
    setter(prev => {
      const next = prev.map(f => f.id === id ? { ...f, parent: parentId || null } : f);
      if (isPdf) window.PDF_FOLDERS = next; else window.FOLDERS = next;
      return next;
    });
    const f = [...imageFolders, ...pdfFolders].find(x => x.id === id);
    if (f) save({ ...f, parent: parentId || null }).catch(console.error);
    setToast(lang === "de" ? "Ordner verschoben" : "Folder moved");
  }

  function moveAssetsToArea(ids, targetArea) {
    const unsorted = targetArea === "print" ? "p-unsorted" : "f-unsorted";
    bulkPatch(ids, a => ({ ...a, area: targetArea, folderId: unsorted, date: new Date().toISOString() }));
    const label = lang === "de"
      ? `Nach ${targetArea === "print" ? "Print" : "Bilder"} verschoben`
      : `Moved to ${targetArea === "print" ? "Print" : "Images"}`;
    setToast(label);
  }

  function openFolder(id) {
    const pdfFolder = pdfFolders.find(f => f.id === id);
    if (pdfFolder) {
      const base = pdfFolder.category === "literatur" ? "literatur" : "pdfs";
      setRoute(base + ":" + id);
    } else {
      setRoute("folders:" + id);
    }
  }

  function createFolder(name, category = "kampagne") {
    const id = (area === "print" ? "p-" : "f-") + Math.random().toString(36).slice(2, 8);
    const hues = [25, 90, 200, 290, 50, 140, 170, 220];
    const newF = {
      id,
      name,
      parent: null,
      count: 0,
      updated: new Date().toISOString().slice(0, 10),
      coverHues: [hues[Math.floor(Math.random()*hues.length)], hues[Math.floor(Math.random()*hues.length)], hues[Math.floor(Math.random()*hues.length)], hues[Math.floor(Math.random()*hues.length)]],
      owner: "u-tt",
      sortOrder: 0,
      ...(area === "print" ? { category } : {}),
    };
    setFolders(prev => [newF, ...prev]);
    setToast(lang === "de" ? `Ordner „${name}" angelegt` : `Folder "${name}" created`);
    const save = area === "print" ? window.dbSavePdfFolder : window.dbSaveFolder;
    save(newF).catch(console.error);
    return id;
  }
  window.createFolder = createFolder;

  function renameFolder(id, name) {
    setFolders(prev => prev.map(f => {
      if (f.id !== id) return f;
      const updated = { ...f, name };
      const save = area === "print" ? window.dbSavePdfFolder : window.dbSaveFolder;
      save(updated).catch(console.error);
      return updated;
    }));
  }

  function deleteFolder(id) {
    // "Nicht zugeordnet" collections are protected — cannot be deleted
    if (id === "f-unsorted" || id === "p-unsorted") {
      setToast(lang === "de" ? `„Nicht zugeordnet“ kann nicht gelöscht werden` : `"Unsorted" cannot be deleted`);
      return;
    }
    const f = folders.find(x => x.id === id);
    if (!f) return;
    const targetFolder = area === "print" ? "p-unsorted" : "f-unsorted";
    // Optimistic update — move assets to unsorted, remove folder
    const prevFolders = folders;
    const prevAssets  = assets;
    setFolders(prev => prev.filter(x => x.id !== id));
    setAssets(prev => prev.map(a => a.folderId === id ? { ...a, folderId: targetFolder } : a));
    if (route.endsWith(":" + id)) {
      const rb = route.split(":")[0];
      setRoute(rb === "literatur" ? "literatur" : (area === "print" ? "pdfs" : "folders"));
    }
    setToast(lang === "de" ? `Sammlung gelöscht · Inhalte in „Nicht zugeordnet"` : `Collection deleted · Contents moved to "Unsorted"`);
    const del = area === "print" ? window.dbDeletePdfFolder : window.dbDeleteFolder;
    del(id).catch(err => console.warn("deleteFolder (Firestore):", err?.message));
  }

  function reorderFolders(dragId, dropId) {
    setFolders(prev => {
      const arr = [...prev];
      const from = arr.findIndex(f => f.id === dragId);
      const to   = arr.findIndex(f => f.id === dropId);
      if (from === -1 || to === -1) return prev;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      window.dbReorderFolders(arr.map(f => f.id), area === "print").catch(console.error);
      return arr;
    });
  }

  const baseRoute = route.split(":")[0];
  const detailId = route.split(":")[1];
  const currentFolder = detailId
    ? (folders.find(f => f.id === detailId) ||
       (detailId === "f-unsorted" ? { id: "f-unsorted", name: lang === "de" ? "Nicht zugeordnet" : "Unsorted", count: 0, updated: "" } : null) ||
       (detailId === "p-unsorted" ? { id: "p-unsorted", name: lang === "de" ? "Nicht zugeordnet" : "Unsorted", count: 0, updated: "" } : null))
    : null;

  const { TweaksPanel, TweakSection, TweakRadio, TweakColor } = window;

  // expose favorites for sidebar count
  window.__favorites = favorites;

  // ── Auth gate: show spinner / login before main app ───────────────────────
  if (!authReady) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ width: 28, height: 28, border: "2.5px solid var(--line-strong)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }
  if (!user) {
    return <window.LoginScreen tenantId={window.TENANT_ID} />;
  }

  return (
    <window.LangCtx.Provider value={{ lang, setLang, t }}>
     <window.FavCtx.Provider value={{ favorites, toggleFavorite, bulkSetFavorite }}>
      {window.isImpersonating?.() && (
        <window.ImpersonationBanner tenantId={window.TENANT_ID} />
      )}
      {route === "external" ? (
        <window.ExternalShareView onExit={() => setRoute("favorites")} lang={lang} />
      ) : (
        <div className="app" style={{ gridTemplateColumns: `${sidebarCollapsed ? 48 : sidebarWidth}px 1fr`, ...(window.isImpersonating?.() ? { paddingTop: 36 } : {}) }}>
          <Sidebar
            area={area} setArea={setArea}
            folders={folders}
            route={route} setRoute={setRoute}
            lang={lang}
            onUpload={() => setUploadOpen(true)}
            onCreateFolder={createFolder}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
            onReorderFolders={reorderFolders}
            onMoveAssets={bulkMoveAssets}
            onMoveAssetsToArea={moveAssetsToArea}
            onMoveFolder={moveFolderParent}
            onPinFolder={pinFolder}
            onDevOpen={() => setDevOpen(true)}
            assets={assets}
            currentUser={user}
            companyName={companyName}
            onSignOut={signOut}
            tagCollections={tagCollections}
            onLoadTagCollection={loadTagCollection}
            onDeleteTagCollection={deleteTagCollection}
            onRenameTagCollection={renameTagCollection}
            activeTagColId={activeTagColId}
            collapsed={sidebarCollapsed}
            onCollapse={setSidebarCollapsed}
            onResize={setSidebarWidth}
            theme={theme}
          />
          <div className="main">
            <Topbar lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} query={query} setQuery={setQuery} assets={assets} area={area} filterYear={filterYear} setFilterYear={setFilterYear} filterMonth={filterMonth} setFilterMonth={setFilterMonth} filterTags={filterTags} setFilterTags={setFilterTags} filterAuthor={filterAuthor} setFilterAuthor={setFilterAuthor} onClearFilters={clearFilters} onSaveFilters={saveTagCollection} />
            <div className="content scroll" ref={contentRef}>
              {!dbReady && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
                  <div style={{ width: 28, height: 28, border: "2.5px solid var(--line-strong)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                </div>
              )}
              {/* Global search / filter — overrides current route */}
              {dbReady && (query || hasFilter) && (
                <window.RecentUploadsView assets={assets} area={area} lang={lang} query={query} filterYear={filterYear} filterMonth={filterMonth} filterTags={filterTags} filterAuthor={filterAuthor} onOpenAsset={openAssetWith} onOpenFolder={openFolder} onShareTarget={setShareTarget} onDeleteAssets={deleteAssets} onBulkAddTag={bulkAddTag} onBulkSetAuthor={bulkSetAuthor} onBulkMoveAssets={bulkMoveAssets} imageFolders={imageFolders} pdfFolders={pdfFolders} />
              )}
              {dbReady && !query && !hasFilter && baseRoute === "recent" && (
                <window.RecentView area={area} assets={assets} folders={imageFolders} pdfFolders={pdfFolders} sharedLinks={sharedLinks} currentUser={user} onOpenFolder={openFolder} onOpenAsset={openAssetWith} onShareTarget={setShareTarget} onDeleteAssets={deleteAssets} onBulkAddTag={bulkAddTag} onBulkSetAuthor={bulkSetAuthor} onBulkMoveAssets={bulkMoveAssets} lang={lang} />
              )}
              {dbReady && !query && !hasFilter && baseRoute === "favorites" && (
                <window.FavoritesView assets={assets} area={area} lang={lang} onOpenAsset={openAssetWith} onOpenFolder={openFolder} onShareTarget={setShareTarget} query={query} onDeleteAssets={deleteAssets} onBulkAddTag={bulkAddTag} onBulkSetAuthor={bulkSetAuthor} onBulkMoveAssets={bulkMoveAssets} imageFolders={imageFolders} pdfFolders={pdfFolders} />
              )}
              {dbReady && !query && !hasFilter && baseRoute === "uploads" && (
                <window.RecentUploadsView assets={assets} area={area} lang={lang} query={query} onOpenAsset={openAssetWith} onOpenFolder={openFolder} onShareTarget={setShareTarget} onDeleteAssets={deleteAssets} onBulkAddTag={bulkAddTag} onBulkSetAuthor={bulkSetAuthor} onBulkMoveAssets={bulkMoveAssets} imageFolders={imageFolders} pdfFolders={pdfFolders} />
              )}
              {dbReady && !query && !hasFilter && baseRoute === "all" && (
                <window.AllAssetsView assets={assets} area={area} lang={lang} onOpenAsset={openAssetWith} onShareTarget={setShareTarget} query={query} onDeleteAssets={deleteAssets} onBulkAddTag={bulkAddTag} onBulkSetAuthor={bulkSetAuthor} onBulkMoveAssets={bulkMoveAssets} imageFolders={imageFolders} pdfFolders={pdfFolders} />
              )}
              {dbReady && !query && !hasFilter && baseRoute === "folders" && !detailId && (
                <window.FoldersView folders={imageFolders} kind="image" lang={lang} onOpenFolder={openFolder} onCreateNew={() => setUploadOpen(true)} onMoveAssets={bulkMoveAssets} />
              )}
              {dbReady && !query && !hasFilter && baseRoute === "folders" && currentFolder && (
                <window.FolderDetailView assets={assets} folder={currentFolder} kind="image" lang={lang} onBack={() => setRoute("folders")} onOpenFolder={openFolder} onOpenAsset={openAssetWith} onShareTarget={setShareTarget} onUpload={() => setUploadOpen(true)} onDeleteAssets={deleteAssets} onBulkAddTag={bulkAddTag} onBulkSetAuthor={bulkSetAuthor} onBulkMoveAssets={bulkMoveAssets} imageFolders={imageFolders} pdfFolders={pdfFolders} />
              )}
              {dbReady && !query && !hasFilter && baseRoute === "pdfs" && !detailId && (
                <window.FoldersView folders={pdfFolders.filter(f => !f.category || f.category === "kampagne")} kind="pdf" lang={lang} onOpenFolder={openFolder} onCreateNew={() => setUploadOpen(true)} onMoveAssets={bulkMoveAssets} />
              )}
              {dbReady && !query && !hasFilter && baseRoute === "pdfs" && currentFolder && (
                <window.FolderDetailView assets={assets} folder={currentFolder} kind="pdf" lang={lang} onBack={() => setRoute("pdfs")} onOpenFolder={openFolder} onOpenAsset={openAssetWith} onShareTarget={setShareTarget} onUpload={() => setUploadOpen(true)} onDeleteAssets={deleteAssets} onBulkAddTag={bulkAddTag} onBulkSetAuthor={bulkSetAuthor} onBulkMoveAssets={bulkMoveAssets} imageFolders={imageFolders} pdfFolders={pdfFolders} />
              )}
              {dbReady && !query && !hasFilter && baseRoute === "literatur" && !detailId && (
                <window.FoldersView folders={pdfFolders.filter(f => f.category === "literatur")} kind="pdf" lang={lang} onOpenFolder={openFolder} onCreateNew={() => setUploadOpen(true)} onMoveAssets={bulkMoveAssets} />
              )}
              {dbReady && !query && !hasFilter && baseRoute === "literatur" && currentFolder && (
                <window.FolderDetailView assets={assets} folder={currentFolder} kind="pdf" lang={lang} onBack={() => setRoute("literatur")} onOpenFolder={openFolder} onOpenAsset={openAssetWith} onShareTarget={setShareTarget} onUpload={() => setUploadOpen(true)} onDeleteAssets={deleteAssets} onBulkAddTag={bulkAddTag} onBulkSetAuthor={bulkSetAuthor} onBulkMoveAssets={bulkMoveAssets} imageFolders={imageFolders} pdfFolders={pdfFolders} />
              )}
              {dbReady && !query && !hasFilter && baseRoute === "tags" && <window.TagsView assets={assets} tags={tags} onSaveTag={saveTag} onDeleteTag={deleteTag} onOpenAsset={openAssetWith} lang={lang} />}
              {!query && !hasFilter && baseRoute === "shared" && <window.SharedView onOpenShare={() => setRoute("external")} lang={lang} />}
              {!query && !hasFilter && baseRoute === "admin" && user?.email === window.SUPERADMIN_EMAIL && (
                <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <window.AdminView lang={lang} />
                </div>
              )}
              {!query && !hasFilter && baseRoute === "dev" && <window.AdminView lang={lang} />}
              {!query && !hasFilter && baseRoute === "settings" && <window.SettingsView lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} density={density} setDensity={setDensity} team={team} onSaveTeamMember={saveTeamMember} onDeleteTeamMember={deleteTeamMember} tags={tags} onSaveTag={saveTag} onDeleteTag={deleteTag} />}
            </div>
          </div>
        </div>
      )}

      <window.AssetDetailModal open={!!openAsset} asset={openAsset} peerAssets={openPeers || peerAssets} onNavigate={(a) => setOpenAsset(a)} onClose={() => { setOpenAsset(null); setOpenPeers(null); }} onShare={(a) => setShareTarget({ asset: a })} onChange={changeAsset} onDelete={deleteAssets} lang={lang} />
      <window.ShareDialog open={!!shareTarget} target={shareTarget} onClose={() => setShareTarget(null)} onShared={(m) => setToast(m)} lang={lang} />
      <window.UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} defaultFolder={currentFolder?.id} area={area} onUploaded={(n) => setToast(lang === "de" ? `${n} Dateien hochgeladen` : `${n} files uploaded`)} lang={lang} />
      <window.Toast msg={toast} onDone={() => setToast(null)} />
      <window.DevPanel open={devOpen} onClose={() => setDevOpen(false)} />

      <TweaksPanel title="Tweaks" defaults={TWEAK_DEFAULTS}>
        <TweakSection label={lang === "de" ? "Darstellung" : "Appearance"}>
          <TweakRadio label="Theme" value={tweaks.theme} options={[
            { value: "light", label: lang === "de" ? "Hell" : "Light" },
            { value: "dark", label: "Dark" },
          ]} onChange={(v) => setTweak("theme", v)} />
          <TweakRadio label={lang === "de" ? "Sprache" : "Language"} value={tweaks.lang} options={[
            { value: "de", label: "DE" },
            { value: "en", label: "EN" },
          ]} onChange={(v) => setTweak("lang", v)} />
          <TweakRadio label={lang === "de" ? "Dichte" : "Density"} value={tweaks.density} options={[
            { value: "compact", label: lang === "de" ? "Komp." : "Compact" },
            { value: "comfortable", label: "Std." },
            { value: "cozy", label: lang === "de" ? "Geräumig" : "Cozy" },
          ]} onChange={(v) => setTweak("density", v)} />
          <TweakColor label={lang === "de" ? "Akzent" : "Accent"} value={tweaks.accent} options={["#dc2c2c", "#0a0a0a", "#0d6efd", "#1f8a5b", "#c2410c"]} onChange={(v) => setTweak("accent", v)} />
        </TweakSection>
      </TweaksPanel>
     </window.FavCtx.Provider>
    </window.LangCtx.Provider>
  );
}

// ── ErrorBoundary — catches render errors and shows them instead of blank page ─
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[picpop] Render error:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "100vh", padding: 40, fontFamily: "Geist, sans-serif",
          background: "#0c0c0b", color: "#f4f4f1",
        }}>
          <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 16 }}>picpop — Fehler</div>
          <div style={{ color: "#f87171", fontFamily: "Geist Mono, monospace", fontSize: 13, maxWidth: 700, whiteSpace: "pre-wrap", background: "#1a0808", padding: 20, borderRadius: 8, border: "1px solid #f8717133" }}>
            {String(this.state.error)}
          </div>
          <button
            onClick={() => { this.setState({ error: null }); }}
            style={{ marginTop: 24, padding: "10px 24px", background: "#dc2c2c", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 500 }}
          >
            Neu laden
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <AppErrorBoundary><App /></AppErrorBoundary>
);
