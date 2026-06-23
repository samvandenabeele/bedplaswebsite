import { useEffect, useRef, useState } from "react";
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
import Footer from "./components/Footer";
import { PageData } from "./pages/pageData";

type View = "user" | "data" | "superuser" | "admin";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

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
      <>
        <div className="flex min-h-screen flex-col bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
          <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
            <div className="rounded-4xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-slate-300 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
              Checking session...
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (authState === "anonymous") {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex flex-1 items-center justify-center">
          <LoginPage
            error={authError}
            onLogin={handleLogin}
            onError={setAuthError}
          />
        </div>
        <Footer />
      </div>
    );
  }

  if (authState === "must_change_password") {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex flex-1 items-center justify-center">
          <ChangePasswordPage
            error={authError}
            onChangePassword={handlePasswordChange}
            onCancel={handleLogout}
          />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col text-slate-100 max-h-screen overflow-y-scroll scrollbar-thumb-slate-400 scrollbar-track-transparent scrollbar-gutter-auto">
      <div className="mx-auto flex flex-1 w-full max-w-7xl flex-col px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
        <header className="relative z-30 mb-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-3 shadow-lg shadow-slate-950/30 backdrop-blur sm:mb-6 sm:p-4 lg:p-5">
          <div className="flex flex-row items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Bedplas
                <span className="ml-2 text-xs font-normal text-slate-400 tracking-normal">
                  v1.4.3
                </span>
              </h1>
              <p className="mt-1 truncate text-xs text-slate-400 sm:text-sm">
                Signed in as{" "}
                <span className="font-semibold text-white">
                  {currentUser?.username}
                </span>
              </p>
              {(currentUser?.camps?.length ?? 0) > 0 ? (
                <p className="mt-1 truncate text-xs text-cyan-200 sm:text-sm">
                  Camps:{" "}
                  {currentUser?.camps
                    .map((camp) => camp.name || camp.code)
                    .join(", ")}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 shadow-lg shadow-slate-950/30 backdrop-blur transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    className="h-4 w-4"
                  >
                    {menuOpen ? (
                      <path d="M6 6l12 12M18 6L6 18" />
                    ) : (
                      <path d="M4 7h16M4 12h16M4 17h16" />
                    )}
                  </svg>
                  <span>
                    {(() => {
                      const labels: Record<View, string> = {
                        user: "User",
                        data: "Data",
                        superuser: "Superuser",
                        admin: "Admin",
                      };
                      return labels[activeView];
                    })()}
                  </span>
                </button>

                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-2xl border border-white/10 bg-slate-900/95 p-1.5 shadow-2xl shadow-slate-950/50 backdrop-blur-xl"
                  >
                    {(() => {
                      const availableViews: Array<{
                        key: View;
                        label: string;
                      }> = [];
                      availableViews.push({ key: "user", label: "User" });
                      availableViews.push({ key: "data", label: "Data" });
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
                            role="menuitem"
                            onClick={() => {
                              setActiveView(view.key);
                              setMenuOpen(false);
                            }}
                            className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${
                              isActive
                                ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20"
                                : "text-slate-300 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            {view.label}
                          </button>
                        );
                      });
                    })()}
                  </div>
                ) : null}
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
            ) : activeView === "data" ? (
              <PageData currentUser={currentUser} />
            ) : activeView === "superuser" ? (
              <PageSuperuser currentUser={currentUser} />
            ) : (
              <PageAdmin currentUser={currentUser} />
            )}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}

export default App;
