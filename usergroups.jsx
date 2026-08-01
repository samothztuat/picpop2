// Nutzergruppen & Bereiche — Admin-Panel (Rechtesystem, portiert aus contextr).
// Verwaltet pro Mandant: Bereiche (Scopes), Gruppen (inkl. Entra-CSV-Import),
// Rechte je Gruppe×Bereich, sowie Rolle & Gruppen-Zuordnung der Konten.
// Exponiert window.UserGroupsPanel.

(function () {
  const { useState, useEffect, useRef } = React;

  const STUFEN = ["kein", "lesen", "verwalten"];
  const STUFE_LABEL = { kein: "kein", lesen: "lesen", verwalten: "verwalten" };
  // Optionale App-Module (leer = alle sichtbar). Für picpop:
  const MODULE = [
    { id: "bilder", label: "Bilder" },
    { id: "print", label: "Print" },
    { id: "tags", label: "Tags" },
    { id: "teilen", label: "Teilen" },
  ];

  function eyebrow(txt) {
    return React.createElement("div", { className: "eyebrow", style: { marginBottom: 10 } }, txt);
  }

  function UserGroupsPanel({ lang = "de" }) {
    const [bereiche, setBereiche] = useState([]);
    const [groups, setGroups] = useState([]);
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [openGroup, setOpenGroup] = useState(null);
    const [busy, setBusy] = useState("");
    const [toast, setToast] = useState("");
    const [newBereich, setNewBereich] = useState("");
    const [newGroup, setNewGroup] = useState("");
    const [purgeConfirm, setPurgeConfirm] = useState("");
    const fileRef = useRef(null);
    const isSuper = window.CURRENT_USER?.email === window.SUPERADMIN_EMAIL;
    const bereicheRef = useRef([]); // immer die zuletzt gespeicherte Liste (gegen Stale-State)

    useEffect(() => {
      const u1 = window.subscribeToBereiche(list => { bereicheRef.current = list; setBereiche(list); });
      const u2 = window.subscribeToGroups(setGroups);
      loadUsers();
      return () => { u1 && u1(); u2 && u2(); };
    }, []);

    function flash(m) { setToast(m); setTimeout(() => setToast(""), 3500); }

    async function loadUsers() {
      setUsersLoading(true);
      try { setUsers(await window.fnListTenantUsers()); }
      catch (e) { flash("Konten konnten nicht geladen werden: " + (e.message || e)); }
      setUsersLoading(false);
    }

    // ── Bereiche ───────────────────────────────────────────────────────────
    async function addBereich(rawName) {
      const name = (rawName || "").trim();
      if (!name) return;
      const id = "b-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const next = [...bereicheRef.current, { id, name }];
      try {
        await window.dbSaveBereiche(next);
        bereicheRef.current = next; setBereiche(next); // sofort sichtbar, auch ohne Snapshot
        setNewBereich("");
      } catch (e) {
        flash("Bereich konnte nicht gespeichert werden: " + (e.code || e.message || e));
      }
    }
    async function delBereich(id) {
      if (!confirm("Bereich löschen? Rechte auf diesen Bereich gehen verloren.")) return;
      const next = bereicheRef.current.filter(b => b.id !== id);
      try {
        await window.dbSaveBereiche(next);
        bereicheRef.current = next; setBereiche(next);
      } catch (e) {
        flash("Löschen fehlgeschlagen: " + (e.code || e.message || e));
      }
    }

    // ── Gruppen ────────────────────────────────────────────────────────────
    async function addGroup(rawName) {
      const name = (rawName || "").trim();
      if (!name) return;
      try {
        await window.dbSaveGroup({ name, quelle: "manuell", rechte: {}, module: [] });
        setNewGroup("");
      } catch (e) {
        flash("Gruppe konnte nicht gespeichert werden: " + (e.code || e.message || e));
      }
    }
    async function delGroup(id) {
      if (!confirm("Gruppe löschen? Zuordnungen der Konten bleiben, verlieren aber ihre Wirkung.")) return;
      await window.dbDeleteGroup(id);
    }
    async function setGroupRecht(g, bereichId, stufe) {
      const rechte = { ...(g.rechte || {}) };
      if (stufe === "kein") delete rechte[bereichId]; else rechte[bereichId] = stufe;
      await window.dbSaveGroup({ ...g, rechte });
    }
    async function toggleGroupModul(g, modId) {
      const cur = new Set(g.module || []);
      cur.has(modId) ? cur.delete(modId) : cur.add(modId);
      await window.dbSaveGroup({ ...g, module: [...cur] });
    }

    async function onCsv(e) {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setBusy("csv");
      try {
        const text = await file.text();
        const parsed = window.parseGroupsCsv(text, window.TENANT_ID);
        if (!parsed.length) { flash("Keine Gruppen erkannt — Spalten 'displayName' und 'id' nötig."); setBusy(""); return; }
        let created = 0, updated = 0;
        for (const p of parsed) {
          const match = groups.find(g =>
            (p.externalId && g.externalId === p.externalId) ||
            (p.externalName && g.externalName === p.externalName));
          if (match) { await window.dbSaveGroup({ ...match, externalId: p.externalId, externalName: p.externalName, quelle: "csv" }); updated++; }
          else { await window.dbSaveGroup({ name: p.name, externalName: p.externalName, externalId: p.externalId, quelle: "csv", rechte: {}, module: [] }); created++; }
        }
        flash(`${created} neu, ${updated} aktualisiert.`);
      } catch (err) { flash("Import fehlgeschlagen: " + (err.message || err)); }
      setBusy("");
    }

    // ── Konten ─────────────────────────────────────────────────────────────
    async function changeRole(u, role) {
      setBusy("u-" + u.uid);
      try { await window.fnSetUserRole(u.uid, role); setUsers(us => us.map(x => x.uid === u.uid ? { ...x, role } : x)); }
      catch (e) { flash("Fehler: " + (e.message || e)); }
      setBusy("");
    }
    async function toggleUserGroup(u, gid) {
      const cur = new Set(u.groupIds || []);
      cur.has(gid) ? cur.delete(gid) : cur.add(gid);
      const next = [...cur];
      setBusy("u-" + u.uid);
      try { await window.fnSetUserGroups(u.uid, next); setUsers(us => us.map(x => x.uid === u.uid ? { ...x, groupIds: next } : x)); }
      catch (e) { flash("Fehler: " + (e.message || e)); }
      setBusy("");
    }
    async function refreshClaims() {
      setBusy("claims");
      try { const r = await window.fnRefreshTenantClaims(); flash(`Claims neu berechnet: ${r.done}/${r.total} (${r.errors} Fehler).`); }
      catch (e) { flash("Fehler: " + (e.message || e)); }
      setBusy("");
    }
    async function purgeUsers() {
      const tid = window.TENANT_ID;
      if (purgeConfirm !== tid) { flash(`Bitte exakt '${tid}' eintippen, um zu bestätigen.`); return; }
      setBusy("purge");
      try {
        const r = await window.fnPurgeTenantUsers(tid, purgeConfirm);
        flash(`Gelöscht: ${r.deleted} · übersprungen: ${r.skipped} · Fehler: ${r.errors} (von ${r.total}).`);
        setPurgeConfirm("");
        await loadUsers();
      } catch (e) { flash("Löschen fehlgeschlagen: " + (e.code || e.message || e)); }
      setBusy("");
    }

    const h = React.createElement;
    const cardStyle = { border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel)", padding: 16, marginBottom: 20 };
    const groupName = gid => groups.find(g => g.id === gid)?.name || "?";

    return h("div", { style: { maxWidth: 860 } },
      toast && h("div", { style: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "var(--fg)", color: "var(--bg)", padding: "8px 16px", borderRadius: 6, fontSize: 13, zIndex: 100 } }, toast),

      // Info
      h("div", { style: { fontSize: 12, color: "var(--muted)", lineHeight: 1.7, marginBottom: 20, padding: "10px 14px", background: "var(--hover)", borderRadius: 6 } },
        "Mandant: ", h("b", null, window.TENANT_ID), ". Bereiche gliedern die Inhalte, Gruppen vergeben je Bereich Rechte (kein/lesen/verwalten), Konten werden Gruppen zugeordnet. ",
        "Nach Änderungen an Gruppen/Rollen werden die Zugriffs-Claims automatisch neu berechnet."),

      // ── Bereiche ──
      h("div", { style: cardStyle },
        h("div", { style: { marginBottom: 12 } }, eyebrow("Bereiche")),
        bereiche.length === 0
          ? h("div", { style: { fontSize: 13, color: "var(--muted)", fontStyle: "italic", marginBottom: 12 } }, "Noch keine Bereiche. Beispiel phaeno: 'Kommunikation', 'Exponattexte'.")
          : h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 } },
              bereiche.map(b => h("span", { key: b.id, className: "chip" }, b.name,
                h("span", { className: "x", onClick: () => delBereich(b.id), style: { cursor: "pointer", marginLeft: 6 } }, "×")))),
        // Inline-Eingabe (kein prompt() → keine Browser-Dialog-Sperre)
        h("div", { style: { display: "flex", gap: 8 } },
          h("input", {
            value: newBereich,
            onChange: e => setNewBereich(e.target.value),
            onKeyDown: e => { if (e.key === "Enter") { e.preventDefault(); addBereich(newBereich); } },
            placeholder: "Neuer Bereich…",
            style: { flex: 1, maxWidth: 260, height: 30, padding: "0 10px", border: "1px solid var(--line-strong)", borderRadius: 4, background: "var(--bg)", color: "var(--fg)", fontSize: 13, outline: "none" },
          }),
          h("button", { className: "btn sm primary", disabled: !newBereich.trim(), onClick: () => addBereich(newBereich) }, "+ Hinzufügen"))),

      // ── Gruppen ──
      h("div", { style: cardStyle },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } },
          eyebrow("Gruppen"),
          h("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
            h("input", {
              value: newGroup,
              onChange: e => setNewGroup(e.target.value),
              onKeyDown: e => { if (e.key === "Enter") { e.preventDefault(); addGroup(newGroup); } },
              placeholder: "Neue Gruppe…",
              style: { width: 160, height: 30, padding: "0 10px", border: "1px solid var(--line-strong)", borderRadius: 4, background: "var(--bg)", color: "var(--fg)", fontSize: 13, outline: "none" },
            }),
            h("button", { className: "btn sm", disabled: !newGroup.trim(), onClick: () => addGroup(newGroup) }, "+ Gruppe"),
            h("button", { className: "btn sm", disabled: busy === "csv", onClick: () => fileRef.current?.click() }, busy === "csv" ? "…" : "CSV-Import (Entra)"),
            h("input", { ref: fileRef, type: "file", accept: ".csv,text/csv", style: { display: "none" }, onChange: onCsv }))),
        groups.length === 0
          ? h("div", { style: { fontSize: 13, color: "var(--muted)", fontStyle: "italic" } }, "Noch keine Gruppen. Entra-CSV importieren (Spalten displayName;id) oder manuell anlegen.")
          : groups.map(g => h("div", { key: g.id, style: { borderTop: "1px solid var(--line)", padding: "10px 0" } },
              h("div", { style: { display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }, onClick: () => setOpenGroup(openGroup === g.id ? null : g.id) },
                h("span", { style: { fontWeight: 600, fontSize: 14 } }, g.name),
                g.quelle === "csv" && h("span", { className: "chip", style: { fontSize: 10 } }, "Entra"),
                g.externalName && h("span", { style: { fontSize: 11, color: "var(--faint)", fontFamily: "var(--font-mono)" } }, g.externalName),
                h("span", { style: { marginLeft: "auto", color: "var(--muted)", fontSize: 12 } }, openGroup === g.id ? "▾" : "▸"),
                h("button", { className: "btn icon ghost sm", onClick: (e) => { e.stopPropagation(); delGroup(g.id); }, title: "Löschen" }, "×")),
              openGroup === g.id && h("div", { style: { padding: "12px 0 4px", marginLeft: 4 } },
                h("div", { style: { fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 } }, "Rechte je Bereich"),
                bereiche.length === 0
                  ? h("div", { style: { fontSize: 12, color: "var(--faint)" } }, "Erst Bereiche anlegen.")
                  : bereiche.map(b => h("div", { key: b.id, style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 } },
                      h("span", { style: { width: 160, fontSize: 13 } }, b.name),
                      h("div", { style: { display: "flex", gap: 4 } },
                        STUFEN.map(s => {
                          const active = (g.rechte?.[b.id] || "kein") === s;
                          return h("button", { key: s, className: "btn sm" + (active ? " primary" : ""), style: { minWidth: 74 }, onClick: () => setGroupRecht(g, b.id, s) }, STUFE_LABEL[s]);
                        })))),
                h("div", { style: { fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "14px 0 8px" } }, "Sichtbare Module (leer = alle)"),
                h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
                  MODULE.map(m => {
                    const on = (g.module || []).includes(m.id);
                    return h("button", { key: m.id, className: "btn sm" + (on ? " primary" : ""), onClick: () => toggleGroupModul(g, m.id) }, m.label);
                  }))))
            )),

      // ── Konten ──
      h("div", { style: cardStyle },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } },
          eyebrow("Konten"),
          h("div", { style: { display: "flex", gap: 8 } },
            h("button", { className: "btn sm", onClick: loadUsers, disabled: usersLoading }, usersLoading ? "…" : "Neu laden"),
            h("button", { className: "btn sm", onClick: refreshClaims, disabled: busy === "claims", title: "Zugriffs-Claims aller Konten neu berechnen (vor Aktivierung der Regeln)" }, busy === "claims" ? "…" : "Claims neu berechnen"))),
        users.length === 0
          ? h("div", { style: { fontSize: 13, color: "var(--muted)", fontStyle: "italic" } }, usersLoading ? "Lädt…" : "Keine Konten geladen.")
          : users.map(u => h("div", { key: u.uid, style: { borderTop: "1px solid var(--line)", padding: "12px 0" } },
              h("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" } },
                h("div", { style: { minWidth: 180 } },
                  h("div", { style: { fontWeight: 600, fontSize: 14 } }, u.displayName || u.email),
                  h("div", { style: { fontSize: 12, color: "var(--muted)" } }, u.email)),
                h("select", { value: u.role, disabled: busy === "u-" + u.uid, onChange: (e) => changeRole(u, e.target.value), style: { border: "1px solid var(--line-strong)", borderRadius: 4, padding: "4px 8px", background: "var(--panel)", color: "var(--fg)" } },
                  h("option", { value: "member" }, "Benutzer"),
                  h("option", { value: "admin" }, "Admin")),
                isSuper && h("button", {
                  className: "btn sm",
                  style: { marginLeft: "auto" },
                  title: "Die App aus Sicht dieses Users anzeigen (Rechte simulieren)",
                  onClick: () => { window.ppSetViewAs(window.ppComputeIdentity(u, groups)); flash("Ansicht als " + (u.displayName || u.email)); },
                }, "👁 Als User anzeigen")),
              h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 } },
                groups.length === 0
                  ? h("span", { style: { fontSize: 12, color: "var(--faint)" } }, "Keine Gruppen vorhanden.")
                  : groups.map(g => {
                      const on = (u.groupIds || []).includes(g.id);
                      return h("button", { key: g.id, className: "btn sm" + (on ? " primary" : ""), disabled: busy === "u-" + u.uid, onClick: () => toggleUserGroup(u, g.id) }, g.name);
                    }))))),

      // ── Gefahrenzone (nur Superadmin) ──
      isSuper && h("div", { style: { ...cardStyle, borderColor: "#c0392b", background: "color-mix(in srgb, #c0392b 5%, var(--panel))" } },
        h("div", { style: { fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#c0392b", marginBottom: 8 } }, "Gefahrenzone"),
        h("div", { style: { fontSize: 13, color: "var(--fg-2)", lineHeight: 1.7, marginBottom: 12 } },
          "Löscht ", h("b", null, "alle Konten des Mandanten "), h("code", { style: { fontFamily: "var(--font-mono)" } }, window.TENANT_ID),
          " (Auth-Login + Profil + Zuordnung) — ", h("b", null, "außer deinem Superadmin"),
          ". Danach melden sich Nutzer per Microsoft neu an und werden automatisch wieder angelegt. ",
          h("b", { style: { color: "#c0392b" } }, "Unwiderruflich.")),
        h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
          h("input", {
            value: purgeConfirm,
            onChange: e => setPurgeConfirm(e.target.value),
            placeholder: `Zum Bestätigen '${window.TENANT_ID}' eintippen`,
            style: { width: 260, height: 32, padding: "0 10px", border: "1px solid #c0392b", borderRadius: 4, background: "var(--bg)", color: "var(--fg)", fontSize: 13, outline: "none" },
          }),
          h("button", {
            onClick: purgeUsers,
            disabled: busy === "purge" || purgeConfirm !== window.TENANT_ID,
            style: {
              height: 32, padding: "0 14px", borderRadius: 4, border: "none", fontSize: 13, fontWeight: 600,
              cursor: (busy === "purge" || purgeConfirm !== window.TENANT_ID) ? "not-allowed" : "pointer",
              background: purgeConfirm === window.TENANT_ID ? "#c0392b" : "var(--line-strong)",
              color: purgeConfirm === window.TENANT_ID ? "#fff" : "var(--muted)",
            },
          }, busy === "purge" ? "Lösche…" : "Alle Konten löschen"))),
    );
  }

  window.UserGroupsPanel = UserGroupsPanel;
})();
