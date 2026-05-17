function PageUser() {
  return (
    <section className="flex justify-center">
      <div className="w-full max-w-4xl rounded-[2rem] border border-white/10 bg-white/8 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">
              User page
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Fast daily data entry
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
              The layout stays centered and compact so the most common fields
              are always easy to reach and quick to complete.
            </p>
          </div>

          <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200">
            Optimized for speed
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <form
            className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-lg shadow-emerald-950/20 sm:p-6"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Plas toevoegen
                </h3>
                <p className="text-sm text-slate-400">
                  geef de naam van het kind en de hoeveelheid plas
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">naam</span>
                <input
                  placeholder="Naam"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/20"
                  type="text"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  hoeveelheid
                </span>
                <input
                  placeholder="0"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/20"
                  type="number"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-200">
                  opmerking
                </span>
                <textarea
                  rows={4}
                  placeholder="bv: ongelukje"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/20"
                />
              </label>
            </div>

            <button
              type="submit"
              className="w-full mt-3- rounded-2xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
            >
              opslaan
            </button>
          </form>

          <aside className="grid gap-4">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-slate-950/20 sm:p-6">
              <h3 className="text-lg font-semibold text-white">
                Helpful shortcuts
              </h3>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-2xl bg-slate-950/50 px-4 py-3">
                  <span>Use tab to jump fields</span>
                  <span className="text-emerald-300">Fast</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-950/50 px-4 py-3">
                  <span>Enter saves the form</span>
                  <span className="text-emerald-300">Fast</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-950/50 px-4 py-3">
                  <span>Keep notes short</span>
                  <span className="text-emerald-300">Fast</span>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-400/10 p-5 text-cyan-50 shadow-lg shadow-cyan-950/20 sm:p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Designed for routine work
              </p>
              <p className="mt-3 text-sm leading-6 text-cyan-50/90">
                The fields are intentionally simple and the card stays centered,
                so every daily visit starts in the same calm place.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default PageUser;
