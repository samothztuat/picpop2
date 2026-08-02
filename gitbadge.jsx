// GitStatusBadge — Code-Sicherung (Commit/Push) aus der Superadmin-Leiste.
// Schreibt einen Wunsch in den Firestore-Briefkasten system/git; ein lokaler
// launchd-Dienst (scripts/git-autosave.sh) holt ihn ab, committet/pusht und
// meldet das Ergebnis zurück. Exponiert window.GitStatusBadge.
// (Portiert 1:1 aus der contextr-Mechanik.)

(function () {
  const { useState, useEffect, useRef } = React;
  const ALT_AB_MS = 8 * 60 * 60 * 1000; // Push älter als 8h → hervorheben

  function relTime(iso) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (!t) return null;
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 1) return "gerade eben";
    if (min < 60) return `vor ${min} Min.`;
    const h = Math.round(min / 60);
    if (h < 24) return `vor ${h} Std.`;
    const d = Math.round(h / 24);
    return `vor ${d} Tag${d === 1 ? "" : "en"}`;
  }
  function deuteErgebnis(res, msg) {
    switch (res) {
      case "commit:ok":     return "✓ gesichert";
      case "commit:nichts": return "nichts zu sichern";
      case "commit:fehler": return "✗ " + (msg || "Commit-Fehler");
      case "push:ok":       return "✓ gepusht";
      case "push:nichts":   return "nichts zu pushen";
      case "push:fehler":   return "✗ " + (msg || "Push-Fehler");
      default: return msg || "";
    }
  }

  function GitStatusBadge() {
    const [stand, setStand] = useState(null);
    const [meldung, setMeldung] = useState("");
    const [laeuft, setLaeuft] = useState(null); // 'commit' | 'push' | null
    const angefordertUm = useRef({ commit: 0, push: 0 });
    const letzteMeldung = useRef("");

    useEffect(() => {
      if (!window.db) return;
      const unsub = window.db.collection("system").doc("git").onSnapshot(snap => {
        setStand(snap.exists ? snap.data() : {});
      }, () => {});
      return () => unsub && unsub();
    }, []);

    // „läuft" beenden, sobald der Dienst geantwortet hat
    useEffect(() => {
      if (!stand) return;
      const upd = stand.updatedAt ? new Date(stand.updatedAt).getTime() : 0;
      if (laeuft === "commit" && !stand.commitRequestedAt && upd > angefordertUm.current.commit) setLaeuft(null);
      if (laeuft === "push" && !stand.pushRequestedAt && upd > angefordertUm.current.push) setLaeuft(null);
      // Ergebnis kurz anzeigen
      if (stand.lastResultAt && stand.lastResultAt !== letzteMeldung.current) {
        letzteMeldung.current = stand.lastResultAt;
        setMeldung(deuteErgebnis(stand.lastResult, stand.lastResultMsg));
        const to = setTimeout(() => setMeldung(""), 12000);
        return () => clearTimeout(to);
      }
    }, [stand, laeuft]);

    async function anfordern(was) {
      if (!window.db) return;
      const feld = was === "commit" ? "commitRequestedAt" : "pushRequestedAt";
      angefordertUm.current[was] = Date.now();
      setLaeuft(was); setMeldung("");
      try {
        await window.db.collection("system").doc("git").set({ [feld]: new Date().toISOString() }, { merge: true });
      } catch (e) { setLaeuft(null); setMeldung("✗ " + (e.message || e)); }
    }

    if (!stand) return null;
    const ahead = parseInt(stand.ahead || "0", 10) || 0;
    const dirty = stand.dirty === "ja";
    const pushRel = relTime(stand.lastPushAt);
    const pushAlt = stand.lastPushAt && (Date.now() - new Date(stand.lastPushAt).getTime()) > ALT_AB_MS;

    const btn = {
      height: 22, padding: "0 9px", borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: "pointer",
      background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff",
    };
    const btnLive = { ...btn, opacity: 0.6, cursor: "default" };

    const h = React.createElement;
    return h("div", { style: { display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.02em" } },
      // Status
      h("span", { style: { opacity: 0.85, whiteSpace: "nowrap" } },
        dirty ? "● ungesichert" : "✓ gesichert",
        ahead > 0 ? ` · ${ahead} offen` : (pushRel ? ` · Push ${pushAlt ? "⚠ " : ""}${pushRel}` : "")),
      // Commit
      h("button", { onClick: () => anfordern("commit"), disabled: laeuft === "commit",
        style: laeuft === "commit" ? btnLive : btn, title: "Arbeitsstand lokal sichern (läuft binnen ~1 Min.)" },
        laeuft === "commit" ? "sichert…" : "● Commit"),
      // Push
      h("button", { onClick: () => anfordern("push"), disabled: laeuft === "push",
        style: laeuft === "push" ? btnLive : btn, title: "Jetzt zu GitHub pushen (läuft binnen ~1 Min.)" },
        laeuft === "push" ? "pusht…" : "↑ Push"),
      // Ergebnis
      meldung && h("span", { style: { opacity: 0.9, whiteSpace: "nowrap" } }, meldung),
    );
  }

  window.GitStatusBadge = GitStatusBadge;
})();
