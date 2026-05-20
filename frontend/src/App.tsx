import { useEffect, useState } from "react";
import "./App.css";
import {
  clearAuthToken,
  getAuthToken,
  login,
  logout,
  me,
  type AuthUser,
} from "./api";
import LoginPage from "./pages/LoginPage";
import PageAdmin from "./pages/pageAdmin";
import PageUser from "./pages/pageUser";

type View = "user" | "admin";

const views: Array<{
  key: View;
  label: string;
  description: string;
}> = [
  {
    key: "user",
    label: "User",
    description: "Fast daily entry",
  },
  {
    key: "admin",
    label: "Admin",
    description: "Manage settings",
  },
];

function App() {
  const [authState, setAuthState] = useState<
    "loading" | "anonymous" | "authenticated"
  >("loading");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const [authError, setAuthError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>("user");

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      setAuthState("anonymous");
      return;
    }

    me()
      .then(({ user }) => {
        setCurrentUser(user);
        setAuthState("authenticated");
      })
      .catch(() => {
        clearAuthToken();
        setCurrentUser(null);
        setAuthState("anonymous");
      });
  }, []);

  async function handleLogin(identifier: string, password: string) {
    setAuthError(null);

    const response = await login({ identifier, password });
    setCurrentUser(response.user);
    setActiveView("user");
    setAuthState("authenticated");
  }

  // registration is handled by admins; no client-side register flow

  async function handleLogout() {
    try {
      await logout();
    } catch {
      clearAuthToken();
    } finally {
      setCurrentUser(null);
      setActiveView("user");
      setAuthState("anonymous");
    }
  }

  if (authState === "loading") {
    return (
      <div className="min-h-screen text-slate-100">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 px-6 py-5 text-sm text-slate-300 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
            Checking session...
          </div>
        </div>
      </div>
    );
  }

  if (authState === "anonymous") {
    return (
      <LoginPage
        error={authError}
        onLogin={handleLogin}
        onError={setAuthError}
      />
    );
  }

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
        <header className="mb-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-3 shadow-lg shadow-slate-950/30 backdrop-blur sm:mb-6 sm:p-4 lg:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Bedplas
              </h1>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                Signed in as{" "}
                <span className="font-semibold text-white">
                  {currentUser?.username}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <div className="inline-flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 shadow-lg shadow-slate-950/30 backdrop-blur">
                {views.map((view) => {
                  const isActive = activeView === view.key;

                  return (
                    <button
                      key={view.key}
                      type="button"
                      onClick={() => setActiveView(view.key)}
                      className={`rounded-xl px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 sm:px-4 sm:py-2.5 ${
                        isActive
                          ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div className="text-sm font-semibold">{view.label}</div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        <main className="flex flex-1 items-start justify-center pt-2 sm:items-center sm:pt-0">
          <div className="w-full max-w-5xl">
            {activeView === "user" ? <PageUser /> : <PageAdmin />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
