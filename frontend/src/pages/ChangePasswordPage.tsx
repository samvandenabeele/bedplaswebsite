import { useState, type SyntheticEvent } from "react";

type ChangePasswordPageProps = {
  error: string | null;
  onChangePassword: (newPassword: string) => Promise<void>;
  onCancel: () => Promise<void>;
};

function ChangePasswordPage({
  error,
  onChangePassword,
  onCancel,
}: ChangePasswordPageProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onChangePassword(newPassword);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-start justify-center px-3 py-3 sm:items-center sm:px-6 sm:py-6 lg:px-8">
        <section className="w-full max-w-md rounded-4xl border border-white/10 bg-white/8 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-6 lg:p-8">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">
              Choose a new password
            </h2>
          </div>

          <p className="mb-4 text-sm text-slate-300">
            Your account was created with a temporary password. Pick a new one
            to continue.
          </p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">
                New password
              </span>
              <input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                placeholder="Enter a new password"
                autoComplete="new-password"
                type="password"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">
                Confirm password
              </span>
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                placeholder="Repeat the new password"
                autoComplete="new-password"
                type="password"
                required
              />
            </label>

            {newPassword &&
            confirmPassword &&
            newPassword !== confirmPassword ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                Passwords do not match.
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void onCancel()}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
              >
                Log out
              </button>

              <button
                type="submit"
                disabled={isSubmitting || newPassword !== confirmPassword}
                className="flex-1 rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                {isSubmitting ? "Saving..." : "Save password"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default ChangePasswordPage;
