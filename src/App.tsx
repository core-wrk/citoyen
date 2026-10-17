import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Page } from "../shared/contracts";
import { ApiClient } from "./lib/client";
import { useProgress } from "./hooks/useProgress";
import { Dashboard, PAGES } from "./components/Dashboard";
import { Civics } from "./components/Civics";
import { Comprehension } from "./components/Comprehension";
import { Writing } from "./components/Writing";
import { Speaking } from "./components/Speaking";
import { ErrorNotice, Heading } from "./components/ui";

function SignIn({
  client,
  onClose,
}: {
  client: ApiClient;
  onClose?: () => void;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="content-panel login-panel">
      <div className="eyebrow">CITOYEN · PRIVATE STUDY</div>
      <h1>Welcome back.</h1>
      <p>Sign in with the account invited to your study space.</p>
      <form
        className="login-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await client.signIn(email, password);
            onClose?.();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Email address
          <input
            className="login-input"
            autoComplete="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            className="login-input"
            autoComplete="current-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <ErrorNotice message={error} />
        <button className="primary-button" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {onClose && (
        <button className="text-button" onClick={onClose}>
          Continue local study
        </button>
      )}
    </section>
  );
}
function StudyApp({
  client,
  session,
}: {
  client: ApiClient;
  session: Session | null;
}) {
  const progress = useProgress(client, session?.user.id || null);
  const [page, setPage] = useState<Page>("home"),
    [modal, setModal] = useState<"help" | "account" | null>(null),
    [error, setError] = useState("");
  async function signOut() {
    const { error } = await client.auth!.auth.signOut({ scope: "local" });
    if (error) {
      setError("Sign-out could not finish. Try again when connected.");
      return;
    }
    setModal(null);
  }
  if (!progress.ready)
    return (
      <main className="standalone">
        <Heading eyebrow="PRIVATE ACCOUNT" title="Connecting your study space">
          {progress.status}
        </Heading>
        <div className="button-row">
          <button
            className="primary-button"
            onClick={() => window.location.reload()}
          >
            Retry connection
          </button>
          <button className="secondary-button" onClick={signOut}>
            Sign out
          </button>
        </div>
        <ErrorNotice message={error} />
      </main>
    );
  return (
    <>
      <div className="shell">
        <aside className="sidebar" aria-label="Main navigation">
          <a
            className="brand"
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              setPage("home");
            }}
          >
            <span className="brand-mark">
              <span />
              <span />
              <span />
            </span>
            <span>
              citoyen<span className="brand-period">.</span>
            </span>
          </a>
          <div className="side-caption">YOUR STUDY SPACE</div>
          <nav className="nav-list">
            {PAGES.map((p) => (
              <button
                key={p.id}
                className={`nav-item ${p.id === page ? "is-active" : ""}`}
                aria-current={p.id === page ? "page" : undefined}
                onClick={() => setPage(p.id)}
              >
                <span className="nav-glyph" aria-hidden="true">
                  {p.glyph}
                </span>
                {p.title}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="progress-mini">
              <div className="mini-top">
                <span>Study sessions</span>
                <strong>{progress.data.attempts.length}</strong>
              </div>
              <p>Small steps, steady progress.</p>
            </div>
            <button
              className="account-button"
              onClick={() => setModal("account")}
            >
              <span className="avatar">
                {session?.user.email?.[0]?.toUpperCase() || "A"}
              </span>
              <span className="account-text">
                <strong>{session?.user.email || "Personal study"}</strong>
                <small>{progress.status}</small>
              </span>
            </button>
          </div>
        </aside>
        <main className="main-area">
          <header className="topbar">
            <div className="breadcrumb">
              <span className="flag-mark">
                <i />
                <i />
                <i />
              </span>
              <span>French citizenship</span>
              <span>/</span>
              <span>{PAGES.find((p) => p.id === page)?.title}</span>
            </div>
            <div className="topbar-actions">
              <span className="level-pill">Targeting B2</span>
              <button
                className="mobile-account icon-button"
                aria-label="Account"
                onClick={() => setModal("account")}
              >
                A
              </button>
              <button
                className="icon-button"
                aria-label="About this study app"
                onClick={() => setModal("help")}
              >
                ?
              </button>
            </div>
          </header>
          <div className="app-view">
            <div hidden={page !== "civics"}>
              <Civics progress={progress} />
            </div>
            {page === "home" ? (
              <Dashboard progress={progress} navigate={setPage} />
            ) : page === "civics" ? null : page === "listening" ||
              page === "reading" ? (
              <Comprehension key={page} kind={page} progress={progress} />
            ) : page === "writing" ? (
              <Writing progress={progress} client={client} />
            ) : (
              <Speaking
                key={page}
                interview={page === "interview"}
                progress={progress}
                client={client}
              />
            )}
          </div>
        </main>
      </div>
      {modal && (
        <div className="modal-backdrop">
          <section
            className="dialog modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={modal === "help" ? "About this study app" : "Account"}
          >
            <button
              className="dialog-close"
              autoFocus
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              ×
            </button>
            {modal === "help" ? (
              <>
                <div className="eyebrow">ABOUT THIS SPACE</div>
                <h2>Study in your own rhythm.</h2>
                <p>
                  Practise civic knowledge, French language skills, and the
                  naturalisation interview. These are study aids, not an
                  official exam or certificate.
                </p>
                <p>
                  The language target for naturalisation applications filed from
                  1 January 2026 is B2 across oral and written skills. These
                  short exercises are not a full timed TCF IRN mock.
                </p>
                <a
                  className="source-link"
                  href="https://www.immigration.interieur.gouv.fr/devenir-francais/procedures-dacces-a-nationalite-francaise"
                  target="_blank"
                  rel="noreferrer"
                >
                  Current Ministry requirements ↗
                </a>
              </>
            ) : session ? (
              <>
                <h2>Progress follows you.</h2>
                <p>{session.user.email}</p>
                <p>{progress.status}</p>
                <p>
                  Your attempts and drafts are private to this account.
                  Recordings stay in the open exercise.
                </p>
                <button className="secondary-button" onClick={signOut}>
                  Sign out
                </button>
                <ErrorNotice message={error} />
              </>
            ) : client.auth ? (
              <SignIn client={client} onClose={() => setModal(null)} />
            ) : (
              <>
                <h2>Your study stays here.</h2>
                <p>
                  Progress and drafts are saved on this browser. Connect your
                  private account to sync across devices.
                </p>
                <p>
                  Audio stays local unless you opt into a speech service. Text
                  is sent for automated feedback only when you request it.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
export function App({ client }: { client: ApiClient }) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(Boolean(client.auth));
  useEffect(() => {
    if (!client.auth) return;
    let active = true;
    const subscription = client.auth.auth.onAuthStateChange((_event, next) => {
      if (active) {
        setSession(next);
        setLoading(false);
      }
    });
    client.auth.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      subscription.data.subscription.unsubscribe();
    };
  }, [client]);
  if (!client.config.appReady)
    return (
      <main className="standalone">
        <Heading
          eyebrow="PRIVATE APP SETUP"
          title="Your study space needs its account connection."
        >
          The hosted app is waiting for its private sign-in configuration.
        </Heading>
      </main>
    );
  if (loading)
    return (
      <main className="standalone" role="status">
        Checking your session…
      </main>
    );
  if (!session && !client.config.localMode)
    return (
      <main className="standalone">
        <SignIn client={client} />
      </main>
    );
  return (
    <StudyApp
      key={session?.user.id || "local"}
      client={client}
      session={session}
    />
  );
}
