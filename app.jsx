// Main App — sidebar with area switcher + folder CRUD, topbar, routing, tweaks

const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA, useRef: useRefA } = React;

// ── FolderRow ────────────────────────────────────────────────────────────────
function FolderRow({ folder, active, onOpen, onRename, onDelete, onPin, onMoveAssets, onDragStart, onDragOver, onDrop, dragOverHint, lang, liveCount }) {
  const t = window.makeT(lang);
  const [editing, setEditing] = useStateA(false);
  const [name, setName] = useStateA(folder.name);
  const [menu, setMenu] = useStateA(false);
  const [confirmDel, setConfirmDel] = useStateA(false);
  const inputRef = useRefA(null);

  useEffectA(() => { setName(folder.name); }, [folder.name]);
  useEffectA(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function commit() {
    const v = name.trim();
    if (v && v !== folder.name) onRename(folder.id, v);
    else setName(folder.name);
    setEditing(false);
  }

  function closeMenu() { setMenu(false); setConfirmDel(false); }

  return (
    <div
      className={"nav-item folder-row" + (active ? " active" : "") + (dragOverHint ? " drop-target" : "")}
      draggable={!editing}
      onDragStart={(e) => { onDragStart(folder.id); e.dataTransfer.setData("application/picpop-folder", folder.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(folder.id); }}
      onDrop={(e) => {
        e.preventDefault();
        const assetData = e.dataTransfer.getData("application/picpop-assets");
        if (assetData) {
          try { onMoveAssets?.(JSON.parse(assetData), folder.id); } catch (_) {}
        } else {
          onDrop(folder.id);
        }
      }}
      onClick={() => !editing && onOpen(folder.id)}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      style={{ position: "relative" }}
    >
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
      <span className="count num" style={{ marginRight: 4 }}>{liveCount ?? folder.count}</span>
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

// ── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ area, setArea, folders, route, setRoute, lang, onUpload, onCreateFolder, onRenameFolder, onDeleteFolder, onPinFolder, onReorderFolders, onMoveAssets, onDevOpen, assets, currentUser, onSignOut }) {
  const t = window.makeT(lang);
  const [creating, setCreating] = useStateA(false);
  const [newName, setNewName] = useStateA("");
  const newInputRef = useRefA(null);
  const [dragId, setDragId] = useStateA(null);
  const [overId, setOverId] = useStateA(null);

  useEffectA(() => { if (creating) newInputRef.current?.focus(); }, [creating]);

  function commitNew() {
    const v = newName.trim();
    if (v) onCreateFolder(v);
    setNewName("");
    setCreating(false);
  }

  const baseRoute = route.split(":")[0];
  const detailId = route.split(":")[1];

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div style={{ padding: "16px 16px 12px" }}>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ width: 28, height: 28, background: "var(--fg)", color: "var(--bg)", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 600 }}>p</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em" }}>picpop</div>
            <div className="mono" style={{ color: "var(--muted)", fontSize: 9 }}>Köhler & Co.</div>
          </div>
        </div>
      </div>

      {/* Area switcher */}
      <div style={{ padding: "0 12px 8px" }}>
        <div className="area-switcher">
          <button className={"area-tab" + (area === "images" ? " active" : "")} onClick={() => setArea("images")}>
            <window.Icon.image size={13} />
            <span>{lang === "de" ? "Bilder" : "Images"}</span>
          </button>
          <button className={"area-tab" + (area === "print" ? " active" : "")} onClick={() => setArea("print")}>
            <window.Icon.pdf size={13} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Upload */}
      <div style={{ padding: "8px 12px 12px" }}>
        <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={onUpload}>
          <window.Icon.upload size={14} /> {t("upload")}
        </button>
      </div>

      <nav className="scroll" style={{ padding: "4px 8px 12px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Overview links */}
        <div className="nav-item" onClick={() => setRoute("recent")} data-active={baseRoute === "recent"}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path d="M8 1.5L1.5 7v7h4.5v-4h4v4h4.5V7L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
          </svg>
          <span>Home</span>
        </div>
        <div className="nav-item" onClick={() => setRoute("favorites")} data-active={baseRoute === "favorites"}>
          <window.Icon.star size={13} />
          <span>{t("nav_favorites")}</span>
          <span className="count num">{window.__favorites?.size || 0}</span>
        </div>
        <div className="nav-item" onClick={() => setRoute("uploads")} data-active={baseRoute === "uploads"}>
          <window.Icon.upload size={13} />
          <span>{t("nav_uploads")}</span>
        </div>
        <div className="nav-item" onClick={() => setRoute("all")} data-active={baseRoute === "all"}>
          <window.Icon.grid size={13} />
          <span>{area === "print" ? t("nav_all_pdfs") : t("nav_all_images")}</span>
          <span className="count num">{assets.filter(a => area === "print" ? a.kind === "pdf" : a.kind !== "pdf").length}</span>
        </div>

        {/* Folder section */}
        <div className="row" style={{ padding: "16px 10px 6px", justifyContent: "space-between", alignItems: "center" }}>
          <div className="eyebrow">{lang === "de" ? "Sammlungen" : "Collections"}</div>
          <button className="btn icon ghost" style={{ width: 20, height: 20 }} onClick={() => setCreating(true)} title={t("new_folder")}>
            <window.Icon.plus size={12} />
          </button>
        </div>

        {creating && (
          <div className="nav-item folder-row" style={{ background: "var(--hover)" }}>
            <window.Icon.folder size={13} />
            <input
              ref={newInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={commitNew}
              onKeyDown={(e) => { if (e.key === "Enter") commitNew(); if (e.key === "Escape") { setNewName(""); setCreating(false); } }}
              placeholder={lang === "de" ? "Ordnername…" : "Folder name…"}
              style={{ flex: 1, minWidth: 0, border: "1px solid var(--accent)", borderRadius: 3, padding: "2px 6px", background: "var(--panel)", color: "var(--fg)", outline: "none", fontSize: 13, marginLeft: -4 }}
            />
          </div>
        )}

        <div
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverId(null); }}
          onDrop={(e) => {
            e.preventDefault();
            const assetData = e.dataTransfer.getData("application/picpop-assets");
            if (!assetData) { /* folder dropped on bg — just clear */ }
            setDragId(null); setOverId(null);
          }}
        >
          {folders.map(f => (
            <FolderRow
              key={f.id}
              folder={f}
              liveCount={(assets || window.ASSETS || []).filter(a => a.folderId === f.id).length}
              active={(baseRoute === "folders" || baseRoute === "pdfs") && detailId === f.id}
              dragOverHint={overId === f.id && dragId !== f.id}
              onOpen={(id) => setRoute((area === "print" ? "pdfs:" : "folders:") + id)}
              onRename={onRenameFolder}
              onDelete={onDeleteFolder}
              onPin={onPinFolder}
              onMoveAssets={(ids, folderId) => { onMoveAssets?.(ids, folderId); setOverId(null); }}
              onDragStart={(id) => setDragId(id)}
              onDragOver={(id) => setOverId(id)}
              onDrop={(id) => { if (dragId && dragId !== id) onReorderFolders(dragId, id); setDragId(null); setOverId(null); }}
              lang={lang}
            />
          ))}
          {folders.length === 0 && (
            <div style={{ padding: "8px 10px", color: "var(--muted)", fontSize: 12 }}>
              {lang === "de" ? "Keine Ordner. Lege einen neuen an." : "No folders yet. Create one."}
            </div>
          )}
        </div>

        {/* Context */}
        <div className="eyebrow" style={{ padding: "16px 10px 4px" }}>{lang === "de" ? "Bibliothek" : "Library"}</div>
        <div className={"nav-item" + (baseRoute === "tags" ? " active" : "")} onClick={() => setRoute("tags")}>
          <window.Icon.tag size={13} />
          <span>{t("nav_tags")}</span>
          <span className="count">{window.TAGS.length}</span>
        </div>
        <div className={"nav-item" + (baseRoute === "shared" ? " active" : "")} onClick={() => setRoute("shared")}>
          <window.Icon.link size={13} />
          <span>{t("nav_shared")}</span>
          <span className="count">{window.SHARED_LINKS.length}</span>
        </div>
        <div className={"nav-item" + (route === "external" ? " active" : "")} onClick={() => setRoute("external")}>
          <window.Icon.globe size={13} />
          <span>{lang === "de" ? "Externe Ansicht" : "External preview"}</span>
        </div>

        <div style={{ flex: 1 }} />

        <div className="eyebrow" style={{ padding: "8px 10px 4px" }}>{lang === "de" ? "Konto" : "Account"}</div>
        <div className={"nav-item" + (baseRoute === "settings" ? " active" : "")} onClick={() => setRoute("settings")}>
          <window.Icon.settings size={13} />
          <span>{t("nav_team")}</span>
        </div>
        {/* Admin — nur für Superadmin sichtbar */}
        {currentUser?.email === window.SUPERADMIN_EMAIL && (
          <div className={"nav-item" + (baseRoute === "admin" ? " active" : "")} onClick={() => setRoute("admin")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            <span>Admin</span>
          </div>
        )}
        <div className="nav-item" onClick={() => onDevOpen?.()} style={{ opacity: 0.45 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          <span>Dev</span>
        </div>
        {currentUser && (
          <div className="row" style={{ gap: 10, padding: "10px 10px 12px", borderTop: "1px solid var(--line)", marginTop: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", background: "var(--line-strong)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 600, fontSize: 12, color: "var(--muted)", flexShrink: 0,
            }}>
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
            <button
              className="btn icon ghost sm"
              title={lang === "de" ? "Abmelden" : "Sign out"}
              onClick={onSignOut}
              style={{ flexShrink: 0, color: "var(--muted)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        )}
      </nav>
    </aside>
  );
}

// ── Topbar ───────────────────────────────────────────────────────────────────
function Topbar({ lang, setLang, theme, setTheme, query, setQuery, route, area, currentFolderName }) {
  const t = window.makeT(lang);
  const baseRoute = route.split(":")[0];
  const crumb = (() => {
    const a = area === "print" ? "Print" : (lang === "de" ? "Bilder" : "Images");
    if (baseRoute === "recent") return [t("nav_recent")];
    if (baseRoute === "favorites") return [t("nav_favorites")];
    if (baseRoute === "uploads") return [t("nav_uploads")];
    if (baseRoute === "all") return [a, area === "print" ? t("nav_all_pdfs") : t("nav_all_images")];
    if (baseRoute === "tags") return [t("nav_tags")];
    if (baseRoute === "shared") return [t("nav_shared")];
    if (baseRoute === "settings") return [lang === "de" ? "Einstellungen" : "Settings"];
    if (baseRoute === "external") return [lang === "de" ? "Externe Ansicht" : "External preview"];
    if (baseRoute === "dev") return ["Dev"];
    if (currentFolderName) return [a, currentFolderName];
    return [a, lang === "de" ? "Alle Ordner" : "All folders"];
  })();
  return (
    <header className="topbar">
      <div className="row" style={{ gap: 6, color: "var(--muted)", fontSize: 12 }}>
        {crumb.map((c, i) => (
          <span key={i} className="row" style={{ gap: 6 }}>
            {i > 0 && <window.Icon.chevR size={10} />}
            <span style={{ color: i === crumb.length - 1 ? "var(--fg)" : "var(--muted)" }}>{c}</span>
          </span>
        ))}
      </div>
      <div className="input ghost" style={{ flex: 1, maxWidth: 520, marginLeft: 16 }}>
        <window.Icon.search size={14} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search_placeholder")} />
        <span className="kbd">⌘K</span>
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
    </header>
  );
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
  const [query, setQuery] = useStateA("");

  const [openAsset, setOpenAsset] = useStateA(null);
  const [devOpen, setDevOpen] = useStateA(false);
  const [shareTarget, setShareTarget] = useStateA(null);
  const [uploadOpen, setUploadOpen] = useStateA(false);
  const [toast, setToast] = useStateA(null);

  // Favorites — set of asset ids
  const [favorites, setFavorites] = useStateA(() => new Set((window.ASSETS || []).slice(0, 4).map(a => a.id)));
  function toggleFavorite(id) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function bulkSetFavorite(ids, fav) {
    setFavorites(prev => {
      const next = new Set(prev);
      ids.forEach(id => { if (fav) next.add(id); else next.delete(id); });
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
  const [dbReady, setDbReady] = useStateA(false);

  // Keep window globals in sync so views that read them directly stay current
  useEffectA(() => { window.FOLDERS = imageFolders; }, [imageFolders]);
  useEffectA(() => { window.PDF_FOLDERS = pdfFolders; }, [pdfFolders]);
  useEffectA(() => { window.ASSETS = assets; }, [assets]);
  useEffectA(() => { window.TAGS = tags; }, [tags]);
  useEffectA(() => { window.TEAM = team; }, [team]);

  // Firestore: seed on first load, then subscribe to live updates
  // Only runs when user is authenticated (user changes from null → object)
  useEffectA(() => {
    if (!user) {
      // Reset data state on logout
      setDbReady(false);
      setImageFolders([]); setPdfFolders([]); setAssets([]); setTags(window.TAGS); setTeam(window.TEAM);
      return;
    }

    // Load AI config so uploadAsset can use the OpenAI key immediately
    window.loadAiConfig?.();

    let unsubFolders, unsubPdfs, unsubAssets, unsubTags, unsubTeam;
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
          if (data.length > 0) { window.TAGS = data; setTags(data); }
        });
        unsubTeam = window.subscribeToTeam(data => {
          if (data.length > 0) { window.TEAM = data; setTeam(data); }
        });
      })
      .catch(err => {
        console.error("Firestore init error:", err);
        setDbReady(true);
      });
    return () => { unsubFolders?.(); unsubPdfs?.(); unsubAssets?.(); unsubTags?.(); unsubTeam?.(); };
  }, [user]);

  const folders = area === "images" ? imageFolders : pdfFolders;
  const setFolders = area === "images" ? setImageFolders : setPdfFolders;

  // Switch route when area switches
  useEffectA(() => {
    if (route.startsWith("folders") || route.startsWith("pdfs")) {
      const base = area === "print" ? "pdfs" : "folders";
      setRoute(base);
    }
  }, [area]);

  // Peer assets for prev/next navigation in detail modal (same area, date-sorted)
  const peerAssets = useMemoA(
    () => [...assets].filter(a => area === "print" ? a.kind === "pdf" : a.kind !== "pdf").sort((a, b) => a.date < b.date ? 1 : -1),
    [assets, area]
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
    bulkPatch(ids, a => ({ ...a, tags: a.tags.includes(tagId) ? a.tags : [...a.tags, tagId] }));
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

  function openFolder(id) {
    const isPdf = pdfFolders.find(f => f.id === id);
    setRoute((isPdf ? "pdfs:" : "folders:") + id);
  }

  function createFolder(name) {
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
    };
    setFolders(prev => [newF, ...prev]);
    setToast(lang === "de" ? `Ordner „${name}" angelegt` : `Folder "${name}" created`);
    const save = area === "print" ? window.dbSavePdfFolder : window.dbSaveFolder;
    save(newF).catch(console.error);
  }

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
    if (route.endsWith(":" + id)) setRoute(area === "print" ? "pdfs" : "folders");
    setToast(lang === "de" ? `Sammlung gelöscht · Inhalte in „Nicht zugeordnet"` : `Collection deleted · Contents moved to "Unsorted"`);
    const del = area === "print" ? window.dbDeletePdfFolder : window.dbDeleteFolder;
    del(id).catch(err => {
      console.error("deleteFolder failed:", err);
      setFolders(prevFolders);
      setAssets(prevAssets);
      setToast(lang === "de" ? "Löschen fehlgeschlagen" : "Delete failed");
    });
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
  const currentFolder = detailId ? folders.find(f => f.id === detailId) : null;

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
        <div className="app" style={window.isImpersonating?.() ? { paddingTop: 36 } : undefined}>
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
            onPinFolder={pinFolder}
            onDevOpen={() => setDevOpen(true)}
            assets={assets}
            currentUser={user}
            onSignOut={signOut}
          />
          <div className="main">
            <Topbar lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} query={query} setQuery={setQuery} route={route} area={area} currentFolderName={currentFolder?.name} />
            <div className="content scroll">
              {!dbReady && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
                  <div style={{ width: 28, height: 28, border: "2.5px solid var(--line-strong)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                </div>
              )}
              {dbReady && baseRoute === "recent" && (
                <window.RecentView area={area} assets={assets} folders={imageFolders} pdfFolders={pdfFolders} onOpenFolder={openFolder} onOpenAsset={(a) => setOpenAsset(a)} onShareTarget={setShareTarget} onDeleteAssets={deleteAssets} onBulkAddTag={bulkAddTag} onBulkSetAuthor={bulkSetAuthor} onBulkMoveAssets={bulkMoveAssets} lang={lang} />
              )}
              {dbReady && baseRoute === "favorites" && (
                <window.FavoritesView assets={assets} area={area} lang={lang} onOpenAsset={(a) => setOpenAsset(a)} onOpenFolder={openFolder} onShareTarget={setShareTarget} query={query} onDeleteAssets={deleteAssets} onBulkAddTag={bulkAddTag} onBulkSetAuthor={bulkSetAuthor} onBulkMoveAssets={bulkMoveAssets} imageFolders={imageFolders} pdfFolders={pdfFolders} />
              )}
              {dbReady && baseRoute === "uploads" && (
                <window.RecentUploadsView assets={assets} area={area} lang={lang} onOpenAsset={(a) => setOpenAsset(a)} onOpenFolder={openFolder} onShareTarget={setShareTarget} onDeleteAssets={deleteAssets} onBulkAddTag={bulkAddTag} onBulkSetAuthor={bulkSetAuthor} onBulkMoveAssets={bulkMoveAssets} imageFolders={imageFolders} pdfFolders={pdfFolders} />
              )}
              {dbReady && baseRoute === "all" && (
                <window.AllAssetsView assets={assets} area={area} lang={lang} onOpenAsset={(a) => setOpenAsset(a)} onShareTarget={setShareTarget} query={query} onDeleteAssets={deleteAssets} onBulkAddTag={bulkAddTag} onBulkSetAuthor={bulkSetAuthor} onBulkMoveAssets={bulkMoveAssets} imageFolders={imageFolders} pdfFolders={pdfFolders} />
              )}
              {dbReady && baseRoute === "folders" && !detailId && (
                <window.FoldersView folders={imageFolders} kind="image" lang={lang} onOpenFolder={openFolder} onCreateNew={() => setUploadOpen(true)} onMoveAssets={bulkMoveAssets} />
              )}
              {dbReady && baseRoute === "folders" && currentFolder && (
                <window.FolderDetailView assets={assets} folder={currentFolder} kind="image" lang={lang} onBack={() => setRoute("folders")} onOpenAsset={(a) => setOpenAsset(a)} onShareTarget={setShareTarget} onUpload={() => setUploadOpen(true)} onDeleteAssets={deleteAssets} onBulkAddTag={bulkAddTag} onBulkSetAuthor={bulkSetAuthor} onBulkMoveAssets={bulkMoveAssets} imageFolders={imageFolders} pdfFolders={pdfFolders} />
              )}
              {dbReady && baseRoute === "pdfs" && !detailId && (
                <window.FoldersView folders={pdfFolders} kind="pdf" lang={lang} onOpenFolder={openFolder} onCreateNew={() => setUploadOpen(true)} onMoveAssets={bulkMoveAssets} />
              )}
              {dbReady && baseRoute === "pdfs" && currentFolder && (
                <window.FolderDetailView assets={assets} folder={currentFolder} kind="pdf" lang={lang} onBack={() => setRoute("pdfs")} onOpenAsset={(a) => setOpenAsset(a)} onShareTarget={setShareTarget} onUpload={() => setUploadOpen(true)} onDeleteAssets={deleteAssets} onBulkAddTag={bulkAddTag} onBulkSetAuthor={bulkSetAuthor} onBulkMoveAssets={bulkMoveAssets} imageFolders={imageFolders} pdfFolders={pdfFolders} />
              )}
              {dbReady && baseRoute === "tags" && <window.TagsView assets={assets} tags={tags} onSaveTag={saveTag} onDeleteTag={deleteTag} onOpenAsset={(a) => setOpenAsset(a)} lang={lang} />}
              {baseRoute === "shared" && <window.SharedView onOpenShare={() => setRoute("external")} lang={lang} />}
              {baseRoute === "admin" && user?.email === window.SUPERADMIN_EMAIL && (
                <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <window.AdminView lang={lang} />
                </div>
              )}
              {baseRoute === "dev" && <window.AdminView lang={lang} />}
              {baseRoute === "settings" && <window.SettingsView lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} density={density} setDensity={setDensity} team={team} onSaveTeamMember={saveTeamMember} onDeleteTeamMember={deleteTeamMember} tags={tags} onSaveTag={saveTag} onDeleteTag={deleteTag} />}
            </div>
          </div>
        </div>
      )}

      <window.AssetDetailModal open={!!openAsset} asset={openAsset} peerAssets={peerAssets} onNavigate={(a) => setOpenAsset(a)} onClose={() => setOpenAsset(null)} onShare={(a) => setShareTarget({ asset: a })} onChange={changeAsset} onDelete={deleteAssets} lang={lang} />
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
