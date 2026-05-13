// Dev / Admin view — ported 1:1 from contextr AdminView
// Firebase Functions via compat SDK; CSS vars mapped to picpop tokens

const { useState: useStateAdm, useEffect: useEffectAdm, useRef: useRefAdm } = React;

// ── Callable wrappers ──────────────────────────────────────────────────────

const MASTER_ID = 'master-workspace';

const ONBOARD_OPTIONS = [
  { id: 'presets',               label: 'Vorlagen',               sub: 'Composer-Presets' },
  { id: 'collections',          label: 'Wissenssammlungen',      sub: 'Knowledge Base' },
  { id: 'documents',            label: 'Wissensdokumente',       sub: 'Texte & Dateien' },
  { id: 'languageRules',        label: 'Sprachregeln',           sub: 'Corporate Language' },
  { id: 'settings',             label: 'Concierge-Einstellungen', sub: 'Systemprompt & Modus' },
  { id: 'brainstormCollections', label: 'Brainstorm-Projekte',   sub: 'Vorlagen & Sammlungen' },
];

function getFunctions() { return firebase.app().functions('europe-west1'); }
function callable(name) { return getFunctions().httpsCallable(name); }

// ── Sub-components ─────────────────────────────────────────────────────────

function Badge({ text, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 99,
      fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
      background: color, color: 'white',
    }}>{text}</span>
  );
}

function roleBadge(role) {
  if (role === 'tenant_admin') return <Badge text="Admin" color="oklch(50% 0.15 250)" />;
  return <Badge text="Member" color="oklch(55% 0.08 220)" />;
}

function NewCustomerForm({ onCreated }) {
  const [name, setName] = useStateAdm('');
  const [busy, setBusy] = useStateAdm(false);
  const [err, setErr] = useStateAdm(null);
  const [newTenantId, setNewTenantId] = useStateAdm(null);
  const [checked, setChecked] = useStateAdm(new Set(['presets', 'languageRules']));
  const [onboarding, setOnboarding] = useStateAdm(false);
  const [onboardResult, setOnboardResult] = useStateAdm(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setErr(null); setOnboardResult(null);
    try {
      const res = await callable('createCustomer')({ name: name.trim() });
      onCreated(res.data.tenantId, name.trim());
      setNewTenantId(res.data.tenantId);
      setName('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function toggle(id) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function doOnboard() {
    if (!newTenantId || checked.size === 0) return;
    setOnboarding(true); setOnboardResult(null);
    try {
      const res = await callable('onboardTenant')({ tenantId: newTenantId, collections: [...checked] });
      const total = Object.values(res.data.results).reduce((s, n) => s + n, 0);
      setOnboardResult(`✓ ${total} Einträge übertragen`);
    } catch (e) {
      setOnboardResult(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setOnboarding(false);
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setNewTenantId(null); setOnboardResult(null); }}
          placeholder="Kundenname…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--fg)', outline: 'none' }}
        />
        <button type="submit" disabled={busy || !name.trim()}
          style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: busy ? 'not-allowed' : 'pointer', padding: '8px 16px', background: busy || !name.trim() ? 'var(--line-strong)' : 'var(--fg)', color: 'var(--bg)', fontSize: 12, fontWeight: 500, opacity: busy ? 0.6 : 1, textAlign: 'center' }}
        >{busy ? '…' : '+ Anlegen'}</button>
        {err && <span style={{ fontSize: 11, color: 'oklch(55% 0.18 25)' }}>{err}</span>}
      </form>

      {newTenantId && (
        <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--line-strong)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>
            Onboarding — aus Master-Workspace übernehmen
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ONBOARD_OPTIONS.map((opt) => (
              <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={checked.has(opt.id)} onChange={() => toggle(opt.id)}
                  style={{ accentColor: 'var(--accent)', width: 13, height: 13, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--fg)' }}>{opt.label}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{opt.sub}</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => doOnboard()} disabled={onboarding || checked.size === 0}
              style={{ all: 'unset', cursor: onboarding || checked.size === 0 ? 'not-allowed' : 'pointer', padding: '6px 14px', background: onboarding || checked.size === 0 ? 'var(--line-strong)' : 'var(--fg)', color: 'var(--bg)', fontSize: 12, fontWeight: 500, opacity: onboarding || checked.size === 0 ? 0.6 : 1 }}
            >{onboarding ? '⟳ Übertrage…' : '↓ Jetzt einrichten'}</button>
            <button onClick={() => setNewTenantId(null)}
              style={{ all: 'unset', cursor: 'pointer', fontSize: 11, color: 'var(--muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
            >Überspringen</button>
            {onboardResult && (
              <span style={{ fontSize: 11, color: onboardResult.startsWith('✓') ? 'oklch(45% 0.13 145)' : 'oklch(55% 0.18 25)' }}>
                {onboardResult}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NewUserForm({ tenantId, onCreated }) {
  const [open, setOpen] = useStateAdm(false);
  const [email, setEmail]           = useStateAdm('');
  const [password, setPassword]     = useStateAdm('');
  const [displayName, setDisplayName] = useStateAdm('');
  const [role, setRole]             = useStateAdm('tenant_member');
  const [busy, setBusy]             = useStateAdm(false);
  const [err, setErr]               = useStateAdm(null);

  async function submit(e) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true); setErr(null);
    try {
      await callable('createTenantUser')({ email, password, displayName, tenantId, role });
      setEmail(''); setPassword(''); setDisplayName(''); setRole('tenant_member');
      setOpen(false);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          all: 'unset', cursor: 'pointer',
          padding: '7px 14px', border: '1px solid var(--line-strong)',
          fontSize: 12, color: 'var(--fg)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--line)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >+ Neuer Benutzer</button>
    );
  }

  const fields = [
    { label: 'Name',     val: displayName, set: setDisplayName, type: 'text',     placeholder: 'Vollständiger Name' },
    { label: 'E-Mail',   val: email,        set: setEmail,        type: 'email',    placeholder: 'user@example.com' },
    { label: 'Passwort', val: password,     set: setPassword,     type: 'password', placeholder: 'Min. 8 Zeichen' },
  ];

  return (
    <form onSubmit={submit} style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      padding: 16, border: '1px solid var(--line-strong)', background: 'var(--panel)',
      marginBottom: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Neuer Benutzer</div>
      {fields.map(({ label, val, set, type, placeholder }) => (
        <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: 'var(--muted)', width: 60, flexShrink: 0 }}>{label}</label>
          <input
            type={type} value={val} onChange={(e) => set(e.target.value)}
            placeholder={placeholder} required={label !== 'Name'}
            style={{
              flex: 1, padding: '6px 8px', fontSize: 12,
              border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--fg)',
              outline: 'none',
            }}
          />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 11, color: 'var(--muted)', width: 60, flexShrink: 0 }}>Rolle</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{
            padding: '6px 8px', fontSize: 12,
            border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--fg)',
          }}
        >
          <option value="tenant_member">Member</option>
          <option value="tenant_admin">Admin</option>
        </select>
      </div>
      {err && <div style={{ fontSize: 11, color: 'oklch(55% 0.18 25)' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit" disabled={busy}
          style={{
            all: 'unset', cursor: busy ? 'not-allowed' : 'pointer',
            padding: '7px 16px', background: 'var(--fg)', color: 'var(--bg)',
            fontSize: 12, fontWeight: 500, opacity: busy ? 0.6 : 1,
          }}
        >{busy ? '…' : 'Erstellen'}</button>
        <button
          type="button" onClick={() => setOpen(false)}
          style={{
            all: 'unset', cursor: 'pointer',
            padding: '7px 14px', border: '1px solid var(--line-strong)',
            fontSize: 12, color: 'var(--muted)',
          }}
        >Abbrechen</button>
      </div>
    </form>
  );
}

function UserRow({ u, onRefresh }) {
  const [busy, setBusy] = useStateAdm(false);
  const [confirmDelete, setConfirmDelete] = useStateAdm(false);
  const [editing, setEditing] = useStateAdm(false);
  const [editName, setEditName] = useStateAdm(u.displayName);
  const [editEmail, setEditEmail] = useStateAdm(u.email);
  const [editPassword, setEditPassword] = useStateAdm('');
  const [editErr, setEditErr] = useStateAdm(null);

  async function toggleDisable() {
    setBusy(true);
    try { await callable('disableUser')({ uid: u.uid, disabled: !u.disabled }); onRefresh(); }
    finally { setBusy(false); }
  }

  async function doDelete() {
    setBusy(true);
    try { await callable('deleteTenantUser')({ uid: u.uid }); onRefresh(); }
    finally { setBusy(false); setConfirmDelete(false); }
  }

  async function saveEdit(e) {
    e.preventDefault();
    setBusy(true); setEditErr(null);
    try {
      const payload = { uid: u.uid };
      if (editName !== u.displayName) payload.displayName = editName;
      if (editEmail !== u.email) payload.email = editEmail;
      if (editPassword) payload.password = editPassword;
      await callable('updateTenantUser')(payload);
      setEditPassword('');
      setEditing(false);
      onRefresh();
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    padding: '5px 8px', fontSize: 12,
    border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--fg)',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  if (editing) {
    return (
      <div style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
        <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: 'var(--muted)' }}>Name</label>
            <input style={inputStyle} value={editName} onChange={(e) => setEditName(e.target.value)} />
            <label style={{ fontSize: 11, color: 'var(--muted)' }}>E-Mail</label>
            <input style={inputStyle} type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
            <label style={{ fontSize: 11, color: 'var(--muted)' }}>Passwort</label>
            <input style={inputStyle} type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Leer lassen = unverändert" />
          </div>
          {editErr && <div style={{ fontSize: 11, color: 'oklch(55% 0.18 25)' }}>{editErr}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={busy} style={{
              all: 'unset', cursor: busy ? 'not-allowed' : 'pointer',
              padding: '5px 14px', background: 'var(--fg)', color: 'var(--bg)',
              fontSize: 11, fontWeight: 500, opacity: busy ? 0.6 : 1,
            }}>{busy ? '…' : 'Speichern'}</button>
            <button type="button" onClick={() => { setEditing(false); setEditErr(null); }} style={{
              all: 'unset', cursor: 'pointer', padding: '5px 12px',
              border: '1px solid var(--line-strong)', fontSize: 11, color: 'var(--muted)',
            }}>Abbrechen</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto auto',
      alignItems: 'center', gap: 12,
      padding: '10px 0', borderBottom: '1px solid var(--line)',
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{u.displayName || '—'}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
      </div>
      <div>{roleBadge(u.role)}</div>
      <div>
        {u.disabled && <Badge text="Gesperrt" color="oklch(50% 0.18 25)" />}
      </div>
      <button
        onClick={() => { setEditName(u.displayName); setEditEmail(u.email); setEditPassword(''); setEditing(true); }}
        title="Bearbeiten"
        style={{
          all: 'unset', cursor: 'pointer',
          padding: '4px 10px', border: '1px solid var(--line-strong)',
          fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
      >Bearbeiten</button>
      <button
        onClick={toggleDisable} disabled={busy}
        style={{
          all: 'unset', cursor: busy ? 'not-allowed' : 'pointer',
          padding: '4px 10px', border: '1px solid var(--line-strong)',
          fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
      >{u.disabled ? 'Entsperren' : 'Sperren'}</button>
      {confirmDelete ? (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={doDelete} disabled={busy}
            style={{
              all: 'unset', cursor: 'pointer', padding: '4px 10px',
              background: 'oklch(50% 0.18 25)', color: 'white', fontSize: 11,
            }}
          >{busy ? '…' : 'Löschen'}</button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{ all: 'unset', cursor: 'pointer', padding: '4px 8px', fontSize: 11, color: 'var(--muted)' }}
          >✕</button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          style={{ all: 'unset', cursor: 'pointer', padding: '4px 8px', fontSize: 11, color: 'var(--muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'oklch(50% 0.18 25)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
        >✕</button>
      )}
    </div>
  );
}

function TenantDetail({ tenant, onImpersonate }) {
  const [users, setUsers] = useStateAdm([]);
  const [loading, setLoading] = useStateAdm(true);
  const [migrating, setMigrating] = useStateAdm(false);
  const [migrateResult, setMigrateResult] = useStateAdm(null);
  const refreshRef = useRefAdm(0);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await callable('listUsersForTenant')({ tenantId: tenant.id });
      setUsers(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffectAdm(() => { loadUsers(); }, [tenant.id]);

  const tick = () => { refreshRef.current++; loadUsers(); };

  const createdDate = tenant.createdAt
    ? new Date(tenant.createdAt.seconds * 1000).toLocaleDateString('de-DE')
    : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '24px 32px 20px', borderBottom: '1px solid var(--line)' }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
          Kunde · {tenant.id}
        </div>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 500 }}>{tenant.name}</h2>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Erstellt: {createdDate}</div>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => onImpersonate(tenant.id)}
            style={{
              all: 'unset', cursor: 'pointer',
              padding: '7px 16px', border: '1px solid var(--accent)',
              fontSize: 12, color: 'var(--accent)', fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-soft)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >Als Kunde anzeigen →</button>
          <button
            disabled={migrating}
            onClick={async () => {
              setMigrating(true); setMigrateResult(null);
              try {
                const res = await callable('migrateToTenant')({ tenantId: tenant.id });
                const total = Object.values(res.data.results).reduce((s, n) => s + n, 0);
                setMigrateResult(`✓ ${total} Dokumente migriert`);
              } catch (e) {
                setMigrateResult(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
              } finally {
                setMigrating(false);
              }
            }}
            style={{
              all: 'unset', cursor: migrating ? 'not-allowed' : 'pointer',
              padding: '7px 14px', border: '1px solid var(--line-strong)',
              fontSize: 12, color: 'var(--muted)', opacity: migrating ? 0.6 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={(e) => { if (!migrating) e.currentTarget.style.color = 'var(--fg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
          >{migrating ? '⟳ Migriert…' : '↑ Bestandsdaten migrieren'}</button>
          {migrateResult && (
            <span style={{ fontSize: 12, color: migrateResult.startsWith('✓') ? 'oklch(55% 0.15 145)' : 'oklch(55% 0.18 25)' }}>
              {migrateResult}
            </span>
          )}
        </div>
      </div>

      {/* Users */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>
          Benutzer
        </div>
        <NewUserForm tenantId={tenant.id} onCreated={tick} />
        {loading ? (
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', padding: '16px 0' }}>Lädt…</div>
        ) : users.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)', padding: '16px 0' }}>Noch keine Benutzer</div>
        ) : users.map((u) => (
          <UserRow key={u.uid} u={u} onRefresh={tick} />
        ))}
      </div>
    </div>
  );
}

// ── Main View ──────────────────────────────────────────────────────────────

function AdminView({ lang }) {
  const [tenants, setTenants] = useStateAdm([]);
  const [selected, setSelected] = useStateAdm(null);
  const [loading, setLoading] = useStateAdm(true);
  const [claimBusy, setClaimBusy] = useStateAdm(false);
  const [claimMsg, setClaimMsg] = useStateAdm(null);
  const [masterPopulating, setMasterPopulating] = useStateAdm(false);
  const [masterMsg, setMasterMsg] = useStateAdm(null);
  const [impersonating, setImpersonating] = useStateAdm(null);

  async function loadTenants() {
    setLoading(true);
    try {
      const res = await callable('listCustomers')();
      setTenants(res.data);
    } catch (e) {
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }

  useEffectAdm(() => { loadTenants(); }, []);

  async function populateMaster() {
    setMasterPopulating(true); setMasterMsg(null);
    try {
      await callable('ensureMasterTenant')();
      const res = await callable('migrateToTenant')({ tenantId: MASTER_ID });
      const total = Object.values(res.data.results).reduce((s, n) => s + n, 0);
      setMasterMsg(`✓ ${total} Einträge übertragen`);
    } catch (e) {
      setMasterMsg(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setMasterPopulating(false);
    }
  }

  async function bootstrapSuperadmin() {
    setClaimBusy(true); setClaimMsg(null);
    try {
      await callable('setSuperadminClaim')();
      setClaimMsg('Superadmin-Claim gesetzt. Bitte neu einloggen (Tab neu laden).');
    } catch (e) {
      setClaimMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setClaimBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Left panel — customer list */}
      <div style={{
        width: 300, flexShrink: 0,
        borderRight: '1px solid var(--line-strong)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--panel)',
      }}>

        {/* Master-Workspace button */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={async () => {
              try { await callable('ensureMasterTenant')(); } catch (_) { /* ignore */ }
              setImpersonating(MASTER_ID);
            }}
            style={{ all: 'unset', cursor: 'pointer', width: '100%', padding: '10px 14px', background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, boxSizing: 'border-box' }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Master-Workspace bearbeiten →
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => populateMaster()}
              disabled={masterPopulating}
              style={{ all: 'unset', cursor: masterPopulating ? 'not-allowed' : 'pointer', padding: '6px 12px', border: '1px solid var(--line-strong)', fontSize: 11, color: 'var(--muted)', opacity: masterPopulating ? 0.6 : 1, whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => { if (!masterPopulating) e.currentTarget.style.color = 'var(--fg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
            >{masterPopulating ? '⟳ Überträgt…' : '↑ Migrationsdaten laden'}</button>
            {masterMsg && (
              <span style={{ fontSize: 11, color: masterMsg.startsWith('✓') ? 'oklch(45% 0.13 145)' : 'oklch(55% 0.18 25)' }}>
                {masterMsg}
              </span>
            )}
          </div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--muted)', lineHeight: 1.5 }}>
            Vorlagen, Presets & Musterdaten für Onboarding
          </div>
        </div>

        <div style={{ padding: '16px 20px 12px' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>
            Kunden
          </div>
          <NewCustomerForm onCreated={(id, name) => {
            const t = { id, name, disabled: false };
            setTenants((prev) => [t, ...prev]);
            setSelected(t);
          }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
          {loading ? (
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', padding: '12px 12px' }}>Lädt…</div>
          ) : tenants.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', padding: '12px 12px' }}>Noch keine Kunden</div>
          ) : tenants.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              style={{
                all: 'unset', cursor: 'pointer', width: '100%',
                padding: '9px 12px', borderRadius: 4, boxSizing: 'border-box',
                background: selected?.id === t.id ? 'var(--accent-soft)' : 'transparent',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}
              onMouseEnter={(e) => { if (selected?.id !== t.id) e.currentTarget.style.background = 'var(--hover)'; }}
              onMouseLeave={(e) => { if (selected?.id !== t.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 13, fontWeight: selected?.id === t.id ? 500 : 400 }}>{t.name}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{t.id}</span>
            </button>
          ))}
        </div>

        {/* Bootstrap */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)' }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
            Einmalige Einrichtung
          </div>
          <button
            onClick={bootstrapSuperadmin} disabled={claimBusy}
            style={{
              all: 'unset', cursor: claimBusy ? 'not-allowed' : 'pointer',
              padding: '7px 14px', border: '1px solid var(--line-strong)',
              fontSize: 11, color: 'var(--muted)', opacity: claimBusy ? 0.6 : 1,
              display: 'inline-flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
          >{claimBusy ? '…' : 'Superadmin-Claim setzen'}</button>
          {claimMsg && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{claimMsg}</div>}
        </div>
      </div>

      {/* Right panel — tenant detail */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {impersonating && (
          <div style={{ padding: '12px 32px', background: 'var(--accent-soft)', borderBottom: '1px solid var(--accent)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--accent)' }}>
              Workspace-Ansicht: <strong>{impersonating}</strong>
            </span>
            <button onClick={() => setImpersonating(null)} style={{ all: 'unset', cursor: 'pointer', fontSize: 11, color: 'var(--accent)', border: '1px solid var(--accent)', padding: '2px 10px' }}>
              ✕ Beenden
            </button>
          </div>
        )}
        {selected ? (
          <TenantDetail
            key={selected.id}
            tenant={selected}
            onImpersonate={(id) => setImpersonating(id)}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: 13 }}>
            Kunden auswählen
          </div>
        )}
      </div>
    </div>
  );
}

window.AdminView = AdminView;
