// Settings view — contextr-style, adapted for picpop Bilddatenbank
// Sections: Sprache/Darstellung · Datenbankverbindungen · KI-Konfiguration · Team · App-Info

const { useState: useStateS, useEffect: useEffectS, useRef: useRefS, useCallback: useCallbackS } = React;

/* ── Firebase config (read-only display) ── */
const FB_CFG = {
  apiKey:            "AIzaSyBXnMXIhhaI3G3kvYfgRpceUy1k9oJ4cXs",
  authDomain:        "picpop-bilddatenbank.firebaseapp.com",
  projectId:         "picpop-bilddatenbank",
  storageBucket:     "picpop-bilddatenbank.firebasestorage.app",
  messagingSenderId: "895374281311",
  appId:             "1:895374281311:web:6863b936b1c69278e029ea",
};

/* ── Default AI prompt for image analysis ── */
const DEFAULT_AI_PROMPT = `Liste die wichtigsten Bildinhalte als kommagetrennte Stichwörter auf Deutsch. Erfasse alle relevanten Aspekte: Hauptmotiv, Personen (Anzahl, Geschlecht, Alter falls erkennbar), Objekte, Ort/Setting, Farben, Stimmung, Aktivitäten, Markennamen oder Texte falls sichtbar. Maximal 20 Begriffe. Ausgabe: ausschließlich die kommagetrennte Stichwortliste — kein Satz, kein Präambel, kein Punkt am Ende.`;
window.AI_DEFAULT_PROMPT = DEFAULT_AI_PROMPT;

/* ── LLM providers picpop uses ── */
const LLM_PROVIDERS = [
  {
    id: "anthropic",
    label: "Anthropic Claude",
    models: "Claude 3.5 Sonnet · Claude 3 Haiku",
    placeholder: "sk-ant-…",
    docsUrl: "https://console.anthropic.com/account/keys",
    docsLabel: "console.anthropic.com",
    use: "Auto-Tagging, Bildbeschreibungen, Alt-Texte",
  },
  {
    id: "openai",
    label: "OpenAI GPT-4o",
    models: "GPT-4o · GPT-4o mini",
    placeholder: "sk-…",
    docsUrl: "https://platform.openai.com/api-keys",
    docsLabel: "platform.openai.com",
    use: "Vision-Analyse, Objekt-Erkennung, EXIF-Anreicherung",
  },
  {
    id: "google",
    label: "Google Gemini",
    models: "Gemini 1.5 Pro · Gemini Flash",
    placeholder: "AIzaSy…",
    docsUrl: "https://aistudio.google.com/app/apikey",
    docsLabel: "aistudio.google.com",
    use: "Multimodale Bildanalyse, OCR in Dokumenten",
  },
];

/* ── Roles ── */
const S_ROLES = ["Admin", "Editor", "Viewer", "Guest"];

/* ── helpers ── */
function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase",
      letterSpacing: "0.14em", color: "var(--muted)", marginBottom: 20,
      paddingBottom: 10, borderBottom: "1px solid var(--line)",
    }}>{children}</div>
  );
}
function FieldLabel({ children }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase",
      letterSpacing: "0.12em", color: "var(--muted)", marginBottom: 7,
    }}>{children}</div>
  );
}

/* ── StatusDot ── */
function StatusDot({ status }) {
  const map = {
    checking:  { color: "oklch(0.60 0.13 70)",  label: "Prüfe Verbindung…" },
    connected: { color: "oklch(0.52 0.17 145)", label: "Verbunden" },
    offline:   { color: "oklch(0.52 0.18 25)",  label: "Nicht erreichbar" },
  };
  const { color, label } = map[status] || map.checking;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0,
        boxShadow: status === "connected" ? `0 0 0 3px ${color}33` : undefined,
      }} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color }}>{label}</span>
    </span>
  );
}

/* ── HuePicker (reused from views) ── */
const TAG_HUES_S = [0, 20, 40, 60, 90, 140, 175, 200, 220, 250, 280, 310, 340];
function HuePickerS({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {TAG_HUES_S.map(h => (
        <div key={h} onClick={() => onChange(h)} style={{
          width: 22, height: 22, borderRadius: "50%",
          background: `oklch(62% 0.14 ${h})`, cursor: "pointer",
          border: `2px solid ${value === h ? "var(--fg)" : "transparent"}`,
          outline: value === h ? "2px solid var(--fg)" : "none",
          outlineOffset: 1, flexShrink: 0,
        }} />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main SettingsView
═══════════════════════════════════════════════════════════════════ */
function SettingsView({ lang, setLang, theme, setTheme, density, setDensity, team: teamProp, onSaveTeamMember, onDeleteTeamMember, tags: tagsProp, onSaveTag, onDeleteTag }) {
  const t = window.makeT(lang);
  const team = teamProp || window.TEAM || [];
  const tags = tagsProp || [];

  /* ── Appearance state ── */
  const [accentHue, setAccentHue] = useStateS(25); // red default

  /* ── DB connection ── */
  const [dbStatus, setDbStatus] = useStateS("checking");

  /* ── LLM keys ── */
  const [providerKeys, setProviderKeys] = useStateS({});
  const [keyDrafts, setKeyDrafts] = useStateS({});
  const [showKeys, setShowKeys] = useStateS({});
  const [llmSaving, setLlmSaving] = useStateS(false);
  const [llmSavedMsg, setLlmSavedMsg] = useStateS(false);
  const llmSavedTimer = useRefS(null);
  /* ── AI Prompt ── */
  const [aiPrompt,      setAiPrompt]      = useStateS(DEFAULT_AI_PROMPT);
  const [aiPromptDraft, setAiPromptDraft] = useStateS(DEFAULT_AI_PROMPT);
  const [promptSaving,  setPromptSaving]  = useStateS(false);
  const [promptSavedMsg,setPromptSavedMsg]= useStateS(false);

  /* ── Team ── */
  const [editingId, setEditingId] = useStateS(null);
  const [editForm, setEditForm] = useStateS({});
  const [creating, setCreating] = useStateS(false);
  const [newForm, setNewForm] = useStateS({ name: "", dept: "", role: "Editor", hue: 200 });

  /* ── Tags ── */
  const [tagEditingId, setTagEditingId] = useStateS(null);
  const [tagEditForm, setTagEditForm] = useStateS({});
  // which group's create form is open: null | "image" | "medium" | "kampagne"
  const [tagCreatingGroup, setTagCreatingGroup] = useStateS(null);
  const [tagNewForm, setTagNewForm] = useStateS({ name: "", name_en: "" });
  const [tagDeleteConfirm, setTagDeleteConfirm] = useStateS(null);

  /* ── GitHub ── */
  const [ghDraft,     setGhDraft]     = useStateS({ token: "", repo: "", branch: "main" });
  const [ghSaved,     setGhSaved]     = useStateS({ token: "", repo: "", branch: "main" });
  const ghRef         = useRefS({ token: "", repo: "", branch: "main" });
  const [ghStatus,    setGhStatus]    = useStateS("idle");   // idle|checking|connected|error
  const [ghPushing,   setGhPushing]   = useStateS(false);
  const [ghPulling,   setGhPulling]   = useStateS(false);
  const [ghCommits,   setGhCommits]   = useStateS([]);
  const [ghMsg,       setGhMsg]       = useStateS(null);     // { type: "ok"|"err", text }
  const [ghSaving,    setGhSaving]    = useStateS(false);
  const [showGhToken, setShowGhToken] = useStateS(false);
  const [ghPushMsg,   setGhPushMsg]   = useStateS("");

  /* ── DB connection test ── */
  const testConnection = useCallbackS(async () => {
    setDbStatus("checking");
    try {
      const timer = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000));
      await Promise.race([
        window.tenantCol("assets").limit(1).get(),
        timer,
      ]);
      setDbStatus("connected");
    } catch {
      setDbStatus("offline");
    }
  }, []);

  useEffectS(() => { testConnection(); }, [testConnection]);

  /* ── LLM: load from Firestore ── */
  useEffectS(() => {
    const unsub = window.tenantSettingsDoc().onSnapshot(
      (snap) => {
        if (snap.exists) {
          const d = snap.data();
          const keys = d.llmProviderKeys || {};
          setProviderKeys(keys);
          setKeyDrafts(keys);
          if (d.aiPrompt) { setAiPrompt(d.aiPrompt); setAiPromptDraft(d.aiPrompt); window.AI_CONFIG = window.AI_CONFIG || {}; window.AI_CONFIG.prompt = d.aiPrompt; }
          if (d.accentHue) setAccentHue(d.accentHue);
          if (d.github) {
            const g = d.github;
            setGhSaved(g); setGhDraft(g); ghRef.current = g;
          }
        }
        setDbStatus("connected");
      },
      (err) => {
        console.warn("settings/global snapshot error:", err.message);
        setDbStatus("offline");
      }
    );
    return () => unsub();
  }, []);

  /* ── LLM: save ── */
  const llmDirty = LLM_PROVIDERS.some(p => (keyDrafts[p.id] || "") !== (providerKeys[p.id] || ""));

  async function saveLlm() {
    if (llmSaving) return;
    setLlmSaving(true);
    try {
      await window.tenantSettingsDoc().set(
        { llmProviderKeys: keyDrafts, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      setProviderKeys({ ...keyDrafts });
      window.loadAiConfig?.();
      setLlmSavedMsg(true);
      if (llmSavedTimer.current) clearTimeout(llmSavedTimer.current);
      llmSavedTimer.current = setTimeout(() => setLlmSavedMsg(false), 2500);
    } catch (e) {
      alert("Fehler beim Speichern: " + e.message);
    } finally {
      setLlmSaving(false);
    }
  }

  /* ── AI Prompt: save ── */
  async function savePrompt() {
    if (promptSaving) return;
    setPromptSaving(true);
    try {
      const val = aiPromptDraft.trim() || DEFAULT_AI_PROMPT;
      await window.tenantSettingsDoc().set(
        { aiPrompt: val, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      setAiPrompt(val); setAiPromptDraft(val);
      if (window.AI_CONFIG) window.AI_CONFIG.prompt = val;
      setPromptSavedMsg(true);
      setTimeout(() => setPromptSavedMsg(false), 2500);
    } catch (e) { alert("Fehler: " + e.message); }
    finally { setPromptSaving(false); }
  }

  /* ── GitHub helpers ── */

  // Base GitHub API fetch — always uses latest saved config via ref
  function ghApi(path, opts = {}) {
    const { token } = ghRef.current;
    return fetch("https://api.github.com" + path, {
      ...opts,
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    }).then(async r => {
      if (!r.ok) {
        const e = await r.json().catch(() => ({ message: r.statusText }));
        throw new Error(e.message || r.statusText);
      }
      if (r.status === 204) return {};
      return r.json();
    });
  }

  // Encode UTF-8 string → base64 (handles umlauts etc.)
  function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    return btoa(String.fromCharCode(...bytes));
  }
  function fromBase64(b64) {
    const binStr = atob(b64.replace(/\n/g, ""));
    const bytes = Uint8Array.from(binStr, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function ghTestConnection() {
    const { token, repo } = ghRef.current;
    if (!token || !repo) return;
    setGhStatus("checking");
    try {
      await ghApi(`/repos/${repo}`);
      setGhStatus("connected");
      ghLoadCommits();
    } catch (_) {
      setGhStatus("error");
    }
  }

  async function ghLoadCommits() {
    try {
      const { repo, branch } = ghRef.current;
      const data = await ghApi(`/repos/${repo}/commits?path=picpop-snapshot.json&sha=${branch}&per_page=8`);
      setGhCommits(data.map(c => ({
        sha:     c.sha.slice(0, 7),
        fullSha: c.sha,
        message: c.commit.message.split("\n")[0],
        date:    c.commit.author.date,
        author:  c.commit.author.name,
      })));
    } catch (_) {
      setGhCommits([]);
    }
  }

  const ghDirty = ghDraft.token !== ghSaved.token ||
                  ghDraft.repo  !== ghSaved.repo  ||
                  ghDraft.branch !== ghSaved.branch;

  async function ghSaveConfig() {
    if (ghSaving) return;
    setGhSaving(true);
    try {
      const val = { token: ghDraft.token.trim(), repo: ghDraft.repo.trim(), branch: ghDraft.branch.trim() || "main" };
      await window.tenantSettingsDoc().set(
        { github: val, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      setGhSaved(val); setGhDraft(val); ghRef.current = val;
      await ghTestConnection();
    } catch (e) {
      alert("Fehler: " + e.message);
    } finally {
      setGhSaving(false);
    }
  }

  async function ghPush() {
    if (ghPushing) return;
    setGhPushing(true); setGhMsg(null);
    try {
      const { repo, branch } = ghRef.current;
      const FILE = "picpop-snapshot.json";

      // Collect current Firestore data (tenant-scoped)
      const [fS, pfS, aS, tS, tmS] = await Promise.all([
        window.tenantCol("folders").get(),
        window.tenantCol("pdfFolders").get(),
        window.tenantCol("assets").get(),
        window.tenantCol("tags").get(),
        window.tenantCol("team").get(),
      ]);
      const snapshot = {
        version:    1,
        exportedAt: new Date().toISOString(),
        folders:    fS.docs.map(d => d.data()),
        pdfFolders: pfS.docs.map(d => d.data()),
        assets:     aS.docs.map(d => d.data()),
        tags:       tS.docs.map(d => d.data()),
        team:       tmS.docs.map(d => d.data()),
      };
      const json    = JSON.stringify(snapshot, null, 2);
      const content = toBase64(json);
      const message = ghPushMsg.trim() || `picpop snapshot ${new Date().toISOString().slice(0, 10)}`;

      // Get current file SHA (needed for update)
      let sha;
      try { sha = (await ghApi(`/repos/${repo}/contents/${FILE}?ref=${branch}`)).sha; } catch (_) {}

      await ghApi(`/repos/${repo}/contents/${FILE}`, {
        method: "PUT",
        body:   JSON.stringify({ message, content, branch, ...(sha ? { sha } : {}) }),
      });

      setGhMsg({ type: "ok", text: lang === "de" ? `Snapshot gepusht: „${message}"` : `Snapshot pushed: "${message}"` });
      setGhPushMsg("");
      ghLoadCommits();
    } catch (e) {
      setGhMsg({ type: "err", text: e.message });
    } finally {
      setGhPushing(false);
    }
  }

  async function ghPull(sha) {
    if (ghPulling) return;
    setGhPulling(true); setGhMsg(null);
    try {
      const { repo, branch } = ghRef.current;
      const ref      = sha || branch;
      const fileData = await ghApi(`/repos/${repo}/contents/picpop-snapshot.json?ref=${ref}`);
      const json     = fromBase64(fileData.content);
      const snap     = JSON.parse(json);

      // Batch write helper (tenant-scoped)
      async function batchWrite(col, docs) {
        if (!docs || !docs.length) return;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = window.db.batch();
          docs.slice(i, i + 400).forEach(doc => batch.set(window.tenantCol(col).doc(doc.id), doc));
          await batch.commit();
        }
      }

      await Promise.all([
        batchWrite("folders",    snap.folders    || []),
        batchWrite("pdfFolders", snap.pdfFolders || []),
        batchWrite("tags",       snap.tags        || []),
        batchWrite("team",       snap.team        || []),
      ]);
      if (snap.assets) await batchWrite("assets", snap.assets);

      const label = sha ? sha.slice(0, 7) : "latest";
      setGhMsg({ type: "ok", text: lang === "de"
        ? `Snapshot ${label} importiert — Seite neu laden um Änderungen zu sehen.`
        : `Snapshot ${label} imported — reload the page to apply changes.`
      });
    } catch (e) {
      setGhMsg({ type: "err", text: e.message });
    } finally {
      setGhPulling(false);
    }
  }

  /* ── Team helpers ── */
  function startEdit(u, e) {
    e?.stopPropagation();
    setEditingId(u.id);
    setEditForm({ name: u.name, dept: u.dept, role: u.role, hue: u.hue });
    setCreating(false);
  }

  function commitEdit() {
    const u = team.find(m => m.id === editingId);
    if (!u || !editForm.name.trim()) { setEditingId(null); return; }
    const name = editForm.name.trim();
    const parts = name.split(" ");
    const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    onSaveTeamMember?.({ ...u, name, initials, dept: editForm.dept.trim(), role: editForm.role, hue: editForm.hue });
    setEditingId(null);
  }

  function commitCreate() {
    if (!newForm.name.trim()) { setCreating(false); return; }
    const name = newForm.name.trim();
    const parts = name.split(" ");
    const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    onSaveTeamMember?.({ id: "u-" + Math.random().toString(36).slice(2, 8), name, initials, dept: newForm.dept.trim(), role: newForm.role, hue: newForm.hue });
    setNewForm({ name: "", dept: "", role: "Editor", hue: 200 });
    setCreating(false);
  }

  /* ── Tag helpers ── */
  function startTagEdit(tag, e) {
    e?.stopPropagation();
    setTagEditingId(tag.id);
    setTagEditForm({ name: tag.name, name_en: tag.name_en || "", area: tag.area || "", category: tag.category || "" });
    setTagCreatingGroup(null);
    setTagDeleteConfirm(null);
  }

  function commitTagEdit() {
    const tag = tags.find(t => t.id === tagEditingId);
    if (!tag || !tagEditForm.name.trim()) { setTagEditingId(null); return; }
    const area     = tagEditForm.area     || undefined;
    const category = tagEditForm.category || undefined;
    onSaveTag?.({ ...tag, name: tagEditForm.name.trim(), name_en: tagEditForm.name_en.trim(), area, category });
    setTagEditingId(null);
  }

  // group: "image" | "medium" | "kampagne"
  function openTagCreate(group) {
    setTagCreatingGroup(g => g === group ? null : group);
    setTagEditingId(null);
    setTagDeleteConfirm(null);
    setTagNewForm({ name: "", name_en: "" });
  }

  function commitTagCreate(group) {
    if (!tagNewForm.name.trim()) { setTagCreatingGroup(null); return; }
    const area     = group === "image" ? undefined : "print";
    const category = group === "image" ? undefined : group;
    onSaveTag?.({ id: "t-" + Math.random().toString(36).slice(2, 8), name: tagNewForm.name.trim(), name_en: tagNewForm.name_en.trim(), hue: 0, area, category });
    setTagNewForm({ name: "", name_en: "" });
    setTagCreatingGroup(null);
  }

  // Grouped tag lists (sorted by name within each group)
  const byName = (a, b) => (a.name || "").localeCompare(b.name || "");
  const imageTags  = tags.filter(t => !t.area).sort(byName);
  const mediumTags = tags.filter(t => t.area === "print" && t.category === "medium").sort(byName);

  /* ── Shared styles ── */
  const card = {
    background: "var(--panel)",
    border: "1px solid var(--line-strong)",
    display: "flex", flexDirection: "column",
  };
  const inp = {
    width: "100%", padding: "9px 12px", fontSize: 12,
    fontFamily: "var(--font-mono)", border: "1px solid var(--line-strong)",
    background: "var(--bg)", color: "var(--fg)", outline: "none",
    boxSizing: "border-box",
  };
  const inputStyle = {
    border: "1px solid var(--line-strong)", padding: "6px 10px",
    background: "var(--panel)", color: "var(--fg)", outline: "none",
    fontSize: 13, width: "100%", fontFamily: "var(--font-sans)",
  };

  const segBtn = (active) => ({
    all: "unset", cursor: "pointer", padding: "9px 22px", fontSize: 13,
    fontWeight: active ? 500 : 400,
    background: active ? "var(--fg)" : "transparent",
    color: active ? "var(--bg)" : "var(--muted)",
    transition: "background 120ms, color 120ms",
  });

  /* ── Render ── */
  return (
    <div style={{ padding: "32px 40px 80px", overflow: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 48, maxWidth: 900 }}>

      {/* ══ 1 · Sprache & Darstellung ══════════════════════════════════════ */}
      <section>
        <SectionLabel>{lang === "de" ? "Sprache & Darstellung" : "Language & Appearance"}</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>

          {/* Language */}
          <div style={{ ...card, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", gap: 24 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                {lang === "de" ? "Sprache der Oberfläche" : "Interface language"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                {lang === "de" ? "Aktuell: Deutsch" : "Current: English"}
              </div>
            </div>
            <div style={{ display: "flex", border: "1px solid var(--line-strong)", flexShrink: 0 }}>
              {["de", "en"].map((l, i) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  style={{ ...segBtn(lang === l), borderRight: i === 0 ? "1px solid var(--line-strong)" : "none" }}
                  onMouseEnter={e => { if (lang !== l) e.currentTarget.style.background = "var(--hover)"; }}
                  onMouseLeave={e => { if (lang !== l) e.currentTarget.style.background = "transparent"; }}
                >
                  {l === "de" ? "Deutsch" : "English"}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div style={{ ...card, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", gap: 24 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                {lang === "de" ? "Farbschema" : "Color scheme"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                {lang === "de" ? "Hell oder dunkel" : "Light or dark"}
              </div>
            </div>
            <div style={{ display: "flex", border: "1px solid var(--line-strong)", flexShrink: 0 }}>
              {[["light", lang === "de" ? "Hell" : "Light"], ["dark", "Dark"]].map(([k, label], i) => (
                <button
                  key={k}
                  onClick={() => setTheme(k)}
                  style={{ ...segBtn(theme === k), borderRight: i === 0 ? "1px solid var(--line-strong)" : "none" }}
                  onMouseEnter={e => { if (theme !== k) e.currentTarget.style.background = "var(--hover)"; }}
                  onMouseLeave={e => { if (theme !== k) e.currentTarget.style.background = "transparent"; }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Density */}
          <div style={{ ...card, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", gap: 24 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                {lang === "de" ? "Darstellungsdichte" : "Display density"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                {lang === "de" ? "Wie kompakt die Listen und Raster sind" : "How compact lists and grids appear"}
              </div>
            </div>
            <div style={{ display: "flex", border: "1px solid var(--line-strong)", flexShrink: 0 }}>
              {[
                ["compact",     lang === "de" ? "Kompakt"  : "Compact"],
                ["comfortable", lang === "de" ? "Standard" : "Standard"],
                ["cozy",        lang === "de" ? "Geräumig" : "Cozy"],
              ].map(([k, label], i, arr) => (
                <button
                  key={k}
                  onClick={() => setDensity(k)}
                  style={{ ...segBtn(density === k), borderRight: i < arr.length - 1 ? "1px solid var(--line-strong)" : "none" }}
                  onMouseEnter={e => { if (density !== k) e.currentTarget.style.background = "var(--hover)"; }}
                  onMouseLeave={e => { if (density !== k) e.currentTarget.style.background = "transparent"; }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ══ 2 · Datenbankverbindung ═════════════════════════════════════════ */}
      <section>
        <SectionLabel>{lang === "de" ? "Datenbankverbindung" : "Database connection"}</SectionLabel>
        <div style={{ ...card }}>

          {/* Header row */}
          <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid var(--line)" }}>
            <div style={{
              width: 40, height: 40, background: "var(--bg)",
              border: "1px solid var(--line-strong)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
                <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>picpop Firestore</span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 7px",
                  background: "var(--accent-soft)", color: "var(--accent)",
                  border: "1px solid oklch(60% 0.18 25 / 0.2)",
                }}>Primär</span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                Firebase Cloud Firestore · Google Cloud · {FB_CFG.projectId}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <StatusDot status={dbStatus} />
              <button
                onClick={testConnection}
                disabled={dbStatus === "checking"}
                style={{
                  all: "unset", cursor: dbStatus === "checking" ? "not-allowed" : "pointer",
                  padding: "6px 12px", fontSize: 12,
                  border: "1px solid var(--line-strong)", color: "var(--fg)",
                  opacity: dbStatus === "checking" ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (dbStatus !== "checking") e.currentTarget.style.background = "var(--hover)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                {lang === "de" ? "Wiederholen" : "Retry"}
              </button>
            </div>
          </div>

          {/* Config grid */}
          <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              [lang === "de" ? "Projekt-ID" : "Project ID",                   FB_CFG.projectId],
              [lang === "de" ? "Auth-Domain" : "Auth domain",                  FB_CFG.authDomain],
              [lang === "de" ? "Speicher-Bucket" : "Storage bucket",           FB_CFG.storageBucket],
              [lang === "de" ? "Messaging-Sender-ID" : "Messaging sender ID",  FB_CFG.messagingSenderId],
            ].map(([label, value]) => (
              <div key={label}>
                <FieldLabel>{label}</FieldLabel>
                <input
                  readOnly
                  value={value}
                  style={{ ...inp, color: "var(--muted)", cursor: "text", userSelect: "all" }}
                  onClick={e => e.currentTarget.select()}
                />
              </div>
            ))}
          </div>
          <div style={{ padding: "0 24px 18px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)", fontStyle: "italic" }}>
            {lang === "de"
              ? "Konfiguration wird direkt aus dem Bundle gelesen. Zum Ändern firebase.jsx bearbeiten."
              : "Configuration is read directly from the bundle. Edit firebase.jsx to change."}
          </div>
        </div>
      </section>

      {/* ══ 3 · GitHub · Versionskontrolle ══════════════════════════════════ */}
      <section>
        <SectionLabel>GitHub · {lang === "de" ? "Versionskontrolle" : "Version control"}</SectionLabel>

        {/* ── Verbindungskarte ── */}
        <div style={{ ...card, marginBottom: 2 }}>

          {/* Header */}
          <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid var(--line)" }}>
            <div style={{ width: 40, height: 40, background: "var(--bg)", border: "1px solid var(--line-strong)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {/* GitHub mark */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--muted)">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>GitHub</span>
                {ghSaved.repo && (
                  <a href={`https://github.com/${ghSaved.repo}`} target="_blank" rel="noreferrer"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textDecoration: "none" }}
                    onMouseEnter={e => e.currentTarget.style.color = "var(--accent)"}
                    onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}
                  >{ghSaved.repo}</a>
                )}
                {ghSaved.repo && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)" }}>· {ghSaved.branch || "main"}</span>
                )}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                {lang === "de" ? "Firestore-Daten als versionierter JSON-Snapshot" : "Firestore data as versioned JSON snapshot"}
              </div>
            </div>
            {ghSaved.token && ghSaved.repo && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <StatusDot status={ghStatus === "idle" ? "checking" : ghStatus === "error" ? "offline" : ghStatus} />
                <button
                  onClick={ghTestConnection}
                  disabled={ghStatus === "checking"}
                  style={{ all: "unset", cursor: ghStatus === "checking" ? "not-allowed" : "pointer", padding: "6px 12px", fontSize: 12, border: "1px solid var(--line-strong)", color: "var(--fg)", opacity: ghStatus === "checking" ? 0.5 : 1 }}
                  onMouseEnter={e => { if (ghStatus !== "checking") e.currentTarget.style.background = "var(--hover)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >{lang === "de" ? "Test" : "Test"}</button>
              </div>
            )}
          </div>

          {/* Config inputs */}
          <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 160px", gap: 16 }}>
            <div>
              <FieldLabel>Repository</FieldLabel>
              <input
                value={ghDraft.repo}
                onChange={e => setGhDraft(d => ({ ...d, repo: e.target.value }))}
                placeholder="owner/repo-name"
                style={{ ...inp }}
              />
            </div>
            <div>
              <FieldLabel>Branch</FieldLabel>
              <input
                value={ghDraft.branch}
                onChange={e => setGhDraft(d => ({ ...d, branch: e.target.value }))}
                placeholder="main"
                style={{ ...inp }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1", position: "relative" }}>
              <FieldLabel>Personal Access Token (PAT)</FieldLabel>
              <input
                type={showGhToken ? "text" : "password"}
                value={ghDraft.token}
                onChange={e => setGhDraft(d => ({ ...d, token: e.target.value }))}
                placeholder="ghp_…"
                style={{ ...inp, paddingRight: 40, fontFamily: showGhToken && ghDraft.token ? "var(--font-mono)" : "var(--font-sans)", fontSize: showGhToken && ghDraft.token ? 11 : 13 }}
              />
              <button
                onClick={() => setShowGhToken(s => !s)}
                style={{ all: "unset", cursor: "pointer", position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}
                onMouseEnter={e => e.currentTarget.style.color = "var(--fg)"}
                onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}
              >
                {showGhToken
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "0 24px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
              {ghDirty
                ? <span style={{ color: "oklch(0.55 0.14 70)" }}>● {lang === "de" ? "Ungespeicherte Änderungen" : "Unsaved changes"}</span>
                : ghSaved.repo
                  ? <span style={{ color: "oklch(0.52 0.17 145)" }}>✓ {lang === "de" ? "Gespeichert" : "Saved"}</span>
                  : <span>{lang === "de" ? "Noch nicht konfiguriert" : "Not configured yet"}</span>
              }
            </div>
            <button
              onClick={ghSaveConfig}
              disabled={!ghDirty || ghSaving}
              style={{ all: "unset", cursor: ghDirty && !ghSaving ? "pointer" : "not-allowed", padding: "10px 22px", background: "var(--fg)", color: "var(--bg)", fontSize: 13, fontWeight: 500, opacity: ghDirty && !ghSaving ? 1 : 0.35 }}
              onMouseEnter={e => { if (ghDirty && !ghSaving) e.currentTarget.style.opacity = "0.8"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = ghDirty && !ghSaving ? "1" : "0.35"; }}
            >
              {ghSaving ? (lang === "de" ? "Speichert…" : "Saving…") : (lang === "de" ? "Speichern" : "Save")}
            </button>
          </div>
        </div>

        {/* ── Aktionen: Push / Pull ── */}
        {ghSaved.token && ghSaved.repo && (
          <div style={{ ...card, marginBottom: 2 }}>

            {/* Push */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                    {lang === "de" ? "↑  Push — Snapshot erstellen" : "↑  Push — Create snapshot"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
                    {lang === "de"
                      ? "Exportiert alle Firestore-Daten (Sammlungen, Assets, Tags, Team) als JSON und committed sie in das Repository."
                      : "Exports all Firestore data (folders, assets, tags, team) as JSON and commits it to the repository."}
                  </div>
                  <input
                    value={ghPushMsg}
                    onChange={e => setGhPushMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !ghPushing) ghPush(); }}
                    placeholder={lang === "de" ? "Commit-Nachricht (optional)" : "Commit message (optional)"}
                    style={{ ...inp, maxWidth: 420 }}
                  />
                </div>
                <button
                  onClick={ghPush}
                  disabled={ghPushing || ghPulling}
                  style={{ all: "unset", cursor: ghPushing || ghPulling ? "not-allowed" : "pointer", padding: "10px 20px", background: "var(--fg)", color: "var(--bg)", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0, opacity: ghPushing || ghPulling ? 0.5 : 1, marginTop: 2 }}
                  onMouseEnter={e => { if (!ghPushing && !ghPulling) e.currentTarget.style.opacity = "0.8"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = ghPushing || ghPulling ? "0.5" : "1"; }}
                >
                  {ghPushing
                    ? <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        {lang === "de" ? "Pusht…" : "Pushing…"}
                      </span>
                    : (lang === "de" ? "↑ Push" : "↑ Push")}
                </button>
              </div>
            </div>

            {/* Pull latest */}
            <div style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                    {lang === "de" ? "↓  Pull — Letzten Snapshot laden" : "↓  Pull — Restore latest snapshot"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
                    {lang === "de"
                      ? "Importiert den neuesten Snapshot aus dem Repository in Firestore. Danach Seite neu laden."
                      : "Imports the latest snapshot from the repository into Firestore. Reload the page afterwards."}
                  </div>
                </div>
                <button
                  onClick={() => ghPull(null)}
                  disabled={ghPulling || ghPushing}
                  style={{ all: "unset", cursor: ghPulling || ghPushing ? "not-allowed" : "pointer", padding: "10px 20px", border: "1px solid var(--line-strong)", color: "var(--fg)", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0, opacity: ghPulling || ghPushing ? 0.5 : 1, marginTop: 2 }}
                  onMouseEnter={e => { if (!ghPulling && !ghPushing) e.currentTarget.style.background = "var(--hover)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  {ghPulling
                    ? <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        {lang === "de" ? "Lädt…" : "Pulling…"}
                      </span>
                    : (lang === "de" ? "↓ Pull" : "↓ Pull")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Status-Nachricht ── */}
        {ghMsg && (
          <div style={{ padding: "12px 20px", marginBottom: 2, fontFamily: "var(--font-mono)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: ghMsg.type === "ok" ? "oklch(0.52 0.17 145 / 0.08)" : "oklch(0.52 0.18 25 / 0.08)", border: `1px solid ${ghMsg.type === "ok" ? "oklch(0.52 0.17 145 / 0.25)" : "oklch(0.52 0.18 25 / 0.25)"}`, color: ghMsg.type === "ok" ? "oklch(0.40 0.15 145)" : "oklch(0.50 0.14 25)" }}>
            <span>{ghMsg.text}</span>
            {ghMsg.type === "ok" && (
              <button onClick={() => window.location.reload()} style={{ all: "unset", cursor: "pointer", padding: "4px 12px", border: "1px solid currentColor", fontSize: 11, borderRadius: 2, flexShrink: 0 }}>
                {lang === "de" ? "Seite neu laden" : "Reload page"}
              </button>
            )}
            <button onClick={() => setGhMsg(null)} style={{ all: "unset", cursor: "pointer", opacity: 0.5, flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        )}

        {/* ── Commit-Verlauf ── */}
        {ghSaved.token && ghSaved.repo && ghCommits.length > 0 && (
          <div style={{ ...card }}>
            <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)" }}>
              {lang === "de" ? "Verlauf" : "History"} — picpop-snapshot.json
            </div>
            {ghCommits.map((c, i) => (
              <div key={c.fullSha} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 24px", borderBottom: i < ghCommits.length - 1 ? "1px solid var(--line)" : "none" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)", flexShrink: 0, minWidth: 52 }}>{c.sha}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.message}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                    {c.author} · {new Date(c.date).toLocaleDateString(lang === "de" ? "de-CH" : "en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <button
                  onClick={() => { if (window.confirm(lang === "de" ? `Snapshot ${c.sha} wiederherstellen? Aktuelle Daten werden überschrieben.` : `Restore snapshot ${c.sha}? Current data will be overwritten.`)) ghPull(c.fullSha); }}
                  disabled={ghPulling || ghPushing}
                  style={{ all: "unset", cursor: "pointer", padding: "5px 12px", fontSize: 11, border: "1px solid var(--line-strong)", color: "var(--muted)", whiteSpace: "nowrap", flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--hover)"; e.currentTarget.style.color = "var(--fg)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted)"; }}
                >
                  {lang === "de" ? "Wiederherstellen" : "Restore"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Note */}
        <div style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)", lineHeight: 1.6 }}>
          {lang === "de"
            ? "Das PAT benötigt die Berechtigungen repo (Lesen/Schreiben). Bilder in Firebase Storage werden nicht migriert, nur die Metadaten."
            : "The PAT requires repo (read/write) permissions. Images in Firebase Storage are not migrated, only metadata."}
        </div>
      </section>

      {/* ══ 4 · KI-Konfiguration ════════════════════════════════════════════ */}
      <section>
        <SectionLabel>{lang === "de" ? "KI-Konfiguration" : "AI configuration"}</SectionLabel>
        <div style={{ marginBottom: 12, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          {lang === "de"
            ? "API-Schlüssel für KI-gestützte Funktionen: automatisches Tagging, Bildbeschreibungen, Alt-Texte und Metadaten-Anreicherung."
            : "API keys for AI-powered features: automatic tagging, image descriptions, alt texts and metadata enrichment."}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {LLM_PROVIDERS.map(prov => {
            const key = keyDrafts[prov.id] || "";
            const saved = providerKeys[prov.id] || "";
            const enabled = !!saved.trim();
            const visible = showKeys[prov.id] || false;
            return (
              <div key={prov.id} style={{
                ...card, padding: "20px 24px", gap: 14,
                borderLeft: enabled ? "3px solid var(--accent)" : "3px solid transparent",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>{prov.label}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>{prov.models}</div>
                    <div style={{ fontSize: 11, color: "var(--faint)" }}>{prov.use}</div>
                  </div>
                  {enabled && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                      padding: "2px 8px", background: "oklch(52% 0.17 145 / 0.12)", color: "oklch(40% 0.15 145)",
                      border: "1px solid oklch(52% 0.17 145 / 0.25)", flexShrink: 0,
                    }}>
                      {lang === "de" ? "Aktiv" : "Active"}
                    </span>
                  )}
                </div>

                <div style={{ position: "relative" }}>
                  <input
                    type={visible ? "text" : "password"}
                    value={key}
                    onChange={e => setKeyDrafts(d => ({ ...d, [prov.id]: e.target.value }))}
                    placeholder={prov.placeholder}
                    style={{
                      ...inp, paddingRight: 40,
                      fontFamily: visible && key ? "var(--font-mono)" : "var(--font-sans)",
                      fontSize: visible && key ? 11 : 13,
                      letterSpacing: visible && key ? "0.04em" : 0,
                    }}
                  />
                  <button
                    onClick={() => setShowKeys(s => ({ ...s, [prov.id]: !visible }))}
                    style={{ all: "unset", cursor: "pointer", position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--fg)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--muted)"; }}
                  >
                    {visible
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>

                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)" }}>
                  {lang === "de" ? "API-Schlüssel unter " : "API key at "}
                  <a href={prov.docsUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>
                    {prov.docsLabel}
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
            {llmDirty
              ? <span style={{ color: "oklch(0.55 0.14 70)" }}>● {lang === "de" ? "Ungespeicherte Änderungen" : "Unsaved changes"}</span>
              : llmSavedMsg
                ? <span style={{ color: "oklch(0.52 0.17 145)" }}>✓ {lang === "de" ? "Gespeichert" : "Saved"}</span>
                : <span>{LLM_PROVIDERS.filter(p => providerKeys[p.id]?.trim()).length} {lang === "de" ? "Anbieter konfiguriert" : "providers configured"}</span>
            }
          </div>
          <button
            onClick={saveLlm}
            disabled={!llmDirty || llmSaving}
            style={{
              all: "unset", cursor: llmDirty && !llmSaving ? "pointer" : "not-allowed",
              padding: "10px 22px", background: "var(--fg)", color: "var(--bg)",
              fontSize: 13, fontWeight: 500,
              opacity: llmDirty && !llmSaving ? 1 : 0.35,
            }}
            onMouseEnter={e => { if (llmDirty && !llmSaving) e.currentTarget.style.opacity = "0.8"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = llmDirty && !llmSaving ? "1" : "0.35"; }}
          >
            {llmSaving ? (lang === "de" ? "Speichert…" : "Saving…") : (lang === "de" ? "Speichern" : "Save")}
          </button>
        </div>
        {/* ── Analyse-Prompt ── */}
        <div style={{ ...card, padding: "20px 24px", marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
                {lang === "de" ? "Bild-Analyse Prompt" : "Image analysis prompt"}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {lang === "de"
                  ? "Dieser Prompt wird bei jedem Bild-Upload an GPT-4o mini gesendet."
                  : "This prompt is sent to GPT-4o mini with each image upload."}
              </div>
            </div>
            <button
              onClick={() => setAiPromptDraft(DEFAULT_AI_PROMPT)}
              title={lang === "de" ? "Auf Standard zurücksetzen" : "Reset to default"}
              style={{ all: "unset", cursor: "pointer", fontSize: 11, color: "var(--muted)", textDecoration: "underline", flexShrink: 0 }}
            >
              {lang === "de" ? "Zurücksetzen" : "Reset"}
            </button>
          </div>
          <textarea
            value={aiPromptDraft}
            onChange={e => setAiPromptDraft(e.target.value)}
            rows={5}
            style={{ width: "100%", border: "1px solid var(--line-strong)", borderRadius: 4, padding: "10px 12px", background: "var(--bg)", color: "var(--fg)", resize: "vertical", outline: "none", fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.6, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
              {promptSavedMsg
                ? <span style={{ color: "oklch(0.52 0.17 145)" }}>✓ {lang === "de" ? "Gespeichert" : "Saved"}</span>
                : aiPromptDraft !== aiPrompt
                  ? <span style={{ color: "oklch(0.55 0.14 70)" }}>● {lang === "de" ? "Ungespeichert" : "Unsaved"}</span>
                  : <span style={{ color: "var(--faint)" }}>gpt-4o-mini · detail: low</span>
              }
            </div>
            <button
              onClick={savePrompt}
              disabled={aiPromptDraft === aiPrompt || promptSaving}
              style={{
                all: "unset", cursor: aiPromptDraft !== aiPrompt && !promptSaving ? "pointer" : "not-allowed",
                padding: "8px 18px", background: "var(--fg)", color: "var(--bg)", fontSize: 13, fontWeight: 500,
                opacity: aiPromptDraft !== aiPrompt && !promptSaving ? 1 : 0.35,
              }}
            >
              {promptSaving ? (lang === "de" ? "Speichert…" : "Saving…") : (lang === "de" ? "Speichern" : "Save")}
            </button>
          </div>
        </div>
      </section>

      {/* ══ 4 · Team / Mitglieder ═══════════════════════════════════════════ */}
      <section>
        <SectionLabel>{lang === "de" ? "Team & Mitglieder" : "Team & members"}</SectionLabel>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
            {team.length} {lang === "de" ? "Personen" : "people"}
          </div>
          <button
            onClick={() => { setCreating(v => !v); setEditingId(null); }}
            style={{
              all: "unset", cursor: "pointer",
              padding: "8px 16px", background: "var(--fg)", color: "var(--bg)",
              fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 7,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            {lang === "de" ? "Mitglied hinzufügen" : "Add member"}
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div style={{ ...card, padding: 20, marginBottom: 2, borderColor: "var(--accent)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", marginBottom: 14 }}>
              {lang === "de" ? "Neues Mitglied" : "New member"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12, marginBottom: 14 }}>
              <div>
                <FieldLabel>{lang === "de" ? "Name *" : "Name *"}</FieldLabel>
                <input autoFocus value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") commitCreate(); if (e.key === "Escape") setCreating(false); }}
                  placeholder="Vorname Nachname" style={inputStyle} />
              </div>
              <div>
                <FieldLabel>{lang === "de" ? "Abteilung" : "Department"}</FieldLabel>
                <input value={newForm.dept} onChange={e => setNewForm(f => ({ ...f, dept: e.target.value }))}
                  placeholder="Marketing" style={inputStyle} />
              </div>
              <div>
                <FieldLabel>{lang === "de" ? "Rolle" : "Role"}</FieldLabel>
                <select value={newForm.role} onChange={e => setNewForm(f => ({ ...f, role: e.target.value }))}
                  style={{ ...inputStyle, cursor: "pointer" }}>
                  {S_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <FieldLabel>{lang === "de" ? "Avatarfarbe" : "Avatar color"}</FieldLabel>
              <HuePickerS value={newForm.hue} onChange={h => setNewForm(f => ({ ...f, hue: h }))} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setCreating(false)} style={{
                all: "unset", cursor: "pointer", padding: "8px 14px", fontSize: 13,
                border: "1px solid var(--line-strong)", color: "var(--muted)",
              }}>{lang === "de" ? "Abbrechen" : "Cancel"}</button>
              <button onClick={commitCreate} disabled={!newForm.name.trim()} style={{
                all: "unset", cursor: newForm.name.trim() ? "pointer" : "not-allowed",
                padding: "8px 18px", background: "var(--fg)", color: "var(--bg)",
                fontSize: 13, fontWeight: 500, opacity: newForm.name.trim() ? 1 : 0.4,
              }}>{lang === "de" ? "Anlegen" : "Create"}</button>
            </div>
          </div>
        )}

        {/* Team table */}
        <div style={{ ...card }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 180px 140px 72px",
            padding: "10px 24px", borderBottom: "1px solid var(--line)",
          }}>
            {[lang === "de" ? "Name" : "Name", lang === "de" ? "Abteilung" : "Department", lang === "de" ? "Rolle" : "Role", ""].map((h, i) => (
              <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)" }}>{h}</div>
            ))}
          </div>

          {team.map(u => {
            const isEditing = editingId === u.id;
            if (isEditing) return (
              <div key={u.id} style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)", background: "var(--hover)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12, marginBottom: 12 }}>
                  <div>
                    <FieldLabel>{lang === "de" ? "Name" : "Name"}</FieldLabel>
                    <input autoFocus value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingId(null); }}
                      style={inputStyle} />
                  </div>
                  <div>
                    <FieldLabel>{lang === "de" ? "Abteilung" : "Department"}</FieldLabel>
                    <input value={editForm.dept} onChange={e => setEditForm(f => ({ ...f, dept: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <FieldLabel>{lang === "de" ? "Rolle" : "Role"}</FieldLabel>
                    <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                      {S_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <FieldLabel>{lang === "de" ? "Avatarfarbe" : "Avatar color"}</FieldLabel>
                  <HuePickerS value={editForm.hue} onChange={h => setEditForm(f => ({ ...f, hue: h }))} />
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setEditingId(null)} style={{
                    all: "unset", cursor: "pointer", padding: "8px 14px", fontSize: 13,
                    border: "1px solid var(--line-strong)", color: "var(--muted)",
                  }}>{lang === "de" ? "Abbrechen" : "Cancel"}</button>
                  <button onClick={commitEdit} style={{
                    all: "unset", cursor: "pointer", padding: "8px 18px",
                    background: "var(--fg)", color: "var(--bg)", fontSize: 13, fontWeight: 500,
                  }}>{lang === "de" ? "Speichern" : "Save"}</button>
                </div>
              </div>
            );
            return (
              <div key={u.id} style={{
                display: "grid", gridTemplateColumns: "1fr 180px 140px 72px",
                alignItems: "center", padding: "12px 24px",
                borderBottom: "1px solid var(--line)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <window.Avatar user={u} size={28} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                      {u.name.toLowerCase().replace(/\s+/g, ".")}@koehler.co
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "var(--fg-2)" }}>{u.dept}</div>
                <div>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase",
                    letterSpacing: "0.08em", padding: "3px 8px",
                    border: "1px solid var(--line-strong)", color: "var(--muted)",
                  }}>{u.role}</span>
                </div>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <button
                    onClick={e => startEdit(u, e)}
                    title={lang === "de" ? "Bearbeiten" : "Edit"}
                    style={{ all: "unset", cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--faint)" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--fg)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--faint)"; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button
                    onClick={() => onDeleteTeamMember?.(u.id)}
                    title={lang === "de" ? "Entfernen" : "Remove"}
                    style={{ all: "unset", cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--faint)" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "oklch(0.50 0.14 25)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--faint)"; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ══ 5 · Tags ═══════════════════════════════════════════════════════ */}
      <section>
        <SectionLabel>{lang === "de" ? "Tags verwalten" : "Manage tags"}</SectionLabel>

        {/* Render one group: sub-header + optional create form + table of rows */}
        {[
          { group: "image",  groupTags: imageTags,  label: lang === "de" ? "Bilder" : "Images", printSub: false },
          { group: "medium", groupTags: mediumTags, label: "Medium",                             printSub: true  },
        ].map(({ group, groupTags, label, printSub }, gi) => {
          const isCreating = tagCreatingGroup === group;
          const TAG_AREA_OPTIONS = [
            { value: "",             label: lang === "de" ? "Bilder (allgemein)" : "Images (general)" },
            { value: "print|medium", label: "Print · Medium" },
          ];
          function areaVal(t) { return t.area === "print" && t.category ? `print|${t.category}` : ""; }
          function areaToFields(v) { return v.startsWith("print|") ? { area: "print", category: v.split("|")[1] } : { area: "", category: "" }; }

          return (
            <div key={group} style={{ marginTop: gi === 0 ? 0 : 32 }}>
              {/* "Print" super-header before the first print group */}
              {gi === 1 && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)", paddingBottom: 10, borderBottom: "1px solid var(--line)", marginBottom: 0 }}>
                  Print
                </div>
              )}

              {/* Group sub-header + "Neuer Tag" button */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, color: "var(--fg-2)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)" }}>{groupTags.length}</span>
                </div>
                <button
                  onClick={() => openTagCreate(group)}
                  style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", fontSize: 12, border: "1px solid var(--line-strong)", color: isCreating ? "var(--accent)" : "var(--muted)", background: isCreating ? "var(--accent-soft)" : "transparent" }}
                  onMouseEnter={e => { if (!isCreating) { e.currentTarget.style.color = "var(--fg)"; e.currentTarget.style.background = "var(--hover)"; } }}
                  onMouseLeave={e => { if (!isCreating) { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.background = isCreating ? "var(--accent-soft)" : "transparent"; } }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                  {lang === "de" ? "Neuer Tag" : "New tag"}
                </button>
              </div>

              {/* Create form */}
              {isCreating && (
                <div style={{ ...card, padding: 18, marginBottom: 2, borderColor: "var(--accent)" }}>
                  <div style={{ marginBottom: 12 }}>
                    <FieldLabel>{lang === "de" ? "Name *" : "Name *"}</FieldLabel>
                    <input
                      autoFocus
                      value={tagNewForm.name}
                      onChange={e => setTagNewForm(f => ({ ...f, name: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") commitTagCreate(group); if (e.key === "Escape") setTagCreatingGroup(null); }}
                      placeholder={lang === "de" ? "z.B. Sommer 2025" : "e.g. Summer 2025"}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setTagCreatingGroup(null)} style={{ all: "unset", cursor: "pointer", padding: "8px 14px", fontSize: 13, border: "1px solid var(--line-strong)", color: "var(--muted)" }}>{lang === "de" ? "Abbrechen" : "Cancel"}</button>
                    <button onClick={() => commitTagCreate(group)} disabled={!tagNewForm.name.trim()} style={{ all: "unset", cursor: tagNewForm.name.trim() ? "pointer" : "not-allowed", padding: "8px 18px", background: "var(--fg)", color: "var(--bg)", fontSize: 13, fontWeight: 500, opacity: tagNewForm.name.trim() ? 1 : 0.4 }}>{lang === "de" ? "Anlegen" : "Create"}</button>
                  </div>
                </div>
              )}

              {/* Tag table */}
              <div style={{ ...card }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 64px", padding: "8px 20px", borderBottom: "1px solid var(--line)" }}>
                  {["Name (DE)", "Name (EN)", ""].map((h, i) => (
                    <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)" }}>{h}</div>
                  ))}
                </div>

                {groupTags.map(tag => {
                  const isEditing    = tagEditingId === tag.id;
                  const isDelConfirm = tagDeleteConfirm === tag.id;

                  if (isEditing) return (
                    <div key={tag.id} style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", background: "var(--hover)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 210px", gap: 12, marginBottom: 12 }}>
                        <div>
                          <FieldLabel>{lang === "de" ? "Name (Deutsch)" : "Name (German)"}</FieldLabel>
                          <input
                            autoFocus
                            value={tagEditForm.name || ""}
                            onChange={e => setTagEditForm(f => ({ ...f, name: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") commitTagEdit(); if (e.key === "Escape") setTagEditingId(null); }}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <FieldLabel>{lang === "de" ? "Name (Englisch)" : "Name (English)"}</FieldLabel>
                          <input value={tagEditForm.name_en || ""} onChange={e => setTagEditForm(f => ({ ...f, name_en: e.target.value }))} style={inputStyle} />
                        </div>
                        <div>
                          <FieldLabel>{lang === "de" ? "Gruppe" : "Group"}</FieldLabel>
                          <select value={areaVal(tagEditForm)} onChange={e => { const flds = areaToFields(e.target.value); setTagEditForm(n => ({ ...n, area: flds.area, category: flds.category })); }} style={{ ...inputStyle, cursor: "pointer" }}>
                            {TAG_AREA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => setTagEditingId(null)} style={{ all: "unset", cursor: "pointer", padding: "8px 14px", fontSize: 13, border: "1px solid var(--line-strong)", color: "var(--muted)" }}>{lang === "de" ? "Abbrechen" : "Cancel"}</button>
                        <button onClick={commitTagEdit} style={{ all: "unset", cursor: "pointer", padding: "8px 18px", background: "var(--fg)", color: "var(--bg)", fontSize: 13, fontWeight: 500 }}>{lang === "de" ? "Speichern" : "Save"}</button>
                      </div>
                    </div>
                  );

                  return (
                    <div key={tag.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 64px", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid var(--line)", background: isDelConfirm ? "oklch(0.52 0.18 25 / 0.06)" : "transparent" }}>
                      <div style={{ fontSize: 13, fontWeight: 500, paddingRight: 12 }}>{tag.name}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", paddingRight: 12 }}>{tag.name_en || <span style={{ opacity: 0.3 }}>—</span>}</div>
                      <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                        {isDelConfirm ? (
                          <>
                            <button onClick={() => { onDeleteTag?.(tag.id); setTagDeleteConfirm(null); }} style={{ all: "unset", cursor: "pointer", padding: "3px 8px", fontSize: 11, fontWeight: 600, color: "oklch(0.50 0.14 25)", border: "1px solid oklch(0.50 0.14 25 / 0.4)" }}>{lang === "de" ? "Löschen" : "Delete"}</button>
                            <button onClick={() => setTagDeleteConfirm(null)} style={{ all: "unset", cursor: "pointer", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }} onMouseEnter={e => { e.currentTarget.style.color = "var(--fg)"; }} onMouseLeave={e => { e.currentTarget.style.color = "var(--muted)"; }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={e => startTagEdit(tag, e)} title={lang === "de" ? "Bearbeiten" : "Edit"} style={{ all: "unset", cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--faint)" }} onMouseEnter={e => { e.currentTarget.style.color = "var(--fg)"; }} onMouseLeave={e => { e.currentTarget.style.color = "var(--faint)"; }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={() => setTagDeleteConfirm(tag.id)} title={lang === "de" ? "Löschen" : "Delete"} style={{ all: "unset", cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--faint)" }} onMouseEnter={e => { e.currentTarget.style.color = "oklch(0.50 0.14 25)"; }} onMouseLeave={e => { e.currentTarget.style.color = "var(--faint)"; }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {groupTags.length === 0 && (
                  <div style={{ padding: "20px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)", textAlign: "center" }}>
                    {lang === "de" ? "Keine Tags in dieser Gruppe." : "No tags in this group."}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* ══ 6 · App-Info ════════════════════════════════════════════════════ */}
      <section>
        {/* ── Workspace / Tenant ───────────────────────────────────────────── */}
        <section style={{ marginBottom: 56 }}>
        <SectionLabel>{lang === "de" ? "Workspace" : "Workspace"}</SectionLabel>
        <div style={{ background: "var(--panel)", border: "1px solid var(--line-strong)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24, borderBottom: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 6 }}>
                {lang === "de" ? "Mandant (Tenant-ID)" : "Tenant ID"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600 }}>{window.TENANT_ID}</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 6 }}>
                {lang === "de" ? "Datenpfad (Firestore)" : "Data path (Firestore)"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>tenants/{window.TENANT_ID}/…</div>
            </div>
          </div>
          <div style={{ padding: "14px 24px", background: "var(--hover)" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
              {lang === "de"
                ? <>Der Workspace wird automatisch aus der Subdomain erkannt (<span style={{ fontFamily: "var(--font-mono)" }}>kunde.picpop.de</span>) oder kann per URL-Parameter überschrieben werden (<span style={{ fontFamily: "var(--font-mono)" }}>?t=kunde</span>). Alle Daten dieses Workspace sind vollständig isoliert.</>
                : <>The workspace is detected automatically from the subdomain (<span style={{ fontFamily: "var(--font-mono)" }}>customer.picpop.de</span>) or can be overridden via URL parameter (<span style={{ fontFamily: "var(--font-mono)" }}>?t=customer</span>). All data in this workspace is fully isolated.</>
              }
            </div>
          </div>
        </div>
        </section>

        <SectionLabel>{lang === "de" ? "App-Info" : "App info"}</SectionLabel>
        <div style={{ background: "var(--panel)", border: "1px solid var(--line-strong)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
            {[
              [lang === "de" ? "Version"     : "Version",     "v1.0.0"],
              [lang === "de" ? "Umgebung"    : "Environment", "Firebase Hosting"],
              [lang === "de" ? "Datenbank"   : "Database",    `Firestore · ${FB_CFG.projectId}`],
            ].map(([k, v], i, arr) => (
              <div key={k} style={{ padding: "18px 24px", borderRight: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase",
                  letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 8,
                }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            borderTop: "1px solid var(--line)",
          }}>
            {[
              [lang === "de" ? "Stack" : "Stack",         "React 18 · Babel · Firebase"],
              [lang === "de" ? "Speicher" : "Storage",    "Firebase Storage"],
              [lang === "de" ? "Region" : "Region",       "europe-west1"],
            ].map(([k, v], i, arr) => (
              <div key={k} style={{ padding: "18px 24px", borderRight: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase",
                  letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 8,
                }}>{k}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

window.SettingsView = SettingsView;
