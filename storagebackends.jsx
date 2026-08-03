// Bildspeicher-Backends verwalten (nur Super-Admin, pro Mandant).
// Legt fest, WO Original-Dateien liegen (Firebase oder OneDrive). Metadaten +
// Thumbnails bleiben immer auf Firebase. Aktive Backends bestimmen, welche
// Assets im Client sichtbar sind. Exponiert window.StorageBackendsPanel.

(function () {
  const { useState, useEffect, useRef } = React;

  function StorageBackendsPanel({ lang = "de" }) {
    const [backends, setBackends] = useState([]);
    const [adding, setAdding] = useState(false);
    const [nName, setNName] = useState("");
    const [nType, setNType] = useState("onedrive");
    const [nDrive, setNDrive] = useState("");
    const [nFolder, setNFolder] = useState("");
    const [toast, setToast] = useState("");
    const [busy, setBusy] = useState("");
    const [testResult, setTestResult] = useState(null); // { ok, msg }
    const [estimate, setEstimate] = useState(null);     // { count, totalGB }
    const [deleteSource, setDeleteSource] = useState(true);
    const [mig, setMig] = useState(null);               // Fortschritt { done, total, errors, mbDone, mbTotal, current, running, log }
    const [armed, setArmed] = useState(false);          // inline-Bestätigung vor Start
    const stopRef = useRef(false);

    useEffect(() => {
      window.ensureDefaultBackend?.().catch(() => {});
      const unsub = window.subscribeToStorageBackends(setBackends);
      return () => unsub && unsub();
    }, []);

    function flash(m) { setToast(m); setTimeout(() => setToast(""), 5000); }

    async function refreshEstimate() {
      setBusy("estimate");
      try {
        const e = await window.estimateMigration();
        setEstimate({ count: e.count, totalGB: e.totalGB, totalMB: e.totalMB });
      } catch (err) { flash("Schätzung fehlgeschlagen: " + (err.message || err)); }
      setBusy("");
    }

    async function runMigration() {
      setArmed(false);
      const target = backends.find(b => b.type === "onedrive" && b.active) || backends.find(b => b.type === "onedrive");
      if (!target) { flash("Kein OneDrive-Backend vorhanden — erst anlegen & aktivieren."); return; }
      let e;
      try { e = await window.estimateMigration(); }
      catch (err) { flash("Fehler beim Vorbereiten: " + (err.message || err)); return; }
      if (e.count === 0) { flash("Keine Bilder auf Firebase zu übertragen."); return; }
      stopRef.current = false;
      let done = 0, errors = 0, mbDone = 0;
      const mbTotal = e.totalMB;
      setMig({ done: 0, total: e.count, errors: 0, mbDone: 0, mbTotal, current: "", running: true });
      for (const a of e.assets) {
        if (stopRef.current) break;
        setMig(m => ({ ...m, current: a.title || a.id }));
        try {
          const r = await window.migrateAssetToOneDrive(a, target.id, deleteSource);
          mbDone += (r.bytes || 0) / 1e6;
          done++;
        } catch (err) {
          errors++;
          console.warn("[migration]", a.id, err.message || err);
        }
        setMig(m => ({ ...m, done, errors, mbDone }));
      }
      setMig(m => ({ ...m, running: false, current: "" }));
      flash(`Migration ${stopRef.current ? "abgebrochen" : "fertig"}: ${done} übertragen · ${errors} Fehler.`);
      refreshEstimate();
    }

    async function backfill(forceAll) {
      const label = forceAll ? "ALLE Speicherorte neu ermitteln (aus Indizien)?" : "Fehlende Speicherorte für den Bestand ermitteln?";
      if (!confirm(label)) return;
      setBusy("backfill");
      try {
        const r = await window.dbBackfillStorageBackends(forceAll);
        flash(`Speicherorte: ${r.updated} gesetzt · ${r.already} bereits korrekt (von ${r.total}).`);
      } catch (e) { flash("Fehler: " + (e.message || e)); }
      setBusy("");
    }

    async function testConnection() {
      setBusy("test"); setTestResult({ ok: null, msg: "Verbindung wird geprüft…" });
      try {
        console.log("[picpop] OneDrive-Test startet…");
        const r = await window.fnMsTestConnection();
        console.log("[picpop] OneDrive-Test Ergebnis:", r);
        const freeGB = r.quota ? Math.round((r.quota.total - r.quota.used) / 1e9) : "?";
        const msg = `Verbunden mit ${r.user} · Ordner '${r.folder}' ${r.folderId ? "vorhanden" : "FEHLT"} · ${freeGB} GB frei`;
        setTestResult({ ok: true, msg }); flash("✓ " + msg);
      } catch (e) {
        console.error("[picpop] OneDrive-Test Fehler:", e);
        const msg = (e && (e.message || e.code)) ? (e.message || e.code) : String(e);
        setTestResult({ ok: false, msg }); flash("✗ " + msg);
      }
      setBusy("");
    }

    async function toggleActive(b) {
      try { await window.dbSetStorageBackendActive(b.id, !b.active); }
      catch (e) { flash("Fehler: " + (e.message || e)); }
    }
    async function makeDefault(b) {
      try { await window.dbSetDefaultStorageBackend(b.id, backends); flash(`Neue Uploads → ${b.name}`); }
      catch (e) { flash("Fehler: " + (e.message || e)); }
    }
    async function remove(b) {
      if (!confirm(`Backend „${b.name}" entfernen? (Assets bleiben erhalten, werden aber ausgeblendet.)`)) return;
      try { await window.dbDeleteStorageBackend(b.id); }
      catch (e) { flash("Fehler: " + (e.message || e)); }
    }
    async function addBackend() {
      const name = nName.trim();
      if (!name) { flash("Bitte einen Namen angeben."); return; }
      const config = nType === "onedrive" ? { driveId: nDrive.trim(), folderPath: nFolder.trim() } : {};
      try {
        await window.dbSaveStorageBackend({
          name, type: nType, active: false, isDefault: false, config,
          createdAt: new Date().toISOString(),
        });
        setNName(""); setNDrive(""); setNFolder(""); setAdding(false);
        flash("Backend angelegt (noch inaktiv).");
      } catch (e) { flash("Fehler: " + (e.message || e)); }
    }

    const h = React.createElement;
    const typePill = (type) => h("span", {
      style: {
        fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase",
        fontWeight: 600, padding: "2px 7px", borderRadius: 999,
        background: type === "onedrive" ? "color-mix(in srgb, #0067b8 15%, transparent)" : "color-mix(in srgb, #e8912a 18%, transparent)",
        color: type === "onedrive" ? "#0067b8" : "#b5751f",
      },
    }, type === "onedrive" ? "OneDrive" : "Firebase");

    const input = { height: 32, padding: "0 10px", border: "1px solid var(--line-strong)", borderRadius: 4, background: "var(--bg)", color: "var(--fg)", fontSize: 13, outline: "none" };

    return h("div", { style: { maxWidth: 720 } },
      toast && h("div", { style: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "var(--fg)", color: "var(--bg)", padding: "8px 16px", borderRadius: 6, fontSize: 13, zIndex: 100 } }, toast),

      // Dauerhaft sichtbares Testergebnis
      testResult && h("div", { style: {
        marginBottom: 14, padding: "10px 14px", borderRadius: 6, fontSize: 13, lineHeight: 1.5,
        border: "1px solid " + (testResult.ok === true ? "#2f7d5b" : testResult.ok === false ? "#c0392b" : "var(--line-strong)"),
        background: testResult.ok === true ? "color-mix(in srgb,#2f7d5b 10%,transparent)" : testResult.ok === false ? "color-mix(in srgb,#c0392b 8%,transparent)" : "var(--hover)",
        color: testResult.ok === false ? "#c0392b" : "var(--fg)",
      } },
        h("b", null, testResult.ok === true ? "✓ OneDrive verbunden — " : testResult.ok === false ? "✗ Test fehlgeschlagen — " : "⏳ "),
        testResult.msg),

      h("div", { style: { fontSize: 12, color: "var(--muted)", lineHeight: 1.7, marginBottom: 16, padding: "10px 14px", background: "var(--hover)", borderRadius: 6 } },
        "Legt fest, ", h("b", null, "wo die Original-Dateien"), " dieses Mandanten liegen. ",
        h("b", null, "Metadaten, Tags und Vorschaubilder bleiben immer auf Firebase"), " (zentral gesichert). ",
        "Nur Assets ", h("b", null, "aktiver"), " Backends werden im Client angezeigt. Neue Uploads gehen ins ", h("b", null, "Standard"), "-Backend."),

      // Liste
      backends.map(b => h("div", { key: b.id, style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "14px 0", borderTop: "1px solid var(--line)" } },
        h("div", { style: { minWidth: 200, flex: 1 } },
          h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
            h("span", { style: { fontWeight: 600, fontSize: 14 } }, b.name),
            typePill(b.type),
            b.isDefault && h("span", { style: { fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 999, padding: "1px 6px" } }, "STANDARD")),
          b.type === "onedrive" && h("div", { style: { fontSize: 11, color: "var(--faint)", fontFamily: "var(--font-mono)", marginTop: 3 } },
            (b.config?.folderPath || "OneDrive · Media") + (b.config?.driveId ? " · drive " + b.config.driveId.slice(0, 10) + "…" : ""))),
        // Verbindung testen (nur OneDrive)
        b.type === "onedrive" && h("button", { className: "btn sm", disabled: busy === "test", onClick: testConnection, title: "OneDrive-Anbindung prüfen" }, busy === "test" ? "…" : "Testen"),
        // aktiv-Toggle
        h("button", {
          onClick: () => toggleActive(b),
          style: {
            width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", position: "relative",
            background: b.active ? "oklch(52% 0.17 145)" : "var(--line-strong)", transition: "background .2s",
          },
          title: b.active ? "aktiv" : "inaktiv",
        }, h("span", { style: { position: "absolute", top: 3, left: b.active ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" } })),
        h("button", { className: "btn sm", disabled: !b.active || b.isDefault, onClick: () => makeDefault(b), title: "Ziel für neue Uploads" }, "Als Standard"),
        h("button", { className: "btn icon ghost sm", disabled: b.id === window.DEFAULT_BACKEND_ID, onClick: () => remove(b), title: "Entfernen" }, "×"),
      )),

      // Hinzufügen
      h("div", { style: { borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 8 } },
        !adding
          ? h("button", { className: "btn sm", onClick: () => setAdding(true) }, "+ Speicher-Backend hinzufügen")
          : h("div", { style: { display: "flex", flexDirection: "column", gap: 10, background: "var(--panel-2, var(--hover))", padding: 14, borderRadius: 8, border: "1px solid var(--line)" } },
              h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
                h("input", { value: nName, onChange: e => setNName(e.target.value), placeholder: "Name, z. B. 'phaeno OneDrive'", style: { ...input, flex: 1, minWidth: 180 } }),
                h("select", { value: nType, onChange: e => setNType(e.target.value), style: { ...input } },
                  h("option", { value: "onedrive" }, "OneDrive / SharePoint"),
                  h("option", { value: "firebase" }, "Firebase"))),
              nType === "onedrive" && h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
                h("input", { value: nDrive, onChange: e => setNDrive(e.target.value), placeholder: "Drive-ID (von Michel)", style: { ...input, flex: 1, minWidth: 160 } }),
                h("input", { value: nFolder, onChange: e => setNFolder(e.target.value), placeholder: "Ordnerpfad, z. B. /Bilddatenbank", style: { ...input, flex: 1, minWidth: 160 } })),
              nType === "onedrive" && h("div", { style: { fontSize: 11, color: "var(--muted)", lineHeight: 1.6 } },
                "OneDrive ist angebunden (picpop-test@phaeno.de / Ordner 'Media'). Drive-ID optional — der Zugriff ist serverseitig fest verdrahtet. Nach dem Anlegen 'Testen' klicken, dann aktivieren und als Standard setzen, damit neue Uploads dorthin gehen."),
              h("div", { style: { display: "flex", gap: 8 } },
                h("button", { className: "btn sm primary", onClick: addBackend }, "Anlegen"),
                h("button", { className: "btn sm", onClick: () => setAdding(false) }, "Abbrechen")))),

      // ── Bestand: Speicherorte nachtragen ──
      h("div", { style: { borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 16 } },
        h("div", { style: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 } }, "Bestand"),
        h("div", { style: { fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 10 } },
          "Trägt das Speicherort-Feld für vorhandene Bilder nach — aus den vorliegenden Angaben (OneDrive-Referenz bzw. Firebase-Datei). Bilder ohne Angabe gelten als Firebase-Altbestand."),
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          h("button", { className: "btn sm", disabled: busy === "backfill", onClick: () => backfill(false) }, busy === "backfill" ? "…" : "Fehlende ermitteln"),
          h("button", { className: "btn sm", disabled: busy === "backfill", onClick: () => backfill(true), title: "Alle neu aus Indizien ableiten" }, "Alle neu ermitteln"))),

      // ── Migration Firebase → OneDrive ──
      h("div", { style: { borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 16 } },
        h("div", { style: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 } }, "Migration Firebase → OneDrive"),
        h("div", { style: { fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 10 } },
          "Überträgt die Original-Dateien von Firebase ins OneDrive. Thumbnails und Metadaten bleiben auf Firebase (nur die Verknüpfung wird umgebogen). Der Browser-Tab muss bis zum Ende offen bleiben."),
        // Schätzung
        h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 } },
          h("button", { className: "btn sm", disabled: busy === "estimate" || mig?.running, onClick: refreshEstimate }, busy === "estimate" ? "…" : "Größe berechnen"),
          estimate && h("span", { style: { fontSize: 13 } },
            h("b", null, estimate.count), " Bilder · ", h("b", null, estimate.totalGB.toFixed(2) + " GB"),
            h("span", { style: { color: "var(--muted)" } }, " → belegt entsprechend im OneDrive"))),
        // Option Quelle löschen
        h("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--fg-2)", marginBottom: 12, cursor: "pointer" } },
          h("input", { type: "checkbox", checked: deleteSource, onChange: e => setDeleteSource(e.target.checked) }),
          "Firebase-Originale nach erfolgreicher Übertragung löschen (Speicher freigeben)"),
        // Start / Bestätigen / Stop (ohne Browser-Dialog)
        mig?.running
          ? h("button", { className: "btn sm", onClick: () => { stopRef.current = true; } }, "⏹ Stoppen")
          : armed
            ? h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "color-mix(in srgb,#c0392b 7%,transparent)", border: "1px solid #c0392b", borderRadius: 6, padding: "8px 12px" } },
                h("span", { style: { fontSize: 12.5 } },
                  estimate ? `${estimate.count} Bilder (${estimate.totalGB.toFixed(2)} GB) übertragen — ` : "Übertragen — ",
                  deleteSource ? "Firebase-Originale werden danach gelöscht. " : "Firebase-Originale bleiben (Kopie). ",
                  "Tab bis zum Ende offen lassen."),
                h("button", { className: "btn sm primary", onClick: runMigration }, "Ja, jetzt übertragen"),
                h("button", { className: "btn sm", onClick: () => setArmed(false) }, "Abbrechen"))
            : h("button", { className: "btn sm primary", onClick: async () => { if (!estimate) await refreshEstimate(); setArmed(true); } }, "▶ Übertragung starten"),
        // Fortschritt
        mig && h("div", { style: { marginTop: 12 } },
          h("div", { style: { height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden" } },
            h("div", { style: { height: "100%", width: (mig.total ? Math.round(mig.done / mig.total * 100) : 0) + "%", background: mig.errors ? "#dbab52" : "#2f7d5b", transition: "width .3s" } })),
          h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)", marginTop: 6, gap: 8, flexWrap: "wrap" } },
            h("span", null, `${mig.done} / ${mig.total} · ${mig.errors} Fehler · ${(mig.mbDone / 1024).toFixed(2)} / ${(mig.mbTotal / 1024).toFixed(2)} GB`),
            mig.current && h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 } }, "→ " + mig.current)))),
    );
  }

  window.StorageBackendsPanel = StorageBackendsPanel;
})();
