function PageAdmin() {
  return (
    <section className="flex justify-center">
      <div className="w-full max-w-4xl rounded-[2rem] border border-white/10 bg-white/8 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">
              Admin page
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Configure the daily forms
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
              Keep the structure lean so the people entering data spend more
              time filling in fields and less time hunting for them.
            </p>
          </div>

          <div className="inline-flex items-center justify-center rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-200 text-center">
            Quick setup enabled
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <form
            className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-lg shadow-cyan-950/20 sm:p-6"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Form defaults
                </h3>
                <p className="text-sm text-slate-400">
                  Set the values that should already be ready when the team
                  opens the page.
                </p>
              </div>
              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Core
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  Clinic / room
                </span>
                <input
                  defaultValue="Main entry desk"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  type="text"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  Default category
                </span>
                <select className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20">
                  <option>Standard entry</option>
                  <option>Urgent entry</option>
                  <option>Follow-up</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  Visible fields
                </span>
                <select className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20">
                  <option>Compact</option>
                  <option>Standard</option>
                  <option>Full</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  Auto-save interval
                </span>
                <input
                  defaultValue="30"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  type="number"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="submit"
                className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                Save admin settings
              </button>
              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                Reset to defaults
              </button>
            </div>
          </form>

          <aside className="grid gap-4">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-slate-950/20 sm:p-6">
              <h3 className="text-lg font-semibold text-white">
                Admin shortcuts
              </h3>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-2xl bg-slate-950/50 px-4 py-3">
                  <span>Duplicate last form</span>
                  <span className="text-cyan-300">Ready</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-950/50 px-4 py-3">
                  <span>Archive old entries</span>
                  <span className="text-cyan-300">Ready</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-950/50 px-4 py-3">
                  <span>Open reporting view</span>
                  <span className="text-cyan-300">Ready</span>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-emerald-300/20 bg-emerald-400/10 p-5 text-emerald-50 shadow-lg shadow-emerald-950/20 sm:p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
                Time saver
              </p>
              <p className="mt-3 text-sm leading-6 text-emerald-50/90">
                Keep defaults simple, keep labels short, and keep the admin page
                close to the user page so switching never feels like a treasure
                hunt.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default PageAdmin;
