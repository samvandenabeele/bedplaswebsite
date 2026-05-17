import { useState } from "react";
import "./App.css";
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
  const [activeView, setActiveView] = useState<View>("user");

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">
              Bedplaswebsite
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Quick data entry workspace
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
              Built for speed: two clean pages, centered cards, and a toggle
              that keeps the most common tasks one click away.
            </p>
          </div>

          <div className="inline-flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 shadow-lg shadow-slate-950/30 backdrop-blur">
            {views.map((view) => {
              const isActive = activeView === view.key;

              return (
                <button
                  key={view.key}
                  type="button"
                  onClick={() => setActiveView(view.key)}
                  className={`rounded-xl px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${
                    isActive
                      ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="text-sm font-semibold">{view.label}</div>
                  <div className="text-xs opacity-80">{view.description}</div>
                </button>
              );
            })}
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-5xl">
            {activeView === "user" ? <PageUser /> : <PageAdmin />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
