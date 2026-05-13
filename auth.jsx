// Authentication — Firebase Auth + Login Screen + useAuth hook
// Tenant ID and Firestore helpers are already set up in firebase.jsx

const { useState: useStateLogin, useEffect: useEffectLogin } = React;

const _auth = firebase.auth();

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ tenantId, onLoginSuccess }) {
  const [email,    setEmail]    = useStateLogin("");
  const [password, setPassword] = useStateLogin("");
  const [loading,  setLoading]  = useStateLogin(false);
  const [error,    setError]    = useStateLogin("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await _auth.signInWithEmailAndPassword(email, password);
      // onLoginSuccess is called by onAuthStateChanged in useAuth
    } catch (err) {
      const msg = err.code === "auth/user-not-found"     ? "Kein Konto mit dieser E-Mail gefunden."
                : err.code === "auth/wrong-password"     ? "Falsches Passwort."
                : err.code === "auth/invalid-email"      ? "Ungültige E-Mail-Adresse."
                : err.code === "auth/too-many-requests"  ? "Zu viele Versuche. Bitte warte kurz."
                : err.code === "auth/invalid-credential" ? "E-Mail oder Passwort falsch."
                : (err.message || "Anmeldung fehlgeschlagen.");
      setError(msg);
      setLoading(false);
    }
  }

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
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--muted)",
            }}>Bilddatenbank</div>
          </div>
        </div>

        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 6 }}>
          Anmelden
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 24 }}>
          Workspace: <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{tenantId}</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              E-Mail
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoFocus autoComplete="email"
              style={{
                width: "100%", height: 38, padding: "0 11px",
                border: "1px solid var(--line-strong)", borderRadius: 4,
                background: "var(--bg)", color: "var(--fg)", fontSize: 14,
                outline: "none", boxSizing: "border-box",
                transition: "border-color .15s",
              }}
              onFocus={e => e.target.style.borderColor = "var(--fg)"}
              onBlur={e  => e.target.style.borderColor = "var(--line-strong)"}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Passwort
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required autoComplete="current-password"
              style={{
                width: "100%", height: 38, padding: "0 11px",
                border: "1px solid var(--line-strong)", borderRadius: 4,
                background: "var(--bg)", color: "var(--fg)", fontSize: 14,
                outline: "none", boxSizing: "border-box",
                transition: "border-color .15s",
              }}
              onFocus={e => e.target.style.borderColor = "var(--fg)"}
              onBlur={e  => e.target.style.borderColor = "var(--line-strong)"}
            />
          </div>

          {error && (
            <div style={{
              fontSize: 12, color: "var(--accent)", padding: "9px 11px",
              background: "var(--accent-soft)", borderRadius: 4, lineHeight: 1.4,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              height: 38, background: "var(--fg)", color: "var(--bg)",
              border: "none", borderRadius: 4,
              cursor: loading ? "default" : "pointer",
              fontSize: 13, fontWeight: 600,
              opacity: loading ? 0.6 : 1,
              marginTop: 2,
              transition: "opacity .15s, transform .15s",
            }}
            onMouseEnter={e => { if (!loading) e.target.style.opacity = "0.85"; }}
            onMouseLeave={e => { if (!loading) e.target.style.opacity = "1"; }}
          >
            {loading
              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 12, height: 12, border: "1.5px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                  Wird angemeldet…
                </span>
              : "Anmelden"}
          </button>
        </form>
      </div>
    </div>
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
