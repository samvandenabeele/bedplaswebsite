import { useState, type SyntheticEvent } from "react";

type AuthMode = "login" | "register";

type LoginPageProps = {
  mode: AuthMode;
  error: string | null;
  onModeChange: (mode: AuthMode) => void;
  onLogin: (identifier: string, password: string) => Promise<void>;
  onRegister: (
    username: string,
    email: string,
    password: string,
  ) => Promise<void>;
  onError: (message: string | null) => void;
};

function LoginPage({ mode, error, onError }: LoginPageProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegisterMode = mode === "register";

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    onError(null);

    setIsSubmitting(true);
  }

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-start justify-center px-3 py-3 sm:items-center sm:px-6 sm:py-6 lg:px-8">
        <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/8 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-6 lg:p-8">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">Log in</h2>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">
                Username or email
              </span>
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                placeholder="username or email"
                autoComplete="username"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">
                Password
              </span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                placeholder="••••••••"
                autoComplete={
                  isRegisterMode ? "new-password" : "current-password"
                }
                type="password"
                required
              />
            </label>
            {error ? (
              <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              {isSubmitting
                ? "Please wait..."
                : isRegisterMode
                  ? "Create account"
                  : "Log in"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default LoginPage;
