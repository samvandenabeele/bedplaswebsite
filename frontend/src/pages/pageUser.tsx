import { useEffect, useState } from "react";
import {
  addDiaper,
  deleteEntry,
  getParticipantRecentEntries,
  addUrine,
  addWater,
  queryParticipants,
  type ParticipantRecentEntry,
  updateEntry,
  updateEmptyDiaper,
  type ParticipantSummary,
} from "../api";
import CustomSelect from "../components/CustomSelect";

function PageUser() {
  const [participants, setParticipants] = useState<ParticipantSummary[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    number | ""
  >("");
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [submitting, setSubmitting] = useState<
    "water" | "urine" | "diaper" | null
  >(null);
  const [recentEntries, setRecentEntries] = useState<ParticipantRecentEntry[]>(
    [],
  );
  const [loadingRecentEntries, setLoadingRecentEntries] = useState(false);
  const [entryActionKey, setEntryActionKey] = useState<string | null>(null);
  const [editingEntryKey, setEditingEntryKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    meal: false,
    amount: "0",
    weight: "0",
    note: "",
  });
  const [recentEntryTypeFilter, setRecentEntryTypeFilter] = useState<
    "all" | ParticipantRecentEntry["kind"]
  >("all");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meal, setMeal] = useState(true);
  const [urineAmount, setUrineAmount] = useState("0");
  const [urineNote, setUrineNote] = useState("");
  const [diaperWeight, setDiaperWeight] = useState("0");
  const [diaperNote, setDiaperNote] = useState("");
  const [emptyDiaperDraft, setEmptyDiaperDraft] = useState("0");

  const selectedParticipant = participants.find(
    (participant) => participant.id === selectedParticipantId,
  );

  useEffect(() => {
    setEmptyDiaperDraft(
      selectedParticipant ? String(selectedParticipant.empty_diaper) : "0",
    );
  }, [selectedParticipant]);

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

  async function loadRecentEntries(participantId: number) {
    setLoadingRecentEntries(true);

    try {
      const response = await getParticipantRecentEntries(participantId, 50);
      setRecentEntries(response.entries);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Kan recente metingen niet laden.",
      );
    } finally {
      setLoadingRecentEntries(false);
    }
  }

  useEffect(() => {
    if (!selectedParticipant || !selectedParticipantId) {
      setRecentEntries([]);
      return;
    }

    void loadRecentEntries(selectedParticipant.id);
  }, [selectedParticipant, selectedParticipantId]);

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
      await loadRecentEntries(selectedParticipant.id);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Opslaan mislukt.",
      );
    } finally {
      setSubmitting(null);
    }
  }

  function formatEntryTime(timestamp: string | null) {
    if (!timestamp) {
      return "-";
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return new Intl.DateTimeFormat("nl-BE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function formatEntryType(kind: ParticipantRecentEntry["kind"]) {
    if (kind === "water") {
      return "Water";
    }

    if (kind === "urine") {
      return "Plas";
    }

    return "Luier";
  }

  function formatEntryDetails(entry: ParticipantRecentEntry) {
    if (entry.kind === "water") {
      return entry.meal ? "Drinkmoment bij maaltijd" : "Drinkmoment";
    }

    if (entry.kind === "urine") {
      return `${entry.amount ?? 0} ml`;
    }

    return `${entry.weight ?? 0} g`;
  }

  const filteredRecentEntries =
    recentEntryTypeFilter === "all"
      ? recentEntries
      : recentEntries.filter((entry) => entry.kind === recentEntryTypeFilter);

  function rowKeyForEntry(entry: ParticipantRecentEntry) {
    return `${entry.kind}-${entry.id}`;
  }

  function startEditingRecentEntry(entry: ParticipantRecentEntry) {
    setEditingEntryKey(rowKeyForEntry(entry));
    setEditDraft({
      meal: Boolean(entry.meal),
      amount: String(entry.amount ?? 0),
      weight: String(entry.weight ?? 0),
      note: entry.note ?? "",
    });
  }

  async function handleSaveRecentEntry(entry: ParticipantRecentEntry) {
    if (!selectedParticipant) {
      setError("Kies eerst een kind.");
      return;
    }

    const rowKey = rowKeyForEntry(entry);
    setEntryActionKey(rowKey);
    setError(null);
    setMessage(null);

    try {
      if (entry.kind === "water") {
        await updateEntry({
          kind: "water",
          id: entry.id,
          meal: editDraft.meal,
        });
      }

      if (entry.kind === "urine") {
        const nextAmount = Number(editDraft.amount);
        if (!Number.isFinite(nextAmount) || nextAmount < 0) {
          throw new Error("Hoeveelheid moet 0 of groter zijn.");
        }

        await updateEntry({
          kind: "urine",
          id: entry.id,
          amount: Math.trunc(nextAmount),
          note: editDraft.note,
        });
      }

      if (entry.kind === "diaper") {
        const nextWeight = Number(editDraft.weight);
        if (!Number.isFinite(nextWeight) || nextWeight < 0) {
          throw new Error("Gewicht moet 0 of groter zijn.");
        }

        await updateEntry({
          kind: "diaper",
          id: entry.id,
          weight: Math.trunc(nextWeight),
          note: editDraft.note,
        });
      }

      setMessage("Meting aangepast.");
      setEditingEntryKey(null);
      await Promise.all([
        loadParticipants(),
        loadRecentEntries(selectedParticipant.id),
      ]);
    } catch (entryError) {
      setError(
        entryError instanceof Error
          ? entryError.message
          : "Aanpassen van meting mislukt.",
      );
    } finally {
      setEntryActionKey(null);
    }
  }

  async function handleDeleteRecentEntry(entry: ParticipantRecentEntry) {
    if (!selectedParticipant) {
      setError("Kies eerst een kind.");
      return;
    }

    const confirmed = window.confirm(
      "Weet je zeker dat je deze meting wil verwijderen?",
    );
    if (!confirmed) {
      return;
    }

    const rowKey = rowKeyForEntry(entry);
    setEntryActionKey(rowKey);
    setError(null);
    setMessage(null);

    try {
      await deleteEntry(entry.kind, entry.id);
      setMessage("Meting verwijderd.");
      await Promise.all([
        loadParticipants(),
        loadRecentEntries(selectedParticipant.id),
      ]);
    } catch (entryError) {
      setError(
        entryError instanceof Error
          ? entryError.message
          : "Verwijderen van meting mislukt.",
      );
    } finally {
      setEntryActionKey(null);
    }
  }

  async function handleEmptyDiaperUpdate() {
    if (!selectedParticipant) {
      setError("Kies eerst een kind.");
      return;
    }

    const nextEmptyDiaper = Number(emptyDiaperDraft);
    if (!Number.isInteger(nextEmptyDiaper) || nextEmptyDiaper < 0) {
      setError("Leeggewicht moet een heel getal van 0 of hoger zijn.");
      return;
    }

    if (nextEmptyDiaper === selectedParticipant.empty_diaper) {
      setMessage("Leeggewicht is al gelijk aan de huidige waarde.");
      return;
    }

    const confirmed = window.confirm(
      `Weet je zeker dat je het leeggewicht van ${selectedParticipant.name} ${selectedParticipant.last_name} wilt aanpassen van ${selectedParticipant.empty_diaper} g naar ${nextEmptyDiaper} g?`,
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);
    setError(null);
    setSubmitting("diaper");

    try {
      await updateEmptyDiaper({
        participant_id: selectedParticipant.id,
        empty_diaper: nextEmptyDiaper,
      });
      setMessage(`Leeggewicht aangepast voor ${selectedParticipant.name}.`);
      await loadParticipants();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Leeggewicht aanpassen mislukt.",
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
              {/* CustomSelect provides fully-styled options that match the site */}
              <CustomSelect
                value={selectedParticipantId}
                onChange={(next) => setSelectedParticipantId(next)}
                options={participants.map((p) => ({
                  id: p.id,
                  label: `${p.name} ${p.last_name}`,
                }))}
                placeholder="Selecteer een kind"
                disabled={loadingParticipants}
              />
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
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Lege luier: {selectedParticipant.empty_diaper}
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

        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <form
            className="flex h-full w-full flex-col rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-lg shadow-cyan-950/20 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submitEntry("urine");
            }}
          >
            <div>
              <h3 className="text-lg font-semibold text-white">Plas</h3>
              <p className="mt-1 text-sm text-slate-400">
                Vul de hoeveelheid in milliliter in.
              </p>
            </div>

            <div className="mt-auto flex flex-col gap-4">
              <label className="space-y-2 block">
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

              <label className="space-y-2 block">
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
                className="w-full rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting === "urine" ? "Bezig..." : "Plas opslaan"}
              </button>
            </div>
          </form>

          <form
            className="flex h-full w-full flex-col rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-lg shadow-fuchsia-950/20 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submitEntry("diaper");
            }}
          >
            <div>
              <h3 className="text-lg font-semibold text-white">Luier</h3>
              <p className="mt-1 text-sm text-slate-400">
                Vul het gewicht van de luier in.
              </p>
            </div>

            <div className="mt-auto flex flex-col gap-4">
              <label className="space-y-2 block">
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

              <label className="space-y-2 block">
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
                className="w-full rounded-2xl bg-fuchsia-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting === "diaper" ? "Bezig..." : "Luier opslaan"}
              </button>
            </div>
          </form>
          <div className="grid w-full gap-4 lg:h-full lg:grid-rows-2">
            <form
              className="flex h-full w-full flex-col rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-lg shadow-emerald-950/20 sm:p-5"
              onSubmit={(event) => {
                event.preventDefault();
                void submitEntry("water");
              }}
            >
              <div>
                <h3 className="text-lg font-semibold text-white">Water</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Voeg een drinkmoment toe.
                </p>
              </div>

              <div className="mt-auto flex flex-col gap-4">
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={meal}
                    onChange={(event) => setMeal(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/10 accent-emerald-400"
                  />
                  Bij de maaltijd
                </label>

                <button
                  type="submit"
                  disabled={submitting === "water" || !selectedParticipant}
                  className="w-full rounded-2xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting === "water" ? "Bezig..." : "Water opslaan"}
                </button>
              </div>
            </form>
            <form
              className="flex h-full w-full flex-col rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-lg shadow-slate-950/20 sm:p-5"
              onSubmit={(event) => {
                event.preventDefault();
                void handleEmptyDiaperUpdate();
              }}
            >
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Leeggewicht
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Pas het standaard leeggewicht aan.
                </p>
              </div>

              <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="space-y-2 sm:flex-1">
                  <span className="text-sm font-medium text-slate-200">
                    Nieuw leeggewicht
                  </span>
                  <input
                    value={emptyDiaperDraft}
                    onChange={(event) =>
                      setEmptyDiaperDraft(event.target.value)
                    }
                    type="number"
                    min={0}
                    step={1}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/20"
                  />
                </label>

                <button
                  type="submit"
                  disabled={
                    submitting === "diaper" ||
                    !selectedParticipant ||
                    Number(emptyDiaperDraft) ===
                      selectedParticipant.empty_diaper
                  }
                  className="rounded-2xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting === "diaper" ? "Bezig..." : "Wijzig"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-lg shadow-slate-950/20 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Recente metingen
              </h3>
              <span className="text-xs text-slate-400">
                {selectedParticipant
                  ? `Voor ${selectedParticipant.name} ${selectedParticipant.last_name}`
                  : "Kies een kind"}
              </span>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <span>Type</span>
              <div className="min-w-44">
                <CustomSelect
                  value={recentEntryTypeFilter}
                  onChange={(next) =>
                    setRecentEntryTypeFilter(
                      next as "all" | ParticipantRecentEntry["kind"],
                    )
                  }
                  options={[
                    { id: "all", label: "Alles" },
                    { id: "water", label: "Water" },
                    { id: "urine", label: "Plas" },
                    { id: "diaper", label: "Luier" },
                  ]}
                />
              </div>
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
            <table className="min-w-full divide-y divide-white/10 text-sm text-slate-200">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Tijd</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-4 py-3 font-medium">Opmerking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loadingRecentEntries ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-4 text-center text-slate-400"
                    >
                      Recente metingen laden...
                    </td>
                  </tr>
                ) : filteredRecentEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-4 text-center text-slate-400"
                    >
                      Geen metingen voor dit filter.
                    </td>
                  </tr>
                ) : (
                  filteredRecentEntries.map((entry) => {
                    const rowKey = rowKeyForEntry(entry);
                    const isEditing = editingEntryKey === rowKey;
                    return (
                      <tr
                        key={`${entry.kind}-${entry.id}`}
                        className="group hover:bg-white/5"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatEntryTime(entry.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatEntryType(entry.kind)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isEditing ? (
                            entry.kind === "water" ? (
                              <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={editDraft.meal}
                                  onChange={(event) =>
                                    setEditDraft((current) => ({
                                      ...current,
                                      meal: event.target.checked,
                                    }))
                                  }
                                  className="h-4 w-4 rounded border-white/20 bg-white/10 accent-emerald-400"
                                />
                                Bij maaltijd
                              </label>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                value={
                                  entry.kind === "urine"
                                    ? editDraft.amount
                                    : editDraft.weight
                                }
                                onChange={(event) =>
                                  setEditDraft((current) => ({
                                    ...current,
                                    [entry.kind === "urine"
                                      ? "amount"
                                      : "weight"]: event.target.value,
                                  }))
                                }
                                className="w-28 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-slate-100 outline-none focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/20"
                              />
                            )
                          ) : (
                            formatEntryDetails(entry)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            {isEditing && entry.kind !== "water" ? (
                              <input
                                type="text"
                                value={editDraft.note}
                                onChange={(event) =>
                                  setEditDraft((current) => ({
                                    ...current,
                                    note: event.target.value,
                                  }))
                                }
                                className="w-full max-w-56 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-slate-100 outline-none focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/20"
                              />
                            ) : (
                              <span>{entry.note || "-"}</span>
                            )}
                            <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleSaveRecentEntry(entry)
                                    }
                                    disabled={entryActionKey === rowKey}
                                    className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-1.5 text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                                    aria-label="Opslaan"
                                    title="Opslaan"
                                  >
                                    <svg
                                      viewBox="0 0 20 20"
                                      className="h-4 w-4"
                                      fill="none"
                                    >
                                      <path
                                        d="M4 10l4 4 8-8"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingEntryKey(null)}
                                    disabled={entryActionKey === rowKey}
                                    className="rounded-lg border border-white/20 bg-white/5 p-1.5 text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
                                    aria-label="Annuleren"
                                    title="Annuleren"
                                  >
                                    <svg
                                      viewBox="0 0 20 20"
                                      className="h-4 w-4"
                                      fill="none"
                                    >
                                      <path
                                        d="M5 5l10 10M15 5L5 15"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditingRecentEntry(entry)}
                                  disabled={entryActionKey === rowKey}
                                  className="rounded-lg border border-sky-300/30 bg-sky-500/10 p-1.5 text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
                                  aria-label="Bewerk meting"
                                  title="Bewerk"
                                >
                                  <svg
                                    viewBox="0 0 20 20"
                                    className="h-4 w-4"
                                    fill="none"
                                  >
                                    <path
                                      d="M13.9 3.1l3 3L7 16H4v-3L13.9 3.1z"
                                      stroke="currentColor"
                                      strokeWidth="1.8"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeleteRecentEntry(entry)
                                }
                                disabled={entryActionKey === rowKey}
                                className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-1.5 text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                                aria-label="Verwijder meting"
                                title="Verwijder"
                              >
                                <svg
                                  viewBox="0 0 20 20"
                                  className="h-4 w-4"
                                  fill="none"
                                >
                                  <path
                                    d="M3 5h14"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                  />
                                  <path
                                    d="M8 5V3h4v2"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M6 7l.6 9h6.8L14 7"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default PageUser;
