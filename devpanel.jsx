// DevPanel — Feature Requests + GitHub + Docs
// Ported 1:1 from contextr DevPanel.tsx → plain JSX, Firestore compat SDK

const { useState: useStateDP, useEffect: useEffectDP, useRef: useRefDP } = React;

const DP_DOC_REF      = () => firebase.firestore().doc('settings/devRequests');
const DP_APP_DOCS_REF = () => firebase.firestore().doc('settings/appDocs');

async function dpPersist(requests) {
  await DP_DOC_REF().set({ requests }, { merge: false });
}

function dpUid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Icons ──────────────────────────────────────────────────────────────────

function DPIconCode() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  );
}
function DPIconCopy() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}
function DPIconTrash() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  );
}
function DPIconEdit() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}
function DPIconRefresh() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}

// ── PriorityBadge ──────────────────────────────────────────────────────────

function PriorityBadge({ priority = 'none', onClick }) {
  const [hover, setHover] = useStateDP(false);
  const active = priority !== 'none';
  return (
    <button
      title={active ? 'Priorität entfernen' : 'Als Priorität markieren'}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        all: 'unset', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 7px',
        fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
        color: active ? 'oklch(0.52 0.22 25)' : hover ? 'var(--muted)' : 'var(--faint)',
        background: active ? 'oklch(0.52 0.22 25 / 0.10)' : hover ? 'var(--hover)' : 'transparent',
        border: `1px solid ${active ? 'oklch(0.52 0.22 25 / 0.40)' : hover ? 'var(--line-strong)' : 'transparent'}`,
        transition: 'color 120ms, background 120ms, border-color 120ms',
        flexShrink: 0,
      }}
    >
      {active ? 'Prio' : hover ? 'Prio' : ''}
    </button>
  );
}

// ── ActionBtn ──────────────────────────────────────────────────────────────

function DPActionBtn({ children, onClick, title, disabled, active, danger }) {
  const [hover, setHover] = useStateDP(false);
  const color = active
    ? 'var(--accent)'
    : danger && hover
      ? 'oklch(0.52 0.2 25)'
      : hover ? 'var(--fg)' : 'var(--muted)';
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        all: 'unset', cursor: disabled ? 'not-allowed' : 'pointer',
        width: 26, height: 26,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color, opacity: disabled ? 0.4 : 1,
        border: `1px solid ${hover && !disabled ? 'var(--line-strong)' : 'transparent'}`,
        transition: 'color 120ms, border-color 120ms',
        flexShrink: 0,
      }}>
      {children}
    </button>
  );
}

// ── RequestCard ────────────────────────────────────────────────────────────

function RequestCard({ req, onToggle, onDelete, onUpdate, onPriority }) {
  const [editing, setEditing] = useStateDP(false);
  const [editTitle, setEditTitle] = useStateDP(req.title);
  const [editText, setEditText] = useStateDP(req.text);
  const [copied, setCopied] = useStateDP(false);
  const editTitleRef = useRefDP(null);
  const reqRef = useRefDP(req);
  reqRef.current = req;

  useEffectDP(() => {
    if (!editing) { setEditTitle(req.title); setEditText(req.text); }
  }, [req.title, req.text, editing]);

  function startEdit() {
    setEditTitle(req.title); setEditText(req.text);
    setEditing(true);
    setTimeout(() => editTitleRef.current?.focus(), 40);
  }
  function cancelEdit() { setEditTitle(req.title); setEditText(req.text); setEditing(false); }
  function saveEdit() { onUpdate(editTitle, editText); setEditing(false); }
  function handleCopy() {
    const r = reqRef.current;
    navigator.clipboard.writeText([r.title, r.text].filter(Boolean).join('\n\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{
      border: `1px solid ${editing ? 'var(--line-strong)' : 'var(--line)'}`,
      background: editing ? 'var(--panel)' : req.done ? 'transparent' : 'var(--panel)',
      marginBottom: 10,
      opacity: !editing && req.done ? 0.55 : 1,
      transition: 'opacity 150ms, border-color 150ms',
    }}>
      {editing ? (
        <div style={{ padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            ref={editTitleRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit(); }}
            placeholder="Titel…"
            style={{
              width: '100%', padding: '7px 10px', fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', letterSpacing: '-0.01em',
              border: '1px solid var(--line-strong)', background: 'var(--bg)',
              color: 'var(--fg)', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelEdit();
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveEdit(); }
            }}
            rows={4}
            placeholder="Beschreibung… (optional)"
            style={{
              width: '100%', resize: 'vertical', padding: '8px 10px',
              fontSize: 12, fontFamily: 'inherit', lineHeight: 1.6,
              border: '1px solid var(--line-strong)', background: 'var(--bg)',
              color: 'var(--fg)', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--faint)' }}>⌘↵ speichern · Esc abbrechen</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={cancelEdit} style={{ all: 'unset', cursor: 'pointer', padding: '6px 14px', border: '1px solid var(--line-strong)', fontSize: 12, color: 'var(--fg)' }}>Abbrechen</button>
              <button onClick={saveEdit} style={{ all: 'unset', cursor: 'pointer', padding: '6px 14px', background: 'var(--fg)', color: 'var(--bg)', fontSize: 12, fontWeight: 500 }}>Speichern</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px' }}>
          <input type="checkbox" checked={req.done} onChange={onToggle}
            style={{ marginTop: 3, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: req.text ? 4 : 0, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
                color: 'var(--fg)',
                textDecoration: req.done ? 'line-through' : 'none',
              }}>
                {req.title || <span style={{ color: 'var(--muted)', fontWeight: 400, fontStyle: 'italic' }}>Kein Titel</span>}
              </span>
              <PriorityBadge priority={req.priority} onClick={onPriority} />
            </div>
            {req.text && (
              <div style={{
                fontSize: 12, lineHeight: 1.6, color: 'var(--muted)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                textDecoration: req.done ? 'line-through' : 'none',
              }}>
                {req.text}
              </div>
            )}
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--faint)', marginTop: 6 }}>
              {new Date(req.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <DPActionBtn title="Bearbeiten" onClick={startEdit}><DPIconEdit /></DPActionBtn>
            <DPActionBtn title={copied ? 'Kopiert!' : 'Inhalt kopieren'} onClick={handleCopy} active={copied}><DPIconCopy /></DPActionBtn>
            <DPActionBtn title="Löschen" onClick={onDelete} danger><DPIconTrash /></DPActionBtn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab button ─────────────────────────────────────────────────────────────

function DPTab({ label, active, count, onClick }) {
  return (
    <button onClick={onClick} style={{
      all: 'unset', cursor: 'pointer',
      padding: '12px 20px',
      fontSize: 13, fontWeight: active ? 500 : 400,
      color: active ? 'var(--fg)' : 'var(--muted)',
      borderBottom: `2px solid ${active ? 'var(--fg)' : 'transparent'}`,
      display: 'inline-flex', alignItems: 'center', gap: 7,
      transition: 'color 120ms, border-color 120ms',
    }}>
      {label}
      {count !== undefined && count > 0 && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 18, height: 18, padding: '0 5px',
          background: active ? 'var(--fg)' : 'var(--line-strong)',
          color: active ? 'var(--bg)' : 'var(--muted)',
          fontSize: 10, fontWeight: 700, borderRadius: 99,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Relative date helper ───────────────────────────────────────────────────

function dpFmtDate(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1)  return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `vor ${h} Std.`;
  const day = Math.floor(h / 24);
  if (day < 7)  return `vor ${day} Tag${day === 1 ? '' : 'en'}`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ── KI-Batch Tab ──────────────────────────────────────────────────────────

function KiBatchTab() {
  const { useState: useStateKI, useRef: useRefKI } = React;
  const [status, setStatus]     = useStateKI('idle'); // idle | running | done | error
  const [log, setLog]           = useStateKI([]);
  const [progress, setProgress] = useStateKI({ done: 0, total: 0, errors: 0 });
  const stopRef                 = useRefKI(false);
  const logRef                  = useRefKI(null);

  function addLog(msg, type = 'info') {
    setLog(prev => [...prev, { msg, type }]);
    // auto-scroll
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
  }

  // Wählt die richtige Analysefunktion je nach Asset-Typ und Bereich
  function pickFn(asset) {
    if (asset.kind === 'pdf')                        return window.describePdfWithAI;
    if (asset.area === 'print' || asset.kind !== 'image') return window.describePrintImageWithAI;
    return window.describeImageWithAI;
  }

  function typeLabel(asset) {
    if (asset.kind === 'pdf')   return '[PDF Text]';
    if (asset.area === 'print') return '[Print Bild]';
    return '[Foto]';
  }

  async function runBatch() {
    if (status === 'running') { stopRef.current = true; return; }
    stopRef.current = false;
    setLog([]);
    setStatus('running');
    setProgress({ done: 0, total: 0, errors: 0 });

    try {
      // 1. AI-Config laden
      if (!window.AI_CONFIG?.openaiKey) await window.loadAiConfig();
      if (!window.AI_CONFIG?.openaiKey) {
        addLog('⚠ Kein OpenAI-Key — bitte in den Einstellungen hinterlegen.', 'error');
        setStatus('error'); return;
      }

      // 2. Alle Assets ohne aiDescription aus Firestore laden (drei Queries, da Firestore kein OR unterstützt)
      addLog('Lade Assets ohne KI-Beschreibung…');
      const [snapPdf, snapImg] = await Promise.all([
        window.tenantCol('assets').where('kind', '==', 'pdf').get(),
        window.tenantCol('assets').where('kind', '==', 'image').get(),
      ]);

      const todo = [
        ...snapPdf.docs.map(d => d.data()),
        ...snapImg.docs.map(d => d.data()),
      ].filter(a => !a.aiDescription && a.storageUrl);

      // Sortierung: PDFs zuerst, dann Print-Bilder, dann reguläre Bilder
      todo.sort((a, b) => {
        const rank = x => x.kind === 'pdf' ? 0 : x.area === 'print' ? 1 : 2;
        return rank(a) - rank(b);
      });

      const pdfs   = todo.filter(a => a.kind === 'pdf').length;
      const prints = todo.filter(a => a.kind === 'image' && a.area === 'print').length;
      const photos = todo.filter(a => a.kind === 'image' && a.area !== 'print').length;

      addLog(`${todo.length} Assets ohne KI-Beschreibung: ${pdfs} PDFs · ${prints} Print-Bilder · ${photos} Fotos`);
      setProgress({ done: 0, total: todo.length, errors: 0 });

      if (todo.length === 0) {
        addLog('✓ Alle Assets haben bereits eine KI-Beschreibung.', 'success');
        setStatus('done'); return;
      }

      // 3. Sequenziell verarbeiten
      let done = 0, errors = 0;
      for (const asset of todo) {
        if (stopRef.current) { addLog('— Abgebrochen.', 'warn'); break; }

        const fn   = pickFn(asset);
        const name = asset.title || asset.id;
        addLog(`→ ${typeLabel(asset)} ${name}`);
        try {
          const desc = await fn(asset.storageUrl);
          if (desc) {
            await window.tenantCol('assets').doc(asset.id).update({ aiDescription: desc });
            addLog(`  ✓ ${desc.slice(0, 90)}${desc.length > 90 ? '…' : ''}`, 'success');
          } else {
            addLog(`  ○ Kein Inhalt extrahierbar (leeres Dokument?).`, 'warn');
          }
        } catch (e) {
          errors++;
          addLog(`  ✗ Fehler: ${e.message}`, 'error');
        }
        done++;
        setProgress({ done, total: todo.length, errors });
        await new Promise(r => setTimeout(r, 350)); // Rate-Limit-Schutz
      }

      addLog(`\nFertig — ${done} verarbeitet, ${errors} Fehler.`, errors === 0 ? 'success' : 'warn');
      setStatus('done');
    } catch (e) {
      addLog(`✗ Unerwarteter Fehler: ${e.message}`, 'error');
      setStatus('error');
    }
  }

  const colMap = { info: 'var(--fg-2)', success: '#5cc9a3', warn: '#ebc745', error: '#f05e69' };
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>KI-Beschreibungen generieren</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
          Nur Assets <em>ohne</em> vorhandene KI-Beschreibung werden verarbeitet.<br/>
          <strong>PDFs</strong> — PDF.js extrahiert Text (S. 1–3), GPT liest Headlines/Begriffe<br/>
          <strong>Print-Bilder</strong> — Vision-API mit OCR-Fokus: Texte, Slogans, Kampagnentitel<br/>
          <strong>Fotos</strong> — Vision-API mit Bildbeschreibungs-Prompt
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          className={'btn' + (status === 'running' ? ' ghost' : ' primary')}
          onClick={runBatch}
          style={{ minWidth: 140 }}
        >
          {status === 'running' ? '⏹ Stoppen' : '▶ Batch starten'}
        </button>
        {progress.total > 0 && (
          <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            {progress.done} / {progress.total} ({pct}%) · {progress.errors} Fehler
          </span>
        )}
      </div>

      {progress.total > 0 && (
        <div style={{ height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct + '%', background: progress.errors > 0 ? '#ebc745' : '#5cc9a3', transition: 'width 0.3s', borderRadius: 2 }} />
        </div>
      )}

      {log.length > 0 && (
        <div ref={logRef} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 6, padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7, maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {log.map((l, i) => (
            <div key={i} style={{ color: colMap[l.type] || 'var(--fg-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l.msg}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main DevPanel ──────────────────────────────────────────────────────────

function DevPanel({ open, onClose }) {
  const [tab, setTab] = useStateDP('list');
  const [requests, setRequests] = useStateDP([]);
  const [newTitle, setNewTitle] = useStateDP('');
  const [newText, setNewText] = useStateDP('');
  const [filter, setFilter] = useStateDP('open');
  const titleInputRef = useRefDP(null);

  const isDevMode = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:');

  // When opened as file:// the relative fetch('/api/...') won't reach localhost — use absolute URL
  const API_BASE = (typeof window !== 'undefined' && window.location.protocol === 'file:')
    ? 'http://localhost:8080'
    : '';

  /* ── Git state ── */
  const [gitCommits, setGitCommits]       = useStateDP([]);
  const [gitDirty, setGitDirty]           = useStateDP(false);
  const [gitLoading, setGitLoading]       = useStateDP(false);
  const [gitPushMsg, setGitPushMsg]       = useStateDP('');
  const [gitPushing, setGitPushing]       = useStateDP(false);
  const [gitRestoring, setGitRestoring]   = useStateDP(null);
  const [confirmRestore, setConfirmRestore] = useStateDP(null);
  const [gitError, setGitError]           = useStateDP(null);
  const [gitSuccess, setGitSuccess]       = useStateDP(null);
  const [expandedCommits, setExpandedCommits] = useStateDP(new Set());
  const gitSuccessTimer = useRefDP(null);

  /* ── Auto-commit message from diff ── */
  const [msgGenerating, setMsgGenerating] = useStateDP(false);

  async function generateCommitMsg() {
    if (msgGenerating) return;
    setMsgGenerating(true);
    try {
      const res  = await fetch(API_BASE + '/api/git/diff');
      const data = await res.json();
      if (!data.ok || !data.files.length) { setMsgGenerating(false); return; }

      const files = data.files;

      // Categorise by file name
      const label = f => {
        const name = f.file.split('/').pop();
        if (name === 'index.html')    return null; // captured separately
        if (name.endsWith('.jsx'))    return name.replace('.jsx', '');
        if (name === 'server.js')     return 'server';
        if (name.endsWith('.json'))   return name;
        if (name.endsWith('.css'))    return name;
        return name;
      };

      const jsx    = files.filter(f => f.file.endsWith('.jsx'));
      const html   = files.filter(f => f.file === 'index.html');
      const server = files.filter(f => f.file === 'server.js');
      const other  = files.filter(f =>
        !f.file.endsWith('.jsx') && f.file !== 'index.html' && f.file !== 'server.js'
      );

      const bullets = [];
      if (jsx.length)    bullets.push('- ' + jsx.map(f => label(f)).join(', ') + ': aktualisiert');
      if (server.length) bullets.push('- server: API-Endpunkte aktualisiert');
      if (html.length)   bullets.push('- index.html: Cache-Buster aktualisiert');
      if (other.length)  bullets.push('- ' + other.map(f => f.file).join(', '));

      setGitPushMsg(bullets.join('\n'));
    } catch (_) {
      setGitPushMsg('- Änderungen aktualisiert');
    } finally {
      setMsgGenerating(false);
    }
  }

  /* ── Direct deploy ── */
  const [deployState,  setDeployState]  = useStateDP('idle'); // idle|running|success|error
  const [deployLog,    setDeployLog]    = useStateDP('');

  async function runDeploy() {
    if (deployState === 'running') return;
    setDeployState('running'); setDeployLog('');
    try {
      const res = await fetch(API_BASE + '/api/deploy', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setDeployState('success');
        setDeployLog(data.output || '');
      } else {
        setDeployState('error');
        setDeployLog(data.error || 'Deploy fehlgeschlagen');
      }
    } catch (_) {
      setDeployState('error');
      setDeployLog('Netzwerkfehler — läuft der Dev-Server?');
    }
  }

  /* ── CI deploy status ── */
  const [ciState, setCiState]       = useStateDP('idle');
  const [ciRunUrl, setCiRunUrl]     = useStateDP(null);
  const [ciApiError, setCiApiError] = useStateDP(null);
  const ciIntervalRef = useRefDP(null);
  const ciTimeoutRef  = useRefDP(null);
  const ciPollCount   = useRefDP(0);
  const ciPushTs      = useRefDP(0);

  function stopCiPoll() {
    if (ciIntervalRef.current) { clearInterval(ciIntervalRef.current); ciIntervalRef.current = null; }
    if (ciTimeoutRef.current)  { clearTimeout(ciTimeoutRef.current);   ciTimeoutRef.current  = null; }
  }

  async function pollCiOnce(pushTimestamp, ignoreTimestamp = false) {
    try {
      const res = await fetch(API_BASE + '/api/git/actions-status');
      if (!res.ok) { setCiState('api_error'); setCiApiError(`HTTP ${res.status}`); stopCiPoll(); return; }
      const data = await res.json();
      if (!data.ok) { setCiState('api_error'); setCiApiError(data.error ?? 'gh nicht gefunden'); stopCiPoll(); return; }
      if (!data.run) return;
      if (!ignoreTimestamp) {
        const runStart = new Date(data.run.createdAt).getTime();
        if (runStart < pushTimestamp - 90000) return;
      }
      setCiRunUrl(data.run.url);
      if (data.run.status === 'completed') {
        stopCiPoll();
        setCiState(data.run.conclusion === 'success' ? 'success' : 'failure');
      } else {
        setCiState(data.run.status === 'in_progress' ? 'in_progress' : 'queued');
      }
    } catch (_) { /* keep polling */ }
  }

  function startCiPolling(pushTimestamp) {
    stopCiPoll();
    ciPollCount.current = 0;
    ciPushTs.current    = pushTimestamp;
    setCiState('queued'); setCiRunUrl(null); setCiApiError(null);
    ciTimeoutRef.current = setTimeout(() => {
      ciTimeoutRef.current = null;
      pollCiOnce(pushTimestamp);
      ciIntervalRef.current = setInterval(() => {
        ciPollCount.current += 1;
        if (ciPollCount.current > 30) { stopCiPoll(); return; }
        pollCiOnce(pushTimestamp);
      }, 12000);
    }, 6000);
  }

  /* ── Docs state ── */
  const [docsContent,    setDocsContent]    = useStateDP(null);
  const [docsUpdatedAt,  setDocsUpdatedAt]  = useStateDP(null);
  const [docsGenerating, setDocsGenerating] = useStateDP(false);
  const [docsNotes,      setDocsNotes]      = useStateDP([]);
  const [docsNoteInput,  setDocsNoteInput]  = useStateDP('');
  const docsNoteRef = useRefDP(null);

  async function loadGitLog() {
    setGitLoading(true); setGitError(null);
    try {
      const res = await fetch(API_BASE + '/api/git/log');
      const data = await res.json();
      if (data.ok) { setGitCommits(data.commits); setGitDirty(data.dirty); return data.commits; }
      else { setGitError(data.error ?? 'Unbekannter Fehler'); }
    } catch (_) {
      setGitError('Git-API nicht erreichbar — läuft der Dev-Server?');
    } finally {
      setGitLoading(false);
    }
    return [];
  }

  function showSuccess(msg) {
    setGitSuccess(msg);
    if (gitSuccessTimer.current) clearTimeout(gitSuccessTimer.current);
    gitSuccessTimer.current = setTimeout(() => setGitSuccess(null), 3000);
  }

  async function gitPush() {
    if (gitPushing) return;
    setGitPushing(true); setGitError(null);
    try {
      const message = gitPushMsg.trim() || `Stand ${new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
      const res = await fetch(API_BASE + '/api/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, notes: '' }),
      });
      const data = await res.json();
      if (data.ok) {
        setGitPushMsg('');
        if (data.pushed !== false) {
          startCiPolling(Date.now());
        } else {
          showSuccess('✓ Gesichert — Stand war bereits aktuell, kein Deploy nötig');
        }
        loadGitLog();
      } else {
        setGitError(data.error ?? 'Push fehlgeschlagen');
      }
    } catch (_) {
      setGitError('Netzwerkfehler beim Push');
    } finally {
      setGitPushing(false);
    }
  }

  async function gitRestore(hash) {
    setGitRestoring(hash); setGitError(null); setConfirmRestore(null);
    try {
      const res = await fetch(API_BASE + '/api/git/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash }),
      });
      const data = await res.json();
      if (data.ok) {
        showSuccess('✓ Wiederhergestellt — Seite wird neu geladen…');
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setGitError(data.error ?? 'Restore fehlgeschlagen');
      }
    } catch (_) {
      setGitError('Netzwerkfehler beim Restore');
    } finally {
      setGitRestoring(null);
    }
  }

  useEffectDP(() => {
    if (tab === 'git') loadGitLog();
  }, [tab]);

  useEffectDP(() => {
    const unsub = DP_APP_DOCS_REF().onSnapshot((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (typeof d.content === 'string') setDocsContent(d.content);
        if (typeof d.updatedAt === 'number') setDocsUpdatedAt(d.updatedAt);
        if (Array.isArray(d.notes)) setDocsNotes(d.notes);
      }
    });
    return unsub;
  }, []);

  async function addDocsNote() {
    const note = docsNoteInput.trim();
    if (!note) return;
    const next = [...docsNotes, note];
    setDocsNoteInput('');
    await DP_APP_DOCS_REF().set({ notes: next }, { merge: true });
  }

  async function deleteDocsNote(idx) {
    const next = docsNotes.filter((_, i) => i !== idx);
    await DP_APP_DOCS_REF().set({ notes: next }, { merge: true });
  }

  useEffectDP(() => {
    const unsub = DP_DOC_REF().onSnapshot((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (Array.isArray(d.requests)) {
          const sorted = d.requests.sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            const pa = (a.priority ?? 'none') === 'high' ? 0 : 1;
            const pb = (b.priority ?? 'none') === 'high' ? 0 : 1;
            if (pa !== pb) return pa - pb;
            return b.createdAt - a.createdAt;
          });
          setRequests(sorted);
        }
      }
    });
    return unsub;
  }, []);

  useEffectDP(() => {
    if (open) setTab('list');
  }, [open]);

  useEffectDP(() => {
    return () => stopCiPoll();
  }, []);

  const openCount = requests.filter((r) => !r.done).length;
  const doneCount = requests.filter((r) => r.done).length;
  const canAdd = newTitle.trim() || newText.trim();

  async function addRequest() {
    if (!canAdd) return;
    const next = [
      { id: dpUid(), title: newTitle.trim(), text: newText.trim(), done: false, createdAt: Date.now(), priority: 'none' },
      ...requests,
    ];
    setNewTitle(''); setNewText('');
    setRequests(next);
    await dpPersist(next);
    setTab('list');
  }

  async function toggleDone(id) {
    const next = requests.map((r) => r.id === id ? { ...r, done: !r.done } : r);
    setRequests(next);
    await dpPersist(next);
  }

  async function deleteRequest(id) {
    const next = requests.filter((r) => r.id !== id);
    setRequests(next);
    await dpPersist(next);
  }

  async function updateRequest(id, title, text) {
    const next = requests.map((r) => r.id === id ? { ...r, title, text } : r);
    setRequests(next);
    await dpPersist(next);
  }

  async function cyclePriority(id) {
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    const next_p = (req.priority ?? 'none') === 'none' ? 'high' : 'none';
    const next = requests.map((r) => r.id === id ? { ...r, priority: next_p } : r);
    setRequests(next);
    await dpPersist(next);
  }

  const filtered = requests.filter((r) =>
    filter === 'all' ? true : filter === 'open' ? !r.done : r.done,
  );

  const fieldLabel = {
    display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: 7,
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'oklch(0.15 0.02 60 / 0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--panel)', border: '1px solid var(--line-strong)', width: '100%', maxWidth: 900, height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 100px rgba(0,0,0,0.25)' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 28px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <DPIconCode />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em' }}>Feature Requests</div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', marginTop: 2 }}>
              {openCount} offen · {doneCount} erledigt · gespeichert in Firestore
            </div>
          </div>
          <button onClick={onClose} style={{ all: 'unset', cursor: 'pointer', fontSize: 22, color: 'var(--muted)', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', paddingLeft: 20, flexShrink: 0, background: 'var(--bg)' }}>
          <DPTab label="Neue Idee"    active={tab === 'new'}  onClick={() => setTab('new')} />
          <DPTab label="Übersicht"   active={tab === 'list'} count={openCount} onClick={() => setTab('list')} />
          <DPTab label="GitHub"      active={tab === 'git'}  onClick={() => setTab('git')} />
          <DPTab label="KI-Batch"      active={tab === 'ki'}   onClick={() => setTab('ki')} />
          <DPTab label="Dokumentation" active={tab === 'docs'} onClick={() => setTab('docs')} />
        </div>

        {/* ── Tab: Neue Idee ── */}
        {tab === 'new' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={fieldLabel}>Titel *</label>
              <input
                ref={titleInputRef}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('dp-textarea')?.focus(); } }}
                placeholder="Kurze Bezeichnung des Features…"
                style={{ width: '100%', padding: '10px 14px', fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', fontFamily: 'inherit', border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--fg)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={fieldLabel}>Beschreibung</label>
              <textarea
                id="dp-textarea"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addRequest(); } }}
                rows={8}
                placeholder="Detailliertere Beschreibung der Idee… (optional)"
                style={{ width: '100%', resize: 'vertical', padding: '12px 14px', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6, border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--fg)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--faint)' }}>⌘↵ speichern</span>
              <button
                onClick={addRequest}
                disabled={!canAdd}
                style={{ all: 'unset', cursor: canAdd ? 'pointer' : 'not-allowed', padding: '11px 24px', background: 'var(--fg)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, opacity: canAdd ? 1 : 0.4 }}
              >
                Idee speichern →
              </button>
            </div>
          </div>
        )}

        {/* ── Tab: Übersicht ── */}
        {tab === 'list' && (
          <>
            <div style={{ padding: '10px 28px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {['all', 'open', 'done'].map((f) => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  all: 'unset', cursor: 'pointer', padding: '4px 12px', fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  border: `1px solid ${filter === f ? 'var(--fg)' : 'var(--line-strong)'}`,
                  background: filter === f ? 'var(--fg)' : 'transparent',
                  color: filter === f ? 'var(--bg)' : 'var(--muted)',
                }}>
                  {f === 'all' ? `Alle · ${requests.length}` : f === 'open' ? `Offen · ${openCount}` : `Erledigt · ${doneCount}`}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--faint)', letterSpacing: '0.06em' }}>Prio-Badge klicken zum Markieren</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  {requests.length === 0
                    ? 'Noch keine Feature-Ideen. Unter „Neue Idee" eintragen.'
                    : 'Keine Einträge in dieser Ansicht.'}
                </div>
              ) : filtered.map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  onToggle={() => toggleDone(req.id)}
                  onDelete={() => deleteRequest(req.id)}
                  onUpdate={(title, text) => updateRequest(req.id, title, text)}
                  onPriority={() => cyclePriority(req.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Tab: GitHub ── */}
        {tab === 'git' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {gitError && (
              <div style={{ padding: '10px 14px', background: 'oklch(0.96 0.03 25)', border: '1px solid oklch(0.75 0.12 25)', fontSize: 12, color: 'oklch(0.42 0.15 25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span>{gitError}</span>
                <button onClick={() => setGitError(null)} style={{ all: 'unset', cursor: 'pointer', fontSize: 16, color: 'oklch(0.52 0.15 25)', lineHeight: 1 }}>×</button>
              </div>
            )}

            {ciState !== 'idle' && (() => {
              const isRunning = ciState === 'queued' || ciState === 'in_progress';
              const isSuccess = ciState === 'success';
              const isFailure = ciState === 'failure';
              const isApiErr  = ciState === 'api_error';
              const bg     = isSuccess ? 'oklch(0.96 0.04 145)' : isFailure || isApiErr ? 'oklch(0.96 0.03 25)' : 'oklch(0.97 0.02 260)';
              const border = isSuccess ? 'oklch(0.75 0.10 145)' : isFailure || isApiErr ? 'oklch(0.75 0.12 25)' : 'oklch(0.75 0.10 260)';
              const color  = isSuccess ? 'oklch(0.40 0.12 145)' : isFailure || isApiErr ? 'oklch(0.42 0.15 25)' : 'oklch(0.38 0.12 260)';
              return (
                <div style={{ padding: '10px 14px', fontSize: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, background: bg, border: `1px solid ${border}`, color }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {isRunning && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                        </svg>
                      )}
                      {ciState === 'queued'      && '✓ Gepusht — GitHub Actions startet…'}
                      {ciState === 'in_progress' && '✓ Gepusht — Build & Deploy läuft…'}
                      {ciState === 'success'     && '✓ Deployed — Kunden sehen die neue Version'}
                      {ciState === 'failure'     && '✗ Deploy fehlgeschlagen (Build-Fehler)'}
                      {isApiErr                  && `⚠ CI-Status konnte nicht abgefragt werden${ciApiError ? ` (${ciApiError})` : ''}`}
                    </span>
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {isRunning && (
                      <button onClick={() => pollCiOnce(ciPushTs.current, true)}
                        style={{ all: 'unset', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', opacity: 0.7, textDecoration: 'underline' }}>
                        jetzt prüfen
                      </button>
                    )}
                    {ciRunUrl && (
                      <a href={ciRunUrl} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'inherit', opacity: 0.8, textDecoration: 'underline', letterSpacing: '0.04em' }}>
                        Details →
                      </a>
                    )}
                    {!isRunning && (
                      <button onClick={() => { setCiState('idle'); setCiApiError(null); }} style={{ all: 'unset', cursor: 'pointer', fontSize: 16, lineHeight: 1, opacity: 0.5 }}>×</button>
                    )}
                  </span>
                </div>
              );
            })()}

            {gitSuccess && ciState === 'idle' && (
              <div style={{ padding: '10px 14px', background: 'oklch(0.96 0.04 145)', border: '1px solid oklch(0.75 0.10 145)', fontSize: 12, color: 'oklch(0.40 0.12 145)' }}>
                {gitSuccess}
              </div>
            )}

            {/* Push section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)' }}>
                  Aktuellen Stand sichern
                </div>
                {gitDirty && (
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 8px', background: 'oklch(0.62 0.15 70 / 0.12)', color: 'oklch(0.52 0.14 70)', border: '1px solid oklch(0.62 0.15 70 / 0.35)', letterSpacing: '0.06em' }}>
                    ● UNGESICHERTE ÄNDERUNGEN
                  </span>
                )}
                {!gitDirty && gitCommits.length > 0 && (
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 8px', background: 'oklch(0.45 0.13 145 / 0.08)', color: 'oklch(0.45 0.13 145)', border: '1px solid oklch(0.45 0.13 145 / 0.30)', letterSpacing: '0.06em' }}>
                    ✓ SAUBER
                  </span>
                )}
              </div>
              {isDevMode ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <textarea
                          value={gitPushMsg}
                          onChange={(e) => setGitPushMsg(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); gitPush(); } }}
                          rows={gitPushMsg.includes('\n') ? Math.max(3, gitPushMsg.split('\n').length + 1) : 1}
                          placeholder={`Stand ${new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                          style={{ width: '100%', resize: 'none', padding: '10px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.6, border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--fg)', outline: 'none', boxSizing: 'border-box' }}
                        />
                        <button
                          onClick={generateCommitMsg}
                          disabled={msgGenerating}
                          title="Commit-Nachricht aus Änderungen generieren"
                          style={{ all: 'unset', cursor: msgGenerating ? 'not-allowed' : 'pointer', position: 'absolute', bottom: 8, right: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: msgGenerating ? 'var(--faint)' : 'var(--accent)', letterSpacing: '0.04em', padding: '2px 6px', border: '1px solid var(--accent)', opacity: msgGenerating ? 0.5 : 1, background: 'var(--bg)' }}
                        >
                          {msgGenerating ? '…' : '✦ Auto'}
                        </button>
                      </div>
                      <button
                        onClick={gitPush}
                        disabled={gitPushing}
                        style={{ all: 'unset', cursor: gitPushing ? 'not-allowed' : 'pointer', padding: '10px 20px', background: gitPushing ? 'var(--line-strong)' : 'var(--fg)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, flexShrink: 0, opacity: gitPushing ? 0.6 : 1, transition: 'background 120ms', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}
                      >
                        {gitPushing ? 'Sichern…' : '↑ Sichern & Push'}
                      </button>
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--faint)' }}>
                      ✦ Auto generiert Bullets aus geänderten Dateien · ⌘↵ zum Pushen
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--line-strong)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  Sichern & Push ist nur im lokalen Entwicklungsserver verfügbar.<br />
                  <span style={{ color: 'var(--faint)' }}>Git-API nicht verfügbar in dieser Umgebung.</span>
                </div>
              )}
            </div>

            {/* Deploy section */}
            {isDevMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)' }}>
                    Firebase Hosting deployen
                  </div>
                  {deployState === 'success' && (
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 8px', background: 'oklch(0.45 0.13 145 / 0.08)', color: 'oklch(0.45 0.13 145)', border: '1px solid oklch(0.45 0.13 145 / 0.30)', letterSpacing: '0.06em' }}>
                      ✓ LIVE
                    </span>
                  )}
                  {deployState === 'error' && (
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 8px', background: 'oklch(0.52 0.18 25 / 0.08)', color: 'oklch(0.52 0.18 25)', border: '1px solid oklch(0.52 0.18 25 / 0.30)', letterSpacing: '0.06em' }}>
                      ✗ FEHLER
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, fontSize: 11, color: 'var(--faint)', lineHeight: 1.5 }}>
                    Veröffentlicht alle lokalen Dateien auf{' '}
                    <a href="https://picpop-bilddatenbank.web.app" target="_blank" rel="noreferrer"
                      style={{ color: 'var(--muted)', textDecoration: 'underline' }}>
                      picpop-bilddatenbank.web.app
                    </a>
                    {' '}über Firebase CLI.
                  </div>
                  <button
                    onClick={runDeploy}
                    disabled={deployState === 'running'}
                    style={{ all: 'unset', cursor: deployState === 'running' ? 'not-allowed' : 'pointer', padding: '10px 20px', background: deployState === 'running' ? 'var(--line-strong)' : deployState === 'success' ? 'oklch(0.45 0.13 145)' : deployState === 'error' ? 'oklch(0.52 0.18 25)' : 'var(--fg)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, flexShrink: 0, opacity: deployState === 'running' ? 0.6 : 1, transition: 'background 120ms', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {deployState === 'running' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                    )}
                    {deployState === 'idle'    && '🚀 Jetzt deployen'}
                    {deployState === 'running' && 'Deployt…'}
                    {deployState === 'success' && '✓ Nochmals deployen'}
                    {deployState === 'error'   && '↻ Erneut versuchen'}
                  </button>
                </div>

                {(deployState === 'success' || deployState === 'error') && deployLog && (
                  <div style={{ background: 'var(--bg)', border: `1px solid ${deployState === 'success' ? 'oklch(0.45 0.13 145 / 0.25)' : 'oklch(0.52 0.18 25 / 0.25)'}`, padding: '10px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', color: deployState === 'success' ? 'oklch(0.40 0.12 145)' : 'oklch(0.50 0.14 25)', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 180, overflowY: 'auto' }}>
                    {deployLog.split('\n').slice(-20).join('\n')}
                  </div>
                )}
                {deployState === 'success' && (
                  <div style={{ fontSize: 11, color: 'oklch(0.40 0.12 145)', fontFamily: 'var(--font-mono)' }}>
                    ✓ Live auf{' '}
                    <a href="https://picpop-bilddatenbank.web.app" target="_blank" rel="noreferrer"
                      style={{ color: 'inherit', fontWeight: 500 }}>
                      picpop-bilddatenbank.web.app
                    </a>
                    {' '}— Kunden sehen jetzt die aktuelle Version.
                  </div>
                )}
              </div>
            )}

            {/* Commit list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)' }}>
                  Letzte Stände
                </div>
                <button
                  onClick={loadGitLog}
                  disabled={gitLoading}
                  style={{ all: 'unset', cursor: gitLoading ? 'not-allowed' : 'pointer', fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
                >
                  <DPIconRefresh />
                  Aktualisieren
                </button>
              </div>

              {gitLoading && gitCommits.length === 0 && (
                <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>Lade…</div>
              )}
              {!gitLoading && gitCommits.length === 0 && !gitError && (
                <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>
                  {isDevMode ? 'Keine Commits gefunden' : 'Git-API nicht verfügbar — statische Datei-Umgebung'}
                </div>
              )}

              {gitCommits.map((c, i) => {
                const isFirst      = i === 0;
                const isConfirming = confirmRestore === c.hash;
                const isRestoring  = gitRestoring === c.hash;
                const isExpanded   = expandedCommits.has(c.hash);
                const hasBody      = !!c.body?.trim();
                const toggleExpand = () => setExpandedCommits((prev) => {
                  const next = new Set(prev);
                  next.has(c.hash) ? next.delete(c.hash) : next.add(c.hash);
                  return next;
                });
                return (
                  <div
                    key={c.hash}
                    style={{
                      borderTop: i === 0 ? '1px solid var(--line-strong)' : '1px solid var(--line)',
                      borderBottom: i === gitCommits.length - 1 ? '1px solid var(--line-strong)' : 'none',
                      background: isFirst ? 'oklch(0.45 0.13 145 / 0.04)' : 'var(--panel)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: isFirst ? 'oklch(0.45 0.13 145)' : 'var(--faint)', letterSpacing: '0.04em' }}>
                          {c.hash.slice(0, 7)}
                        </span>
                        {isFirst && (
                          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'oklch(0.45 0.13 145)', letterSpacing: '0.06em', padding: '1px 5px', border: '1px solid oklch(0.45 0.13 145 / 0.35)', background: 'oklch(0.45 0.13 145 / 0.08)' }}>
                            HEAD
                          </span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          onClick={toggleExpand}
                          style={{ fontSize: 13, color: 'var(--fg)', fontWeight: isFirst ? 500 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <span style={{ flex: 1, minWidth: 0, overflow: isExpanded ? 'visible' : 'hidden', textOverflow: isExpanded ? 'clip' : 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap', wordBreak: 'break-word' }}>
                            {c.subject}
                          </span>
                          {hasBody && <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0, userSelect: 'none' }}>{isExpanded ? '▴' : '▾'}</span>}
                        </div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--faint)', marginTop: 2 }}>
                          {dpFmtDate(c.date)}
                        </div>
                      </div>
                      {!isFirst && (
                        isConfirming ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, color: 'oklch(0.52 0.18 25)', whiteSpace: 'nowrap' }}>Sicher?</span>
                            <button
                              onClick={() => gitRestore(c.hash)}
                              disabled={isRestoring}
                              style={{ all: 'unset', cursor: 'pointer', padding: '4px 10px', background: 'oklch(0.52 0.18 25)', color: 'white', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}
                            >{isRestoring ? '…' : 'Ja, wiederherstellen'}</button>
                            <button onClick={() => setConfirmRestore(null)} style={{ all: 'unset', cursor: 'pointer', fontSize: 16, color: 'var(--muted)', lineHeight: 1, padding: '0 4px' }}>×</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRestore(c.hash)}
                            style={{ all: 'unset', cursor: 'pointer', padding: '5px 12px', border: '1px solid var(--line-strong)', fontSize: 11, color: 'var(--muted)', flexShrink: 0, whiteSpace: 'nowrap', transition: 'border-color 120ms, color 120ms' }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'oklch(0.52 0.18 25)'; e.currentTarget.style.color = 'oklch(0.52 0.18 25)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line-strong)'; e.currentTarget.style.color = 'var(--muted)'; }}
                          >↩ Wiederherstellen</button>
                        )
                      )}
                    </div>
                    {isExpanded && hasBody && (
                      <div style={{ padding: '0 14px 12px 50px' }}>
                        <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 12 }}>
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {(c.body ?? '').replace(/\\n/g, '\n').split('\n').filter((l) => l.trim()).map((line, li) => (
                              <li key={li} style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--muted)', display: 'flex', gap: 7, alignItems: 'baseline' }}>
                                <span style={{ flexShrink: 0, color: 'var(--accent)', fontSize: 10 }}>▸</span>
                                <span>{line.replace(/^[-•*]\s*/, '')}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {gitCommits.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--faint)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'oklch(0.52 0.18 25)', fontWeight: 500 }}>Achtung:</strong> Wiederherstellen überschreibt alle lokalen Änderungen unwiderruflich und force-pusht auf GitHub.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: KI-Batch ── */}
        {tab === 'ki' && <KiBatchTab />}

        {/* ── Tab: Dokumentation ── */}
        {tab === 'docs' && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 260px', minHeight: 0, overflow: 'hidden' }}>
            {/* Left: documentation */}
            <div style={{ overflowY: 'auto', padding: '24px 32px', borderRight: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', letterSpacing: '0.08em' }}>
                  {docsUpdatedAt
                    ? `Stand: ${new Date(docsUpdatedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                    : 'Noch nicht generiert'}
                </div>
                <button
                  onClick={async () => {
                    if (docsGenerating) return;
                    setDocsGenerating(true);
                    setTimeout(() => setDocsGenerating(false), 1200);
                    alert('KI-Generierung ist in dieser Umgebung nicht verfügbar. Dokumentation kann manuell im Hinweise-Panel gepflegt werden.');
                  }}
                  disabled={docsGenerating}
                  style={{ all: 'unset', cursor: docsGenerating ? 'not-allowed' : 'pointer', fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5, opacity: docsGenerating ? 0.5 : 1 }}
                  onMouseEnter={(e) => { if (!docsGenerating) e.currentTarget.style.color = 'var(--fg)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
                >
                  <DPIconRefresh />
                  {docsGenerating ? 'Generiert…' : 'Neu generieren'}
                </button>
              </div>

              {!docsContent && !docsGenerating && (
                <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
                  Noch keine Dokumentation vorhanden.<br />
                  Nutze das Hinweise-Panel rechts, um Inhalt hinzuzufügen.
                </div>
              )}
              {docsGenerating && !docsContent && (
                <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>KI generiert…</div>
              )}
              {docsContent && (
                <div>
                  {docsContent.split(/\n(?=## )/).map((section, si) => {
                    const lines = section.trim().split('\n');
                    const heading = (lines[0] ?? '').replace(/^## /, '').trim();
                    const bullets = lines.slice(1).filter((l) => l.trim());
                    return (
                      <div key={si} style={{ borderTop: si === 0 ? '1px solid var(--line-strong)' : '1px solid var(--line)', padding: '14px 0', display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, alignItems: 'start' }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: 2 }}>{heading}</div>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {bullets.map((line, li) => (
                            <li key={li} style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--fg)', display: 'flex', gap: 7, alignItems: 'baseline' }}>
                              <span style={{ flexShrink: 0, color: 'var(--accent)', fontSize: 9 }}>▸</span>
                              <span>{line.replace(/^[-–•*]\s*/, '')}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: notes */}
            <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', minHeight: 0 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', padding: '16px 16px 10px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
                Hinweise
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {docsNotes.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--faint)', fontStyle: 'italic', padding: '8px 4px' }}>
                    Noch keine Hinweise.
                  </div>
                )}
                {docsNotes.map((note, idx) => (
                  <div key={idx} style={{ background: 'var(--panel)', border: '1px solid var(--line-strong)', padding: '8px 10px', fontSize: 12, lineHeight: 1.5, color: 'var(--fg)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ flex: 1 }}>{note}</span>
                    <button
                      onClick={() => deleteDocsNote(idx)}
                      style={{ all: 'unset', cursor: 'pointer', color: 'var(--faint)', fontSize: 14, lineHeight: 1, flexShrink: 0, padding: '0 2px' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#b03a2e'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--faint)'; }}
                    >×</button>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--line)', padding: '10px 12px', flexShrink: 0 }}>
                <textarea
                  ref={docsNoteRef}
                  value={docsNoteInput}
                  onChange={(e) => setDocsNoteInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addDocsNote(); } }}
                  rows={3}
                  placeholder="Hinweis eingeben… (⌘↵ senden)"
                  style={{ width: '100%', resize: 'none', padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', lineHeight: 1.5, border: '1px solid var(--line-strong)', background: 'var(--panel)', color: 'var(--fg)', outline: 'none', boxSizing: 'border-box' }}
                />
                <button
                  onClick={addDocsNote}
                  disabled={!docsNoteInput.trim()}
                  style={{ all: 'unset', marginTop: 6, cursor: docsNoteInput.trim() ? 'pointer' : 'not-allowed', width: '100%', textAlign: 'center', padding: '7px 0', background: docsNoteInput.trim() ? 'var(--fg)' : 'var(--line-strong)', color: docsNoteInput.trim() ? 'var(--bg)' : 'var(--muted)', fontSize: 12, fontWeight: 500, boxSizing: 'border-box', transition: 'background 120ms' }}
                >
                  Hinzufügen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

window.DevPanel = DevPanel;
