import { useEffect, useState } from "react";
import "./App.css";
import {
  clearAuthToken,
  changePassword,
  getAuthToken,
  login,
  logout,
  me,
  type AuthUser,
} from "./api";
import LoginPage from "./pages/LoginPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import PageAdmin from "./pages/pageAdmin";
import PageSuperuser from "./pages/pageSuperuser";
import PageUser from "./pages/pageUser";

type View = "user" | "superuser" | "admin";
type AuthState =
  | "loading"
  | "anonymous"
  | "authenticated"
  | "must_change_password";

function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
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
        setAuthState(
          user.password_change_required
            ? "must_change_password"
            : "authenticated",
        );
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
    setAuthState(
      response.user.password_change_required
        ? "must_change_password"
        : "authenticated",
    );
  }

  async function handlePasswordChange(newPassword: string) {
    setAuthError(null);

    const response = await changePassword({ new_password: newPassword });
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
          <div className="rounded-4xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-slate-300 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
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

  if (authState === "must_change_password") {
    return (
      <ChangePasswordPage
        error={authError}
        onChangePassword={handlePasswordChange}
        onCancel={handleLogout}
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
                <span className="ml-2 text-xs font-normal text-slate-400 tracking-normal">
                  v1.2.0
                </span>
              </h1>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                Signed in as{" "}
                <span className="font-semibold text-white">
                  {currentUser?.username}
                </span>
              </p>
              {currentUser?.camp ? (
                <p className="mt-1 text-xs text-cyan-200 sm:text-sm">
                  Camp: {currentUser.camp.name || currentUser.camp.code}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <div className="inline-flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 shadow-lg shadow-slate-950/30 backdrop-blur">
                {(() => {
                  const availableViews: Array<{ key: View; label: string }> =
                    [];
                  availableViews.push({ key: "user", label: "User" });
                  if (
                    currentUser?.role === "superuser" ||
                    currentUser?.role === "admin"
                  ) {
                    availableViews.push({
                      key: "superuser",
                      label: "Superuser",
                    });
                  }
                  if (currentUser?.role === "admin") {
                    availableViews.push({ key: "admin", label: "Admin" });
                  }

                  return availableViews.map((view) => {
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
                        <div className="text-sm font-semibold">
                          {view.label}
                        </div>
                      </button>
                    );
                  });
                })()}
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
            {activeView === "user" ? (
              <PageUser currentUser={currentUser} />
            ) : activeView === "superuser" ? (
              <PageSuperuser currentUser={currentUser} />
            ) : (
              <PageAdmin currentUser={currentUser} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
