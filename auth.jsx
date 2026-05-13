// Authentication — Firebase Auth + Login Screen + useAuth hook

const { useState: useStateLogin, useEffect: useEffectLogin } = React;

const _auth = firebase.auth();
const _googleProvider = new firebase.auth.GoogleAuthProvider();

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ tenantId }) {
  const [email,       setEmail]       = useStateLogin("");
  const [password,    setPassword]    = useStateLogin("");
  const [loading,     setLoading]     = useStateLogin(false);
  const [googleLoading, setGoogleLoading] = useStateLogin(false);
  const [error,       setError]       = useStateLogin("");
  const [showPw,      setShowPw]      = useStateLogin(false);

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await _auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      setError(friendlyError(err.code, err.message));
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    try {
      await _auth.signInWithPopup(_googleProvider);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        setError(friendlyError(err.code, err.message));
      }
      setGoogleLoading(false);
    }
  }

  function friendlyError(code, fallback) {
    switch (code) {
      case "auth/user-not-found":      return "Kein Konto mit dieser E-Mail gefunden.";
      case "auth/wrong-password":      return "Falsches Passwort.";
      case "auth/invalid-email":       return "Ungültige E-Mail-Adresse.";
      case "auth/too-many-requests":   return "Zu viele Versuche. Bitte kurz warten.";
      case "auth/invalid-credential":  return "E-Mail oder Passwort falsch.";
      case "auth/popup-blocked":       return "Popup wurde blockiert. Bitte Popup-Blocker deaktivieren.";
      default: return fallback || "Anmeldung fehlgeschlagen.";
    }
  }

  const inputStyle = {
    width: "100%", height: 38, padding: "0 11px",
    border: "1px solid var(--line-strong)", borderRadius: 4,
    background: "var(--bg)", color: "var(--fg)", fontSize: 14,
    outline: "none", boxSizing: "border-box", transition: "border-color .15s",
    fontFamily: "var(--font-sans)",
  };

  const busy = loading || googleLoading;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "var(--bg)", padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 380,
        background: "var(--panel)", border: "1px solid var(--line)",
        borderRadius: 8, boxShadow: "var(--shadow)", padding: "36px 32px",
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 34, height: 34, background: "var(--fg)", color: "var(--bg)",
            borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 17,
          }}>p</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>picpop</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
              Bilddatenbank
            </div>
          </div>
        </div>

        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4 }}>
          Anmelden
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 24 }}>
          Workspace: <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{tenantId}</span>
        </div>

        {/* ── Google button ── */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          style={{
            width: "100%", height: 38,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            background: "var(--panel)", color: "var(--fg)",
            border: "1px solid var(--line-strong)", borderRadius: 4,
            cursor: busy ? "default" : "pointer", fontSize: 13, fontWeight: 500,
            opacity: busy ? 0.6 : 1, transition: "background .15s, opacity .15s",
            marginBottom: 20,
            fontFamily: "var(--font-sans)",
          }}
          onMouseEnter={e => { if (!busy) e.currentTarget.style.background = "var(--hover)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--panel)"; }}
        >
          {googleLoading
            ? <Spinner />
            : <GoogleIcon />}
          Mit Google anmelden
        </button>

        {/* ── Divider ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.05em" }}>oder</span>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>

        {/* ── Email / Password form ── */}
        <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              E-Mail
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoFocus autoComplete="email"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = "var(--fg)"}
              onBlur={e  => e.target.style.borderColor = "var(--line-strong)"}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Passwort
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete="current-password"
                style={{ ...inputStyle, paddingRight: 38 }}
                onFocus={e => e.target.style.borderColor = "var(--fg)"}
                onBlur={e  => e.target.style.borderColor = "var(--line-strong)"}
              />
              <button
                type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, lineHeight: 1 }}
              >
                {showPw
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "var(--accent)", padding: "9px 11px", background: "var(--accent-soft)", borderRadius: 4, lineHeight: 1.4 }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={busy}
            style={{
              height: 38, background: "var(--fg)", color: "var(--bg)",
              border: "none", borderRadius: 4,
              cursor: busy ? "default" : "pointer",
              fontSize: 13, fontWeight: 600,
              opacity: busy ? 0.6 : 1,
              marginTop: 2, transition: "opacity .15s",
              fontFamily: "var(--font-sans)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
            onMouseEnter={e => { if (!busy) e.currentTarget.style.opacity = "0.82"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = busy ? "0.6" : "1"; }}
          >
            {loading ? <><Spinner /> Wird angemeldet…</> : "Anmelden"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span style={{ width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ── useAuth hook ──────────────────────────────────────────────────────────────
function useAuth() {
  const [user,      setUser]      = useStateLogin(null);
  const [authReady, setAuthReady] = useStateLogin(false);

  useEffectLogin(() => {
    const unsub = _auth.onAuthStateChanged(u => {
      setUser(u);
      window.CURRENT_USER = u || null;
      setAuthReady(true);
    });
    return unsub;
  }, []);

  function signOut() { return _auth.signOut(); }

  return { user, authReady, signOut };
}

Object.assign(window, { LoginScreen, useAuth, firebaseAuth: _auth });
