// Rechte-Simulation „Als User anzeigen" (nur Superadmin).
// Der Superadmin wählt ein Konto → die App wendet clientseitig die effektiven
// Rechte dieses Users an (aus seinen Gruppen berechnet): welche Bereiche er
// sehen/verwalten darf und welche Module sichtbar sind. So lässt sich testen,
// was ein Nutzer sieht und tun kann — ohne sich abzumelden.
// Exponiert window.pp* Helfer, window.ViewAsBanner, window.usePpViewAs.

(function () {
  const { useState, useEffect } = React;
  const KEY = "picpop.viewAs";
  const EVT = "pp:viewas";
  const RANG = { kein: 0, lesen: 1, verwalten: 2 };

  // ── Zustand (in sessionStorage, überlebt Reloads innerhalb der Sitzung) ──
  function load() {
    try { const s = sessionStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (_) { return null; }
  }
  let _viewAs = load();

  function ppViewAs() { return _viewAs; }
  function ppSetViewAs(identity) {
    _viewAs = identity || null;
    try { identity ? sessionStorage.setItem(KEY, JSON.stringify(identity)) : sessionStorage.removeItem(KEY); } catch (_) {}
    window.dispatchEvent(new CustomEvent(EVT, { detail: _viewAs }));
  }
  function ppClearViewAs() { ppSetViewAs(null); }

  // ── Rechte-Auskünfte ──
  // Ohne Simulation (echter Superadmin) → Allmacht: sieht/darf alles.
  function ppAllmacht() { return !_viewAs || !!_viewAs.allmacht; }
  function ppCanRead(bereich) {
    if (ppAllmacht()) return true;
    if (bereich == null || bereich === "") return true;           // bereichfreie Inhalte offen
    const st = (_viewAs.rechte || {})[bereich];
    return st === "lesen" || st === "verwalten";
  }
  function ppCanWrite(bereich) {
    if (ppAllmacht()) return true;
    if (bereich == null || bereich === "") return true;
    return (_viewAs.rechte || {})[bereich] === "verwalten";
  }
  // Hat der simulierte User irgendwo Verwalten-Rechte? (grobe „darf bearbeiten"-Frage)
  function ppHasAnyWrite() {
    if (ppAllmacht()) return true;
    return Object.values(_viewAs.rechte || {}).some(s => s === "verwalten");
  }
  // Rein lesender Nutzer (nichts zu verwalten) → UI in Nur-Ansicht schalten.
  function ppIsViewer() { return !!_viewAs && !_viewAs.allmacht && !ppHasAnyWrite(); }
  function ppModuleAllowed(modId) {
    if (ppAllmacht()) return true;
    const mods = _viewAs.module || [];
    return mods.length === 0 || mods.includes(modId);
  }

  // ── Filter-Helfer für Inhaltslisten ──
  function ppFilterAssets(list) {
    if (ppAllmacht()) return list || [];
    return (list || []).filter(a => ppCanRead(a.bereichEff != null ? a.bereichEff : a.bereichId));
  }
  function ppFilterFolders(list) {
    if (ppAllmacht()) return list || [];
    return (list || []).filter(f => ppCanRead(f.bereichId));
  }

  // Effektive Rechte eines Users aus Rolle + Gruppen berechnen (Client-Spiegel
  // der Cloud-Function-Logik: höchste Stufe gewinnt, „kein“ = nicht eingetragen).
  function ppComputeIdentity(user, groups) {
    if (!user) return null;
    if (user.role === "admin") {
      return { uid: user.uid, name: user.displayName || user.email, email: user.email, role: "admin", allmacht: true, rechte: {}, module: [] };
    }
    const rechte = {};
    const mods = new Set();
    let hasModuleLimit = false;
    for (const gid of user.groupIds || []) {
      const g = (groups || []).find(x => x.id === gid);
      if (!g) continue;
      for (const [bid, st] of Object.entries(g.rechte || {})) {
        if ((RANG[st] || 0) > (RANG[rechte[bid]] || 0)) rechte[bid] = st;
      }
      if (g.module && g.module.length) { hasModuleLimit = true; g.module.forEach(m => mods.add(m)); }
    }
    for (const k of Object.keys(rechte)) if (rechte[k] === "kein") delete rechte[k];
    return {
      uid: user.uid, name: user.displayName || user.email, email: user.email, role: "member",
      allmacht: false, rechte, module: hasModuleLimit ? [...mods] : [],
    };
  }

  // ── React-Hook: erzwingt Re-Render bei Wechsel des Simulations-Zustands ──
  function usePpViewAs() {
    const [v, setV] = useState(_viewAs);
    useEffect(() => {
      const h = (e) => setV(e.detail);
      window.addEventListener(EVT, h);
      return () => window.removeEventListener(EVT, h);
    }, []);
    return v;
  }

  // ── Banner ──
  function ViewAsBanner({ lang = "de" }) {
    const v = usePpViewAs();
    if (!v) return null;
    const label = v.allmacht
      ? (lang === "de" ? "Admin — sieht alles" : "Admin — sees everything")
      : (v.rechte && Object.keys(v.rechte).length
          ? Object.entries(v.rechte).map(([b, s]) => `${b}:${s}`).join(" · ")
          : (lang === "de" ? "keine Bereichsrechte (nur bereichfreie Inhalte)" : "no area rights"));
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        padding: "8px 16px", background: "oklch(55% 0.16 265)", color: "#fff",
        fontSize: 13, fontWeight: 500,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85 }}>Ansicht als</span>
        <strong>{v.name}</strong>
        <span style={{ opacity: 0.85, fontSize: 12 }}>{v.role === "admin" ? "Admin" : "Benutzer"}{v.allmacht ? "" : " · " + label}</span>
        <button onClick={() => ppClearViewAs()}
          style={{ marginLeft: "auto", background: "rgba(255,255,255,0.18)", color: "#fff", border: "none", borderRadius: 4, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          {lang === "de" ? "Ansicht beenden" : "Exit view"}
        </button>
      </div>
    );
  }

  Object.assign(window, {
    ppViewAs, ppSetViewAs, ppClearViewAs,
    ppAllmacht, ppCanRead, ppCanWrite, ppHasAnyWrite, ppIsViewer, ppModuleAllowed,
    ppFilterAssets, ppFilterFolders, ppComputeIdentity,
    usePpViewAs, ViewAsBanner,
  });
})();
