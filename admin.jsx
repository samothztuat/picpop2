// Admin-Bereich — Mandanten- und Benutzerverwaltung (nur für tomtautz@gmail.com)

const { useState: useStateAdm, useEffect: useEffectAdm, useRef: useRefAdm } = React;

const ADMIN_API_KEY    = "AIzaSyBXnMXIhhaI3G3kvYfgRpceUy1k9oJ4cXs";
const SUPERADMIN_EMAIL = "tomtautz@gmail.com";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Firmennamen zu Tenant-ID slugifizieren
// "Phæno Wolfsburg" → "phaeno-wolfsburg", "T.E. Systems GmbH" → "te-systems-gmbh"
function slugify(name) {
  return name.trim()
    .toLowerCase()
    .replace(/[äàáâã]/g, "a").replace(/[öòóôõ]/g, "o").replace(/[üùúû]/g, "u")
    .replace(/æ/g, "ae").replace(/ø/g, "o").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function adminCreateAuthUser(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${ADMIN_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { uid: data.localId, email: data.email };
}

async function adminSeedTenant(tenantId, companyName) {
  const col = (name) => window.db.collection("tenants").doc(tenantId).collection(name);
  await window.db.doc(`tenants/${tenantId}/settings/global`).set({
    companyName,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    llmProviderKeys: {},
    aiPrompt: window.AI_DEFAULT_PROMPT || "",
  });
  await col("folders").doc("f-unsorted").set({
    id: "f-unsorted", name: "Nicht zugeordnet", parent: null, count: 0,
    pinned: false, sortOrder: 9999, updated: new Date().toISOString().slice(0, 10),
    coverHues: [200, 220, 240, 260], owner: "system",
  });
  await col("pdfFolders").doc("p-unsorted").set({
    id: "p-unsorted", name: "Nicht zugeordnet", parent: null, count: 0,
    pinned: false, sortOrder: 9999, updated: new Date().toISOString().slice(0, 10),
    coverHues: [200, 220, 240, 260], owner: "system",
  });
}

function fmtDate(raw) {
  if (!raw) return "—";
  const d = raw.toDate ? raw.toDate() : new Date(raw);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── TenantDetail ──────────────────────────────────────────────────────────────
function TenantDetail({ tenant, onRefresh }) {
  const [users,        setUsers]        = useStateAdm([]);
  const [loadingUsers, setLoadingUsers] = useStateAdm(true);
  const [showNewUser,  setShowNewUser]  = useStateAdm(false);
  const [nuEmail,      setNuEmail]      = useStateAdm("");
  const [nuPassword,   setNuPassword]   = useStateAdm("");
  const [nuCreating,   setNuCreating]   = useStateAdm(false);
  const [nuMsg,        setNuMsg]        = useStateAdm(null);
  const [showPw,       setShowPw]       = useStateAdm(false);
  const [deletingUid,  setDeletingUid]  = useStateAdm(null);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const snap = await window.db.collection("tenants").doc(tenant.id).collection("users").get();
      setUsers(snap.docs.map(d => d.data()).sort((a, b) => a.email.localeCompare(b.email)));
    } catch (_) {}
    setLoadingUsers(false);
  }

  useEffectAdm(() => {
    setUsers([]); setShowNewUser(false); setNuMsg(null); setDeletingUid(null);
    loadUsers();
  }, [tenant.id]);

  async function handleCreateUser(e) {
    e.preventDefault();
    setNuCreating(true); setNuMsg(null);
    try {
      const { uid, email } = await adminCreateAuthUser(nuEmail.trim(), nuPassword);
      await window.db.collection("tenants").doc(tenant.id).collection("users").doc(uid).set({
        uid, email, role: "editor",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      await window.db.collection("userTenants").doc(uid).set({ tenantId: tenant.id, email });
      setNuMsg({ ok: true, text: `✓ ${email} angelegt` });
      setNuEmail(""); setNuPassword(""); setShowNewUser(false);
      await loadUsers(); onRefresh();
    } catch (err) {
      setNuMsg({ ok: false, text: err.message });
    } finally {
      setNuCreating(false);
    }
  }

  async function handleRemoveUser(u) {
    if (!window.confirm(`Nutzer ${u.email} wirklich aus diesem Workspace entfernen?\n\nDer Firebase Auth Account bleibt bestehen.`)) return;
    setDeletingUid(u.uid);
    try {
      await window.db.collection("tenants").doc(tenant.id).collection("users").doc(u.uid).delete();
      await window.db.collection("userTenants").doc(u.uid).delete().catch(() => {});
      await loadUsers(); onRefresh();
    } finally {
      setDeletingUid(null);
    }
  }

  function viewAsTenant() {
    sessionStorage.setItem("picpop_admin_impersonate", "1");
    const base = window.location.origin + window.location.pathname;
    window.location.href = `${base}?t=${tenant.id}`;
  }

  const inp = {
    height: 34, padding: "0 10px", border: "1px solid var(--line-strong)",
    borderRadius: 3, background: "var(--bg)", color: "var(--fg)",
    fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "var(--font-sans)",
  };

  return (
    <div style={{ padding: "36px 44px", maxWidth: 860 }}>

      {/* Breadcrumb */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
        Kunden · {tenant.id}
      </div>

      {/* Heading */}
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 4 }}>
        {tenant.name}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 32 }}>
        Erstellt: {fmtDate(tenant.createdAt)}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, marginBottom: 44, flexWrap: "wrap" }}>
        <button onClick={viewAsTenant} className="btn accent" style={{ gap: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          Als Mandant anzeigen →
        </button>
        <button onClick={() => window.open(`${window.location.origin}${window.location.pathname}?t=${tenant.id}`, "_blank")} className="btn">
          In neuem Tab ↗
        </button>
      </div>

      {/* ── Benutzer ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
          Benutzer ({users.length})
        </div>
        <button className="btn sm" onClick={() => { setShowNewUser(v => !v); setNuMsg(null); }}>
          + Neuer Benutzer
        </button>
      </div>

      {/* New user form */}
      {showNewUser && (
        <form onSubmit={handleCreateUser} style={{ background: "var(--panel)", border: "1px solid var(--line-strong)", borderRadius: 4, padding: "14px 16px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 5 }}>E-Mail</div>
              <input type="email" value={nuEmail} onChange={e => setNuEmail(e.target.value)} required
                placeholder="nutzer@firma.de" autoComplete="off" style={{ ...inp, width: "100%" }} />
            </div>
            <div style={{ flex: "0 0 200px" }}>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 5 }}>Passwort</div>
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} value={nuPassword} onChange={e => setNuPassword(e.target.value)}
                  required placeholder="mind. 6 Zeichen" autoComplete="new-password"
                  style={{ ...inp, width: "100%", paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0 }}>
                  {showPw
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
            <button type="submit" disabled={nuCreating} className="btn primary sm" style={{ height: 34, flexShrink: 0 }}>
              {nuCreating ? "…" : "Anlegen"}
            </button>
            <button type="button" onClick={() => setShowNewUser(false)} className="btn ghost sm" style={{ height: 34, flexShrink: 0 }}>Abbrechen</button>
          </div>
          {nuMsg && (
            <div style={{ fontSize: 12, padding: "7px 10px", borderRadius: 3, background: nuMsg.ok ? "oklch(0.95 0.04 145)" : "var(--accent-soft)", color: nuMsg.ok ? "oklch(0.35 0.14 145)" : "var(--accent)" }}>
              {nuMsg.text}
            </div>
          )}
        </form>
      )}

      {nuMsg && !showNewUser && (
        <div style={{ fontSize: 12, padding: "8px 12px", borderRadius: 4, marginBottom: 12, background: nuMsg.ok ? "oklch(0.95 0.04 145)" : "var(--accent-soft)", color: nuMsg.ok ? "oklch(0.35 0.14 145)" : "var(--accent)" }}>
          {nuMsg.text}
        </div>
      )}

      {/* User list */}
      <div style={{ border: "1px solid var(--line)", borderRadius: 4, overflow: "hidden", background: "var(--panel)" }}>
        {loadingUsers ? (
          <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
            <div style={{ width: 18, height: 18, border: "2px solid var(--line-strong)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: "18px 16px", color: "var(--muted)", fontSize: 12 }}>
            Keine Benutzer. Lege einen Nutzer an.
          </div>
        ) : users.map((u, i) => (
          <div key={u.uid} style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderBottom: i < users.length - 1 ? "1px solid var(--line)" : "none", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--hover)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "var(--muted)", flexShrink: 0 }}>
              {(u.email || "?")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }} className="clamp-1">{u.displayName || u.email}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{u.email}</div>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 3, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", background: "var(--hover)", color: "var(--fg-2)", border: "1px solid var(--line)", flexShrink: 0 }}>
              {u.role || "editor"}
            </span>
            <button className="btn ghost sm" style={{ flexShrink: 0, color: "var(--accent)" }}
              onClick={() => handleRemoveUser(u)} disabled={deletingUid === u.uid}>
              {deletingUid === u.uid ? "…" : "×"}
            </button>
          </div>
        ))}
      </div>

      {/* Login-URL hint */}
      <div style={{ marginTop: 28, padding: "12px 16px", background: "var(--hover)", borderRadius: 4, fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
        <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>Login-URL:</span>&emsp;
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}>
          {window.location.origin}{window.location.pathname}?t={tenant.id}
        </span>
        &emsp;·&emsp;
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}>{tenant.id}.picpop.de</span>
      </div>
    </div>
  );
}

// ── AdminView ─────────────────────────────────────────────────────────────────
function AdminView({ lang }) {
  const [tenants,   setTenants]   = useStateAdm([]);
  const [loading,   setLoading]   = useStateAdm(true);
  const [selectedId,setSelectedId]= useStateAdm(null);
  const [search,    setSearch]    = useStateAdm("");
  const [newName,   setNewName]   = useStateAdm("");
  const [creating,  setCreating]  = useStateAdm(false);
  const [createMsg, setCreateMsg] = useStateAdm(null);
  const newId = slugify(newName);

  async function loadTenants() {
    setLoading(true);
    try {
      const snap = await window.db.collection("tenants").get();
      const list = await Promise.all(snap.docs.map(async d => {
        let name = d.id, createdAt = null, userCount = 0;
        try {
          const s = await window.db.doc(`tenants/${d.id}/settings/global`).get();
          if (s.exists) { const sd = s.data(); name = sd.companyName || d.id; createdAt = sd.createdAt; }
          userCount = (await window.db.collection("tenants").doc(d.id).collection("users").get()).size;
        } catch (_) {}
        return { id: d.id, name, createdAt, userCount };
      }));
      list.sort((a, b) => a.id.localeCompare(b.id));
      setTenants(list);
    } catch (e) { console.error("loadTenants", e); }
    setLoading(false);
  }

  useEffectAdm(() => { loadTenants(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const id   = newId;
    const name = newName.trim();
    if (!id || !name) return;
    setCreating(true); setCreateMsg(null);
    try {
      const exists = await window.db.doc(`tenants/${id}/settings/global`).get();
      if (exists.exists) throw new Error(`„${id}" existiert bereits`);
      await adminSeedTenant(id, name);
      setCreateMsg({ ok: true, text: `✓ „${id}" angelegt` });
      setNewId(""); setNewName("");
      await loadTenants();
      setSelectedId(id);
      setTimeout(() => setCreateMsg(null), 3000);
    } catch (err) {
      setCreateMsg({ ok: false, text: err.message });
    } finally {
      setCreating(false);
    }
  }

  const filtered = tenants.filter(t =>
    t.id.toLowerCase().includes(search.toLowerCase()) ||
    t.name.toLowerCase().includes(search.toLowerCase())
  );
  const selected = tenants.find(t => t.id === selectedId);

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* ── Left panel ── */}
      <div style={{ width: 276, flexShrink: 0, borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", background: "var(--panel)" }}>

        <div style={{ padding: "22px 18px 16px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>System</div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", marginBottom: 3 }}>Admin</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Mandanten- und Benutzerverwaltung</div>
        </div>

        {/* Create form */}
        <form onSubmit={handleCreate} style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 7 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Firmenname…" autoComplete="off"
            style={{ height: 30, padding: "0 9px", border: "1px solid var(--line-strong)", borderRadius: 3, background: "var(--bg)", color: "var(--fg)", fontSize: 12, outline: "none" }}
          />
          {newName && (
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", padding: "2px 2px" }}>
              ID: <span style={{ color: "var(--fg-2)" }}>{newId}</span>
            </div>
          )}
          <button type="submit" disabled={creating || !newId}
            style={{ height: 30, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 3, cursor: !newId ? "default" : "pointer", fontSize: 12, fontWeight: 600, opacity: !newId ? 0.35 : 1, transition: "opacity .15s" }}>
            {creating ? "Anlegen…" : "+ Anlegen"}
          </button>
          {createMsg && (
            <div style={{ fontSize: 11, padding: "5px 8px", borderRadius: 3, background: createMsg.ok ? "oklch(0.95 0.04 145)" : "var(--accent-soft)", color: createMsg.ok ? "oklch(0.35 0.14 145)" : "var(--accent)" }}>
              {createMsg.text}
            </div>
          )}
        </form>

        {/* Search */}
        <div style={{ padding: "12px 18px 8px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
            Kunden ({tenants.length})
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…"
            style={{ width: "100%", height: 28, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 3, background: "var(--hover)", color: "var(--fg)", fontSize: 12, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* List */}
        <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
              <div style={{ width: 18, height: 18, border: "2px solid var(--line-strong)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "14px 18px", color: "var(--muted)", fontSize: 12 }}>Keine Mandanten.</div>
          ) : filtered.map(t => (
            <div key={t.id} onClick={() => setSelectedId(t.id)}
              style={{ padding: "9px 18px", cursor: "pointer", borderLeft: `2px solid ${t.id === selectedId ? "var(--accent)" : "transparent"}`, background: t.id === selectedId ? "var(--hover)" : "transparent", transition: "background .1s" }}
              onMouseEnter={e => { if (t.id !== selectedId) e.currentTarget.style.background = "var(--hover)"; }}
              onMouseLeave={e => { if (t.id !== selectedId) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ fontSize: 13, fontWeight: t.id === selectedId ? 600 : 400, lineHeight: 1.3 }}>{t.name}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.id}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="scroll" style={{ flex: 1, minWidth: 0, background: "var(--bg)", overflowY: "auto" }}>
        {selected
          ? <TenantDetail tenant={selected} onRefresh={loadTenants} lang={lang} />
          : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13, fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>Kunden auswählen</div>
        }
      </div>
    </div>
  );
}

// ── ImpersonationBanner ───────────────────────────────────────────────────────
function ImpersonationBanner({ tenantId }) {
  function stop() {
    sessionStorage.removeItem("picpop_admin_impersonate");
    window.location.href = window.location.origin + window.location.pathname;
  }
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, height: 36, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", paddingLeft: 20, paddingRight: 12, gap: 10, fontSize: 12, letterSpacing: "0.01em", boxShadow: "0 2px 10px rgba(0,0,0,0.25)" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.75 }}>Superadmin</span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span>Ansicht als Mandant: <strong>{tenantId}</strong></span>
      <div style={{ flex: 1 }} />
      <button onClick={stop}
        style={{ height: 26, padding: "0 14px", background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 3, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.3)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}>
        Beenden
      </button>
    </div>
  );
}

function isImpersonating() {
  return sessionStorage.getItem("picpop_admin_impersonate") === "1"
    && window.CURRENT_USER?.email === SUPERADMIN_EMAIL
    && !!new URLSearchParams(window.location.search).get("t");
}

Object.assign(window, { AdminView, ImpersonationBanner, isImpersonating, SUPERADMIN_EMAIL });
