// UI primitives, icons, and i18n hook. All shared via window.*

const { useState, useEffect, useRef, useMemo, useCallback, useContext, createContext, Fragment } = React;

// -------- Thumb-size slider (shared via localStorage) --------
function useThumbSize() {
  const KEY = "picpop.thumbSize";
  const [size, _setSize] = useState(() => {
    const v = parseInt(localStorage.getItem(KEY) || "", 10);
    return Number.isFinite(v) && v >= 120 && v <= 480 ? v : 220;
  });
  const setSize = (v) => { _setSize(v); localStorage.setItem(KEY, String(v)); };
  return [size, setSize];
}

function ThumbSizeSlider({ size, setSize, lang = "de" }) {
  return (
    <div className="row" title={lang === "de" ? "Thumbnail-Größe" : "Thumbnail size"} style={{ gap: 8, height: 32, padding: "0 10px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius)", background: "var(--panel)" }}>
      <Icon.grid size={12} />
      <input
        type="range" min="140" max="420" step="10" value={size}
        onChange={(e) => setSize(parseInt(e.target.value, 10))}
        style={{ width: 110, accentColor: "var(--accent)", cursor: "ew-resize" }}
        aria-label="thumbnail size"
      />
      <span className="mono" style={{ fontSize: 10, color: "var(--muted)", minWidth: 28, textAlign: "right" }}>{size}</span>
    </div>
  );
}

// -------- i18n --------
const LangCtx = createContext({ lang: "de", setLang: () => {}, t: (k) => k });
const FavCtx = createContext({ favorites: new Set(), toggleFavorite: () => {}, bulkSetFavorite: () => {} });
function useFav() { return useContext(FavCtx); }
function useT() {
  const { t } = useContext(LangCtx);
  return t;
}
function useLang() {
  return useContext(LangCtx);
}
function makeT(lang) {
  const dict = window.I18N[lang] || window.I18N.de;
  return (key, vars) => {
    let s = dict[key] || key;
    if (vars) for (const k in vars) s = s.replace("{" + k + "}", vars[k]);
    return s;
  };
}

// -------- Icons (inline strokes, 16px viewBox=24) --------
const Ic = ({ d, size = 16, stroke = 1.5, fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);
const Icon = {
  search: (p) => <Ic {...p} d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14ZM21 21l-4.3-4.3" />,
  upload: (p) => <Ic {...p} d="M12 4v12M6 10l6-6 6 6M4 20h16" />,
  download: (p) => <Ic {...p} d="M12 4v12M18 14l-6 6-6-6M4 4h16" />,
  folder: (p) => <Ic {...p} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
  image: (p) => <Ic {...p} d="M3 5h18v14H3zM3 16l5-5 5 5 3-3 5 5" />,
  pdf: (p) => <Ic {...p} d="M7 3h8l4 4v14H7zM15 3v4h4M9 13h6M9 17h4" />,
  tag: (p) => <Ic {...p} d="M20.6 12.6 12 21l-9-9V3h9l8.6 8.6a1 1 0 0 1 0 1.4ZM7 7h0" />,
  share: (p) => <Ic {...p} d="M18 8a3 3 0 1 0-2.8-4M18 22a3 3 0 1 0-2.8-4M6 15a3 3 0 1 0 0-6M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />,
  link: (p) => <Ic {...p} d="M10 14a4 4 0 0 1 0-5.7l3-3a4 4 0 1 1 5.7 5.7l-1.5 1.5M14 10a4 4 0 0 1 0 5.7l-3 3a4 4 0 1 1-5.7-5.7l1.5-1.5" />,
  settings: (p) => <Ic {...p} d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />,
  clock: (p) => <Ic {...p} d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16ZM12 8v5l3 2" />,
  plus: (p) => <Ic {...p} d="M12 5v14M5 12h14" />,
  x: (p) => <Ic {...p} d="M6 6l12 12M18 6 6 18" />,
  check: (p) => <Ic {...p} d="M5 12l5 5L20 6" />,
  chevR: (p) => <Ic {...p} d="M9 6l6 6-6 6" />,
  chevD: (p) => <Ic {...p} d="M6 9l6 6 6-6" />,
  arrowL: (p) => <Ic {...p} d="M19 12H5M11 6l-6 6 6 6" />,
  grid: (p) => <Ic {...p} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  list: (p) => <Ic {...p} d="M4 6h16M4 12h16M4 18h16" />,
  filter: (p) => <Ic {...p} d="M4 5h16l-6 8v6l-4-2v-4z" />,
  more: (p) => <Ic {...p} d="M5 12h.01M12 12h.01M19 12h.01" />,
  eye: (p) => <Ic {...p} d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />,
  edit: (p) => <Ic {...p} d="M4 20h4l10-10-4-4L4 16zM14 6l4 4" />,
  star: (p) => <Ic {...p} d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.5l1.1-6L3.4 9.3l6-.8z" />,
  pin: (p) => <Ic {...p} d="M9 3h6l-1 6 4 4-7 1-1 7-1-7-7-1 4-4z" />,
  trash: (p) => <Ic {...p} d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  globe: (p) => <Ic {...p} d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16ZM4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16" />,
  sun: (p) => <Ic {...p} d="M12 4v2M12 18v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />,
  moon: (p) => <Ic {...p} d="M20 14.5A8 8 0 1 1 9.5 4a6 6 0 0 0 10.5 10.5Z" />,
  user: (p) => <Ic {...p} d="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4 21a8 8 0 0 1 16 0" />,
  inbox: (p) => <Ic {...p} d="M3 4h18v10h-5l-1 3h-6l-1-3H3z" />,
  copy: (p) => <Ic {...p} d="M9 9h11v11H9zM4 4h11v3H7v8H4z" />,
  lock: (p) => <Ic {...p} d="M6 10V8a6 6 0 1 1 12 0v2M5 10h14v10H5z" />,
  unlock: (p) => <Ic {...p} d="M6 10V8a6 6 0 0 1 11-3M5 10h14v10H5z" />,
  cube: (p) => <Ic {...p} d="M12 3l9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v10" />,
  campaign: (p) => <Ic {...p} d="M3 11v2l14 6V5L3 11ZM17 8a4 4 0 0 1 0 8M7 13v6h3" />,
};

// -------- Helpers --------
function fmtRel(iso, t) {
  const d = new Date(iso);
  const now = new Date("2026-05-12T11:00:00").getTime();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 90) return t("just_now");
  if (diff < 3600) return t("minutes_ago", { n: Math.round(diff/60) });
  if (diff < 86400) return t("hours_ago", { n: Math.round(diff/3600) });
  return t("days_ago", { n: Math.round(diff/86400) });
}
function fmtDate(iso, lang) {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "de" ? "de-CH" : "en-GB", { year: "numeric", month: "short", day: "2-digit" });
}
function userById(id) { return window.TEAM.find(u => u.id === id); }
function tagById(id) { return window.TAGS.find(t => t.id === id); }
function folderById(id) { return [...window.FOLDERS, ...window.PDF_FOLDERS].find(f => f.id === id); }
function tagLabel(tag, lang) { return lang === "en" ? tag.name_en : tag.name; }

function tagColor(tag, dark) {
  return "var(--fg-2)";
}
function tagBg(tag, dark) {
  return "var(--hover)";
}

// Build a deterministic image URL from a seed.
function imgUrl(seed, w = 800, h = 600) {
  const safe = String(seed || "x").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return `https://picsum.photos/seed/picpop-${safe}/${Math.round(w)}/${Math.round(h)}`;
}

// Image with hue-tinted placeholder background while loading / on error.
function AssetImg({ asset, w = 800, h, style, className = "", alt = "" }) {
  const ratio = asset.ratio || 1;
  const height = h || Math.round(w / ratio);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = asset.storageUrl || imgUrl(asset.id + "-" + asset.title, w, height);
  return (
    <div className={className} style={{
      position: "absolute", inset: 0, width: "100%", height: "100%",
      background: `linear-gradient(180deg, oklch(86% 0.06 ${asset.hue}), oklch(72% 0.08 ${asset.hue}))`,
      overflow: "hidden",
      ...style,
    }}>
      {!failed && (
        <img
          src={src}
          alt={alt || asset.title}
          loading="lazy"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            width: "100%", height: "100%", objectFit: "cover", display: "block",
            opacity: loaded ? 1 : 0, transition: "opacity .25s ease",
          }}
        />
      )}
    </div>
  );
}

// Placeholder block with hue
function PH({ hue = 25, label = "image", style, ratio, className = "" }) {
  const s = {
    ...(ratio ? { aspectRatio: ratio } : {}),
    "--ph-1": `oklch(86% 0.06 ${hue})`,
    "--ph-2": `oklch(72% 0.08 ${hue})`,
    ...style,
  };
  return <div className={"ph " + className} style={s} data-label={label} />;
}
function PHDark({ hue = 25, label = "image", style }) {
  // PDF style — paper-like with header bar
  return (
    <div className="ph" style={{
      "--ph-1": `oklch(96% 0.01 ${hue})`,
      "--ph-2": `oklch(92% 0.02 ${hue})`,
      width: "100%",
      height: "100%",
      ...style,
    }} data-label={label}>
      <div style={{ position: "absolute", inset: "8% 10% auto 10%", height: "6%", background: `oklch(60% 0.16 ${hue})`, borderRadius: 1 }} />
      <div style={{ position: "absolute", inset: "20% 10% 60% 10%", display: "grid", gap: "2%", gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ background: `oklch(70% 0.12 ${hue})`, borderRadius: 2 }} />
        <div style={{ display: "grid", gap: "8%" }}>
          <div style={{ background: "rgba(0,0,0,0.1)", height: "20%" }} />
          <div style={{ background: "rgba(0,0,0,0.08)", height: "12%", width: "80%" }} />
          <div style={{ background: "rgba(0,0,0,0.08)", height: "12%", width: "60%" }} />
          <div style={{ background: "rgba(0,0,0,0.08)", height: "12%", width: "70%" }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: "10%", right: "10%", bottom: "12%", display: "grid", gap: "1.5%" }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ height: "5%", width: (90 - i*8) + "%", background: "rgba(0,0,0,0.08)" }} />
        ))}
      </div>
    </div>
  );
}

// Avatar
function Avatar({ user, size = 24 }) {
  if (!user) return null;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `oklch(70% 0.1 ${user.hue})`,
      color: "white",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-mono)", fontSize: Math.round(size * 0.42), fontWeight: 500,
      flex: "none",
    }}>{user.initials}</div>
  );
}

// Avatar stack
function AvatarStack({ users, size = 22, max = 4 }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div style={{ display: "inline-flex" }}>
      {shown.map((u, i) => (
        <div key={u.id} style={{ marginLeft: i === 0 ? 0 : -6, border: "2px solid var(--panel)", borderRadius: "50%", lineHeight: 0 }}>
          <Avatar user={u} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <div style={{ marginLeft: -6, width: size, height: size, borderRadius: "50%", background: "var(--hover)", color: "var(--fg-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: Math.round(size*0.4), border: "2px solid var(--panel)" }}>+{extra}</div>
      )}
    </div>
  );
}

// Tag pill
function TagPill({ tag, lang, onRemove, solid = false }) {
  const bg = solid ? tagColor(tag) : tagBg(tag);
  const fg = solid ? "var(--bg)" : tagColor(tag);
  return (
    <span className="chip" style={{ background: bg, color: fg, borderColor: "transparent" }}>
      <span className="tag-dot" style={{ background: tagColor(tag) }} />
      {tagLabel(tag, lang)}
      {onRemove && <span className="x" onClick={(e) => { e.stopPropagation(); onRemove(); }}><Icon.x size={10} /></span>}
    </span>
  );
}

// FolderTile — 2x2 mosaic preview; also a drop target for asset drag-and-drop
function FolderTile({ folder, onOpen, kind = "image", onMoveAssets }) {
  const assetsIn = (window.ASSETS || []).filter(a => a.folderId === folder.id).slice(0, 4);
  const [isOver, setIsOver] = useState(false);
  const tiles = [];
  for (let i = 0; i < 4; i++) {
    tiles.push(assetsIn[i] || { id: `${folder.id}-ph-${i}`, title: folder.name + " " + i, hue: folder.coverHues[i] || 25, ratio: 1, kind });
  }

  function handleDragOver(e) {
    if (!e.dataTransfer.types.includes("application/picpop-assets")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsOver(true);
  }
  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsOver(false);
  }
  function handleDrop(e) {
    e.preventDefault();
    setIsOver(false);
    const raw = e.dataTransfer.getData("application/picpop-assets");
    if (raw) {
      try { onMoveAssets?.(JSON.parse(raw), folder.id); } catch (_) {}
    } else {
      onOpen?.();
    }
  }

  return (
    <div
      className={"folder-tile" + (isOver ? " drop-over" : "")}
      onClick={onOpen}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="mosaic">
        {tiles.map((a, i) => (
          <div key={i} style={{ position: "relative", overflow: "hidden" }}>
            {a.kind === "pdf"
              ? (a.thumbnailUrl
                  ? <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                      <img src={a.thumbnailUrl} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </div>
                  : <PHDark hue={a.hue} label="" />)
              : (!a.storageUrl && kind === "pdf")
                  ? <PHDark hue={a.hue} label="" />  /* placeholder tile in a print folder */
                  : <AssetImg asset={a} w={400} h={300} />
            }
          </div>
        ))}
      </div>
      <div className="label">
        <span className="name">{folder.name}</span>
        <span className="count num">{folder.count}</span>
      </div>
      {isOver && (
        <div style={{ position: "absolute", inset: 0, background: "var(--accent-soft)", border: "2px solid var(--accent)", borderRadius: "inherit", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ background: "var(--accent)", color: "white", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon.folder size={13} /> {folder.name}
          </div>
        </div>
      )}
    </div>
  );
}

// AssetTile — draggable; dragIds = IDs to move (all selected if tile is in selection)
function AssetTile({ asset, onOpen, selectable = false, selected = false, onToggleSelect, dragIds }) {
  const { favorites, toggleFavorite } = useFav();
  const fav = favorites.has(asset.id);
  const [isDragging, setIsDragging] = useState(false);

  function clickFav(e) { e.stopPropagation(); toggleFavorite(asset.id); }
  function clickSel(e) { e.stopPropagation(); onToggleSelect && onToggleSelect(asset.id, e.shiftKey); }
  function clickTile(e) {
    if (selectable && (e.metaKey || e.ctrlKey || e.shiftKey)) {
      e.preventDefault(); e.stopPropagation();
      onToggleSelect && onToggleSelect(asset.id, e.shiftKey);
      return;
    }
    onOpen && onOpen(e);
  }

  function handleDragStart(e) {
    const ids = dragIds || [asset.id];
    e.dataTransfer.setData("application/picpop-assets", JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);

    // Custom ghost badge for multi-select
    if (ids.length > 1) {
      const el = document.createElement("div");
      el.textContent = `${ids.length} ×`;
      Object.assign(el.style, {
        position: "fixed", top: "-200px", left: 0,
        padding: "5px 14px", background: "#0a0a0a", color: "white",
        borderRadius: "20px", fontSize: "13px", fontWeight: "600",
        fontFamily: "Geist, sans-serif", letterSpacing: "-0.02em",
        whiteSpace: "nowrap", pointerEvents: "none",
      });
      document.body.appendChild(el);
      e.dataTransfer.setDragImage(el, 40, 18);
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
    }
  }

  return (
    <div
      className={"asset-tile" + (selected ? " selected" : "") + (selectable ? " selectable" : "") + (isDragging ? " dragging" : "")}
      onClick={clickTile}
      style={{ "--ar": asset.ratio }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setIsDragging(false)}
    >
      {asset.kind === "pdf"
        ? (asset.thumbnailUrl
            // Pre-generated JPEG thumbnail from upload — simple <img>, no CORS issues
            ? <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                <img src={asset.thumbnailUrl} draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            : asset.storageUrl
                ? <window.PdfThumbnail url={asset.storageUrl} hue={asset.hue} label={asset.format} />
                : <PHDark hue={asset.hue} label={asset.format} />)
        : <AssetImg asset={asset} w={600} />
      }
      <button className={"sel-check" + (selected ? " on" : "")} onClick={clickSel} aria-label="select" title="Select">
        {selected && <Icon.check size={12} />}
      </button>
      <button className={"fav-btn" + (fav ? " on" : "")} onClick={clickFav} aria-label="favorite" title={fav ? "Favorit" : "Zu Favoriten hinzufügen"}>
        <Icon.star size={13} fill={fav ? "currentColor" : "none"} />
      </button>
      {asset.kind === "pdf" && (
        <span style={{
          position: "absolute", bottom: 8, left: 8,
          fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
          letterSpacing: "0.10em", textTransform: "uppercase",
          padding: "3px 6px",
          background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(4px)",
          borderRadius: 3,
          pointerEvents: "none",
          lineHeight: 1,
        }}>PDF</span>
      )}
      {asset.embargo && (
        <span className="badge chip" style={{ background: "rgba(0,0,0,0.7)", color: "white", borderColor: "transparent", bottom: 32 }}>
          <Icon.lock size={10} /> {asset.embargo}
        </span>
      )}
      <div className="meta">
        <div className="clamp-1" style={{ fontWeight: 500, fontSize: 12 }}>{asset.title}</div>
        <div className="mono" style={{ opacity: 0.85, marginTop: 2 }}>
          {asset.kind === "pdf"
            ? `${asset.pages}p · ${asset.size}MB`
            : `${(asset.width/1000).toFixed(1)}K · ${asset.format}`
          }
        </div>
      </div>
    </div>
  );
}

// Toast
function Toast({ msg, onDone }) {
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(onDone, 2400);
    return () => clearTimeout(id);
  }, [msg]);
  if (!msg) return null;
  return <div className="toast"><Icon.check size={14} /> {msg}</div>;
}

// Modal shell
function Modal({ open, onClose, children, width = 720, padding = 0, overflow = "auto" }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={{ width, maxWidth: "92vw", maxHeight: "92vh", overflow, padding }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// Section header for grids
function SectionHeader({ eyebrow, title, right, sub }) {
  return (
    <div className="row" style={{ alignItems: "end", justifyContent: "space-between", marginBottom: 16, gap: 16 }}>
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
        <div className="h-2">{title}</div>
        {sub && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

// Empty state
function Empty({ icon: I = Icon.inbox, title, hint, action }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted)" }}>
      <I size={28} />
      <div className="h-3" style={{ marginTop: 12, color: "var(--fg)" }}>{title}</div>
      {hint && <div style={{ marginTop: 4 }}>{hint}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

// Bulk action bar — with inline tag / author / move pickers
function BulkBar({ count, onClear, lang, onFavorite, onUnfavorite, onShare, onDelete, allFavorited, onApplyTag, onApplyAuthor, onMoveToFolder, folders }) {
  const t = makeT(lang);
  const [panel, setPanel] = useState(null);
  const toggle = (name) => setPanel(p => p === name ? null : name);

  return (
    <div style={{ position: "relative", marginBottom: 16 }}>
      <div className="bulkbar" style={{ marginBottom: 0 }}>
        <button className="btn icon sm" onClick={() => { onClear(); setPanel(null); }} title={t("deselect_all")}><Icon.x size={14} /></button>
        <span style={{ fontWeight: 500, fontSize: 13 }}>
          {count === 1 ? t("items_selected_one") : t("items_selected_other", { n: count })}
        </span>
        <div className="divider" />
        <button className="btn sm" onClick={allFavorited ? onUnfavorite : onFavorite}>
          <Icon.star size={13} fill={allFavorited ? "currentColor" : "none"} />
          {allFavorited ? t("bulk_unfavorite") : t("bulk_favorite")}
        </button>
        <button className="btn sm" onClick={onShare}><Icon.share size={13} /> {t("bulk_share")}</button>
        <button className={"btn sm" + (panel === "tag" ? " primary" : "")} onClick={() => toggle("tag")}>
          <Icon.tag size={13} /> {t("bulk_tag")}
        </button>
        <button className={"btn sm" + (panel === "author" ? " primary" : "")} onClick={() => toggle("author")}>
          <Icon.user size={13} /> {t("bulk_author")}
        </button>
        <button className={"btn sm" + (panel === "move" ? " primary" : "")} onClick={() => toggle("move")}>
          <Icon.folder size={13} /> {t("bulk_move")}
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn sm" style={{ color: "var(--accent)" }} onClick={() => { onDelete(); setPanel(null); }}>
          <Icon.trash size={13} /> {t("bulk_delete")}
        </button>
      </div>

      {/* Picker panels */}
      {panel && (
        <div className="card" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 60, padding: 16, boxShadow: "var(--shadow)" }}>
          {panel === "tag" && (
            <>
              <div className="eyebrow" style={{ marginBottom: 10 }}>{lang === "de" ? "Tag zu Auswahl hinzufügen" : "Add tag to selection"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {window.TAGS.map(tg => (
                  <span key={tg.id} className="chip" style={{ cursor: "pointer", background: tagBg(tg), color: tagColor(tg), borderColor: "transparent" }}
                    onClick={() => { onApplyTag?.(tg.id); setPanel(null); }}>
                    <span className="tag-dot" style={{ background: tagColor(tg) }} />
                    {tagLabel(tg, lang)}
                  </span>
                ))}
                {window.TAGS.length === 0 && <span style={{ color: "var(--muted)", fontSize: 13 }}>—</span>}
              </div>
            </>
          )}

          {panel === "author" && (
            <>
              <div className="eyebrow" style={{ marginBottom: 10 }}>{lang === "de" ? "Urheber der Auswahl setzen" : "Set author of selection"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {window.TEAM.map(u => (
                  <span key={u.id} className="chip" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px" }}
                    onClick={() => { onApplyAuthor?.(u); setPanel(null); }}>
                    <Avatar user={u} size={18} />
                    <span style={{ fontWeight: 500 }}>{u.name.split(" ")[0]}</span>
                    <span style={{ color: "var(--muted)", fontSize: 11 }}>{u.dept}</span>
                  </span>
                ))}
              </div>
            </>
          )}

          {panel === "move" && (
            <>
              <div className="eyebrow" style={{ marginBottom: 10 }}>{lang === "de" ? "Auswahl verschieben nach" : "Move selection to"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(folders || window.FOLDERS).map(f => (
                  <span key={f.id} className="chip" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                    onClick={() => { onMoveToFolder?.(f.id); setPanel(null); }}>
                    <Icon.folder size={12} />
                    {f.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  useT, useLang, makeT, LangCtx, FavCtx, useFav, Icon, Ic,
  fmtRel, fmtDate, userById, tagById, folderById, tagLabel, tagColor, tagBg,
  PH, PHDark, imgUrl, AssetImg, Avatar, AvatarStack, TagPill,
  FolderTile, AssetTile, Toast, Modal, SectionHeader, Empty, BulkBar,
  useThumbSize, ThumbSizeSlider,
});
