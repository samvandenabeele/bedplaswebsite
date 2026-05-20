import { useEffect, useState } from "react";
import {
  addDiaper,
  addUrine,
  addWater,
  queryParticipants,
  type ParticipantSummary,
} from "../api";

function PageUser() {
  const [participants, setParticipants] = useState<ParticipantSummary[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    number | ""
  >("");
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [submitting, setSubmitting] = useState<
    "water" | "urine" | "diaper" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meal, setMeal] = useState(true);
  const [urineAmount, setUrineAmount] = useState("0");
  const [urineNote, setUrineNote] = useState("");
  const [diaperWeight, setDiaperWeight] = useState("0");
  const [diaperNote, setDiaperNote] = useState("");

  const selectedParticipant = participants.find(
    (participant) => participant.id === selectedParticipantId,
  );

  async function loadParticipants() {
    setLoadingParticipants(true);

    try {
      const response = await queryParticipants();
      setParticipants(response.participants);
      setSelectedParticipantId(
        (current) => current || response.participants[0]?.id || "",
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Kan de kinderen niet laden.",
      );
    } finally {
      setLoadingParticipants(false);
    }
  }

  useEffect(() => {
    void loadParticipants();
  }, []);

  async function submitEntry(kind: "water" | "urine" | "diaper") {
    if (!selectedParticipant) {
      setError("Kies eerst een kind.");
      return;
    }

    setMessage(null);
    setError(null);
    setSubmitting(kind);

    try {
      if (kind === "water") {
        await addWater({
          participant_id: selectedParticipant.id,
          name: selectedParticipant.name,
          last_name: selectedParticipant.last_name,
          meal,
        });
        setMessage(`Water toegevoegd voor ${selectedParticipant.name}.`);
      }

      if (kind === "urine") {
        await addUrine({
          participant_id: selectedParticipant.id,
          name: selectedParticipant.name,
          last_name: selectedParticipant.last_name,
          amount: Number(urineAmount),
          note: urineNote.trim() || undefined,
        });
        setMessage(`Plas toegevoegd voor ${selectedParticipant.name}.`);
      }

      if (kind === "diaper") {
        await addDiaper({
          participant_id: selectedParticipant.id,
          name: selectedParticipant.name,
          last_name: selectedParticipant.last_name,
          weight: Number(diaperWeight),
          note: diaperNote.trim() || undefined,
        });
        setMessage(`Luier toegevoegd voor ${selectedParticipant.name}.`);
      }

      await loadParticipants();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Opslaan mislukt.",
      );
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <section className="flex justify-center">
      <div className="w-full max-w-5xl rounded-4xl border border-white/10 bg-white/8 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            Snel invoeren
          </h2>
          <p className="text-sm text-slate-400">
            Kies eerst het kind, voeg daarna meteen water, plas of luier toe.
          </p>
        </div>

        <div className="mb-5 rounded-3xl border border-white/10 bg-slate-950/55 p-3 shadow-lg shadow-slate-950/20 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <label className="flex-1 space-y-2">
              <span className="text-sm font-medium text-slate-200">Kind</span>
              <select
                value={selectedParticipantId}
                onChange={(event) =>
                  setSelectedParticipantId(
                    event.target.value ? Number(event.target.value) : "",
                  )
                }
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/20"
                disabled={loadingParticipants}
              >
                <option value="">Selecteer een kind</option>
                {participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name} {participant.last_name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void loadParticipants()}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 sm:px-5"
            >
              Vernieuw lijst
            </button>
          </div>

          {selectedParticipant ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Vandaag water: {selectedParticipant.drank_today}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Vandaag plas: {selectedParticipant.peed_today}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Grootste plas: {selectedParticipant.largest_pee}
              </span>
            </div>
          ) : null}
        </div>

        {message || error ? (
          <div
            className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${error ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"}`}
          >
            {error || message}
          </div>
        ) : null}

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <form
            className="h-fit self-start rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-lg shadow-emerald-950/20 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submitEntry("water");
            }}
          >
            <h3 className="text-lg font-semibold text-white">Water</h3>
            <p className="mt-1 text-sm text-slate-400">
              Voeg een drinkmoment toe.
            </p>

            <label className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={meal}
                onChange={(event) => setMeal(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/10 text-emerald-400"
              />
              Bij de maaltijd
            </label>

            <button
              type="submit"
              disabled={submitting === "water" || !selectedParticipant}
              className="mt-4 w-full rounded-2xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting === "water" ? "Bezig..." : "Water opslaan"}
            </button>
          </form>

          <form
            className="h-fit self-start rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-lg shadow-cyan-950/20 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submitEntry("urine");
            }}
          >
            <h3 className="text-lg font-semibold text-white">Plas</h3>
            <p className="mt-1 text-sm text-slate-400">
              Vul de hoeveelheid in milliliter in.
            </p>

            <label className="mt-4 space-y-2 block">
              <span className="text-sm font-medium text-slate-200">
                Hoeveelheid
              </span>
              <input
                value={urineAmount}
                onChange={(event) => setUrineAmount(event.target.value)}
                type="number"
                min={0}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
              />
            </label>

            <label className="mt-4 space-y-2 block">
              <span className="text-sm font-medium text-slate-200">
                Opmerking
              </span>
              <textarea
                value={urineNote}
                onChange={(event) => setUrineNote(event.target.value)}
                rows={3}
                placeholder="Bijv. ongelukje"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
              />
            </label>

            <button
              type="submit"
              disabled={submitting === "urine" || !selectedParticipant}
              className="mt-4 w-full rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting === "urine" ? "Bezig..." : "Plas opslaan"}
            </button>
          </form>

          <form
            className="h-fit self-start rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-lg shadow-fuchsia-950/20 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submitEntry("diaper");
            }}
          >
            <h3 className="text-lg font-semibold text-white">Luier</h3>
            <p className="mt-1 text-sm text-slate-400">
              Vul het gewicht van de luier in.
            </p>

            <label className="mt-4 space-y-2 block">
              <span className="text-sm font-medium text-slate-200">
                Gewicht
              </span>
              <input
                value={diaperWeight}
                onChange={(event) => setDiaperWeight(event.target.value)}
                type="number"
                min={0}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition focus:border-fuchsia-300/60 focus:ring-2 focus:ring-fuchsia-300/20"
              />
            </label>

            <label className="mt-4 space-y-2 block">
              <span className="text-sm font-medium text-slate-200">
                Opmerking
              </span>
              <textarea
                value={diaperNote}
                onChange={(event) => setDiaperNote(event.target.value)}
                rows={3}
                placeholder="Bijv. doorgelekt"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/60 focus:ring-2 focus:ring-fuchsia-300/20"
              />
            </label>

            <button
              type="submit"
              disabled={submitting === "diaper" || !selectedParticipant}
              className="mt-4 w-full rounded-2xl bg-fuchsia-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting === "diaper" ? "Bezig..." : "Luier opslaan"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

export default PageUser;
