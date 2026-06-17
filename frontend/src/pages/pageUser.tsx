import { useEffect, useRef, useState } from "react";
import {
  addClock,
  addClockUse,
  addDiaper,
  deleteEntry,
  getParticipantRecentEntries,
  addUrine,
  addWater,
  type AuthUser,
  queryParticipants,
  type ParticipantRecentEntry,
  updateEntry,
  updateEmptyDiaper,
  type ParticipantSummary,
} from "../api";
import CustomSelect from "../components/CustomSelect";
import DiaryChart from "../components/charts";

const URINE_NOTE_OPTIONS = [
  "Op toilet",
  "Druppels",
  "Vlekje in onderbroek",
  "Onderbroek nat",
  "Bovenkleding nat",
  "Kousen nat",
  "Bovenkleding en kousen nat",
  "Variërend (druppels tot natte broek)",
  "Variërend (natte broek tot bovenkleding nat)",
];

type NfcLikeRecord = {
  recordType?: string;
  data?: unknown;
  encoding?: string;
};

type NfcLikeEvent = {
  message?: {
    records?: NfcLikeRecord[];
  };
};

function normalizeLookupValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("nl-BE");
}

function participantDisplayName(participant: ParticipantSummary) {
  return `${participant.name} ${participant.last_name}`.trim();
}

function parseParticipantIdFromText(rawText: string) {
  const trimmedText = rawText.trim();
  if (!trimmedText) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmedText);
    const urlParticipantId =
      parsedUrl.searchParams.get("participant") ??
      parsedUrl.searchParams.get("participant_id");

    if (urlParticipantId) {
      const parsedId = Number(urlParticipantId);
      if (Number.isInteger(parsedId) && parsedId > 0) {
        return parsedId;
      }
    }

    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
    const lastPathSegment = pathSegments[pathSegments.length - 1];
    if (lastPathSegment) {
      const parsedPathId = Number(lastPathSegment);
      if (Number.isInteger(parsedPathId) && parsedPathId > 0) {
        return parsedPathId;
      }
    }
  } catch {
    // Not a URL; continue with text matching below.
  }

  const directId = Number(trimmedText);
  if (Number.isInteger(directId) && directId > 0) {
    return directId;
  }

  const idMatch = trimmedText.match(
    /(?:participant(?:_id)?|id)\s*[:=]\s*(\d+)/i,
  );
  if (idMatch) {
    const parsedId = Number(idMatch[1]);
    if (Number.isInteger(parsedId) && parsedId > 0) {
      return parsedId;
    }
  }

  return null;
}

function findParticipantFromScan(
  rawText: string,
  participants: ParticipantSummary[],
) {
  const participantId = parseParticipantIdFromText(rawText);
  if (participantId !== null) {
    const byId = participants.find(
      (participant) => participant.id === participantId,
    );
    if (byId) {
      return byId;
    }
  }

  const normalizedText = normalizeLookupValue(rawText);
  if (!normalizedText) {
    return null;
  }

  const exactDisplayMatches = participants.filter((participant) => {
    const displayName = normalizeLookupValue(
      participantDisplayName(participant),
    );
    const reversedName = normalizeLookupValue(
      `${participant.last_name} ${participant.name}`.trim(),
    );

    return (
      displayName === normalizedText ||
      reversedName === normalizedText ||
      normalizeLookupValue(participant.name) === normalizedText ||
      normalizeLookupValue(participant.last_name) === normalizedText
    );
  });

  if (exactDisplayMatches.length === 1) {
    return exactDisplayMatches[0];
  }

  return null;
}

async function readNfcRecordText(record: NfcLikeRecord) {
  if (typeof record.data === "string") {
    return record.data;
  }

  if (record.data instanceof Blob) {
    return record.data.text();
  }

  if (record.data instanceof DataView || record.data instanceof ArrayBuffer) {
    return new TextDecoder(record.encoding || "utf-8").decode(
      record.data as ArrayBufferView,
    );
  }

  return "";
}

type PageUserProps = {
  currentUser: AuthUser | null;
};

function PageUser({ currentUser }: PageUserProps) {
  const [participants, setParticipants] = useState<ParticipantSummary[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    number | ""
  >("");
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [submitting, setSubmitting] = useState<
    "water" | "urine" | "diaper" | "clock" | "clockUse" | null
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
    faeces: false,
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
  const [urineFaeces, setUrineFaeces] = useState(false);
  const [diaperWeight, setDiaperWeight] = useState("0");
  const [diaperNote, setDiaperNote] = useState("");
  const [emptyDiaperDraft, setEmptyDiaperDraft] = useState("0");
  const urlPreselectedParticipantId = useRef<number | null>(null);
  const participantsRef = useRef<ParticipantSummary[]>([]);
  const nfcAbortControllerRef = useRef<AbortController | null>(null);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcWriting, setNfcWriting] = useState(false);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    setNfcSupported(
      typeof window !== "undefined" &&
        window.isSecureContext &&
        "NDEFReader" in window,
    );
  }, []);

  useEffect(() => {
    return () => {
      nfcAbortControllerRef.current?.abort();
      nfcAbortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const rawParticipantId =
      searchParams.get("participant") ?? searchParams.get("participant_id");

    if (!rawParticipantId) {
      urlPreselectedParticipantId.current = null;
      return;
    }

    const parsedParticipantId = Number(rawParticipantId);
    urlPreselectedParticipantId.current =
      Number.isInteger(parsedParticipantId) && parsedParticipantId > 0
        ? parsedParticipantId
        : null;
  }, []);

  const selectedParticipant = participants.find(
    (participant) => participant.id === selectedParticipantId,
  );

  useEffect(() => {
    setEmptyDiaperDraft(
      selectedParticipant ? String(selectedParticipant.empty_diaper) : "0",
    );
  }, [selectedParticipant]);

  function stopNfcScan() {
    nfcAbortControllerRef.current?.abort();
    nfcAbortControllerRef.current = null;
    setNfcScanning(false);
  }

  async function handleNfcReading(event: NfcLikeEvent) {
    const records = event.message?.records ?? [];
    const rawTexts = await Promise.all(
      records.map((record) => readNfcRecordText(record)),
    );
    const scanValue = rawTexts.map((text) => text.trim()).find(Boolean) ?? "";

    if (!scanValue) {
      setError("De NFC-tag bevat geen leesbare gegevens.");
      return;
    }

    const matchedParticipant = findParticipantFromScan(
      scanValue,
      participantsRef.current,
    );

    if (!matchedParticipant) {
      setError(
        `NFC-tag gelezen (${scanValue}), maar er werd geen passend kind gevonden.`,
      );
      return;
    }

    setError(null);
    setMessage(
      `NFC-tag geselecteerd voor ${participantDisplayName(matchedParticipant)}.`,
    );
    setSelectedParticipantId(matchedParticipant.id);
    stopNfcScan();
  }

  async function startNfcScan() {
    if (nfcScanning) {
      stopNfcScan();
      return;
    }

    if (!nfcSupported) {
      setError(
        "NFC scannen wordt niet ondersteund in deze browser of dit venster is niet veilig (https).",
      );
      return;
    }

    const NdefReaderConstructor = (
      window as Window & {
        NDEFReader?: new () => {
          scan: (options?: { signal?: AbortSignal }) => Promise<void>;
          addEventListener: (
            type: string,
            listener: (event: unknown) => void,
          ) => void;
          removeEventListener: (
            type: string,
            listener: (event: unknown) => void,
          ) => void;
        };
      }
    ).NDEFReader;

    if (!NdefReaderConstructor) {
      setError("NFC scannen is niet beschikbaar in deze browser.");
      return;
    }

    const reader = new NdefReaderConstructor();
    const abortController = new AbortController();
    nfcAbortControllerRef.current = abortController;
    setNfcScanning(true);
    setError(null);
    setMessage("Houd de NFC-tag tegen het toestel...");

    const onReading = (event: unknown) => {
      void handleNfcReading(event as NfcLikeEvent).catch((scanError) => {
        setError(
          scanError instanceof Error
            ? scanError.message
            : "NFC-tag lezen mislukt.",
        );
        stopNfcScan();
      });
    };

    const onError = () => {
      setError("NFC-tag lezen mislukt.");
      stopNfcScan();
    };

    reader.addEventListener("reading", onReading);
    reader.addEventListener("error", onError);

    try {
      await reader.scan({ signal: abortController.signal });
    } catch (scanError) {
      stopNfcScan();
      setError(
        scanError instanceof Error
          ? scanError.message
          : "NFC scannen kon niet worden gestart.",
      );
    }
  }

  async function startNfcWrite() {
    if (!selectedParticipant) {
      setError("Kies eerst een kind.");
      return;
    }

    if (!nfcSupported) {
      setError(
        "NFC schrijven wordt niet ondersteund in deze browser of dit venster is niet veilig (https).",
      );
      return;
    }

    const NdefReaderConstructor = (
      window as Window & {
        NDEFReader?: new () => {
          write: (options: {
            records: Array<{ recordType: string; data: string }>;
          }) => Promise<void>;
        };
      }
    ).NDEFReader;

    if (!NdefReaderConstructor) {
      setError("NFC schrijven is niet beschikbaar in deze browser.");
      return;
    }

    setNfcWriting(true);
    setError(null);
    setMessage("Houd de NFC-tag tegen het toestel om te schrijven...");

    try {
      const reader = new NdefReaderConstructor();
      const participantIdText = String(selectedParticipant.id);

      await reader.write({
        records: [
          {
            recordType: "text",
            data: participantIdText,
          },
        ],
      });

      setMessage(
        `NFC-tag geschreven voor ${participantDisplayName(selectedParticipant)}.`,
      );
      setNfcWriting(false);
    } catch (writeError) {
      setError(
        writeError instanceof Error
          ? writeError.message
          : "NFC schrijven mislukt.",
      );
      setNfcWriting(false);
    }
  }

  async function loadParticipants() {
    setLoadingParticipants(true);

    try {
      const response = await queryParticipants();
      setParticipants(response.participants);

      const preferredParticipantId = urlPreselectedParticipantId.current;
      const preferredParticipantExists = response.participants.some(
        (participant) => participant.id === preferredParticipantId,
      );

      if (preferredParticipantExists && preferredParticipantId !== null) {
        setSelectedParticipantId(preferredParticipantId);
        urlPreselectedParticipantId.current = null;
        return;
      }

      setSelectedParticipantId((current) => {
        const currentParticipantExists = response.participants.some(
          (participant) => participant.id === current,
        );

        if (currentParticipantExists) {
          return current;
        }

        return response.participants[0]?.id || "";
      });
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

  async function submitEntry(
    kind: "water" | "urine" | "diaper" | "clock" | "clockUse",
  ) {
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
        const trimmedNote = urineNote.trim();
        if (!trimmedNote) {
          setMessage("Selecteer een opmerking");
        }
        await addUrine({
          participant_id: selectedParticipant.id,
          name: selectedParticipant.name,
          last_name: selectedParticipant.last_name,
          amount: Number(urineAmount),
          note: trimmedNote,
          faeces: urineFaeces,
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

      if (kind === "clock") {
        await addClock({
          participant_id: selectedParticipant.id,
          name: selectedParticipant.name,
          last_name: selectedParticipant.last_name,
        });
      }

      if (kind === "clockUse") {
        await addClockUse({
          participant_id: selectedParticipant.id,
          name: selectedParticipant.name,
          last_name: selectedParticipant.last_name,
        });
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

    if (kind === "clock") {
      return "Plaswekker";
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

    if (entry.kind === "clock") {
      return "Plaswekker gebruikt";
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
      faeces: Boolean((entry as any).faeces),
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
          faeces: Boolean((editDraft as any).faeces),
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

      if (entry.kind === "clock") {
        await updateEntry({
          kind: "clock",
          id: entry.id,
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
          {(currentUser?.camps?.length ?? 0) > 0 ? (
            <div className="pt-1 text-xs text-cyan-200">
              Huidige kampen:{" "}
              {currentUser?.camps
                .map((camp) => camp.name || camp.code)
                .join(", ")}
            </div>
          ) : null}
        </div>

        <div className="mb-5 rounded-3xl border border-white/10 bg-slate-950/55 p-3 shadow-lg shadow-slate-950/20 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <label className="flex-1 space-y-2">
              <span className="text-sm font-medium text-slate-200">Kind</span>
              {/* CustomSelect provides fully-styled options that match the site */}
              <CustomSelect<number>
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

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                onClick={() => void startNfcScan()}
                disabled={!nfcSupported || loadingParticipants}
                className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
              >
                {nfcScanning ? "Stop NFC-scan" : "Scan NFC-tag"}
              </button>

              <button
                type="button"
                onClick={() => void startNfcWrite()}
                disabled={
                  !nfcSupported || loadingParticipants || !selectedParticipant
                }
                className="rounded-2xl border border-purple-300/20 bg-purple-400/10 px-4 py-3 font-semibold text-purple-100 transition hover:bg-purple-400/15 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
              >
                {nfcWriting ? "Bezig..." : "Schrijf naar tag"}
              </button>

              <button
                type="button"
                onClick={() => void loadParticipants()}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 sm:px-5"
              >
                Vernieuw lijst
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {nfcSupported
              ? "Scan een NFC-tag op ondersteunde toestellen om meteen het juiste kind te kiezen."
              : "NFC scannen is niet beschikbaar in deze browser; gebruik dan de lijst of een URL met participant-id."}
          </p>

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
                <div className="min-w-0">
                  <CustomSelect<string>
                    value={urineNote}
                    onChange={(next) => setUrineNote(next)}
                    options={URINE_NOTE_OPTIONS.map((o) => ({
                      id: o,
                      label: o,
                    }))}
                    placeholder="Selecteer een opmerking"
                    disabled={!selectedParticipant}
                  />
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={urineFaeces}
                  onChange={(event) => setUrineFaeces(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 accent-emerald-400"
                />
                Met ontlasting
              </label>

              <button
                type="submit"
                disabled={
                  submitting === "urine" ||
                  !selectedParticipant ||
                  !urineNote.trim()
                }
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
          {/* form for plaswekkers */}
          <form
            className="flex h-full w-full flex-col rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-lg shadow-fuchsia-950/20 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submitEntry("clock");
            }}
          >
            <div>
              <h3 className="text-lg font-semibold text-white">Plaswekker</h3>
              <p className="mt-1 text-sm text-slate-400"></p>
            </div>

            <div className="mt-auto flex flex-col gap-4">
              <label className="space-y-2 block">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={
                      selectedParticipant ? selectedParticipant.clock : false
                    }
                    onChange={(event) => {
                      // Toggle plaswekker use`
                      event.preventDefault();
                      submitEntry("clockUse");
                    }}
                    className="h-4 w-4 rounded border-white/20 bg-white/10 accent-emerald-400"
                  />
                  plaswekker gebruikt
                </label>
              </label>

              <button
                type="submit"
                disabled={submitting === "clock" || !selectedParticipant}
                className="w-full rounded-2xl bg-fuchsia-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting === "clock" ? "Bezig..." : "Plaswekker opslaan"}
              </button>
            </div>
          </form>
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
                <CustomSelect<"all" | ParticipantRecentEntry["kind"]>
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
                    { id: "clock", label: "Plaswekker" },
                    { id: "diaper", label: "Luier" },
                  ]}
                />
              </div>
            </label>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-96 rounded-2xl border border-white/10 bg-white/5 scrollbar-thumb-slate-400 scrollbar-auto scrollbar-gutter-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm text-slate-200">
              <thead className="bg-gray-800 text-left text-xs uppercase tracking-wide text-slate-400 sticky top-0">
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
                            ) : entry.kind === "clock" ? (
                              <span className="text-slate-400">
                                Plaswekker gebruikt
                              </span>
                            ) : (
                              <div className="flex items-center gap-3">
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
                                {entry.kind === "urine" ? (
                                  <label className="inline-flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(
                                        (editDraft as any).faeces,
                                      )}
                                      onChange={(event) =>
                                        setEditDraft((current) => ({
                                          ...current,
                                          faeces: event.target.checked,
                                        }))
                                      }
                                      className="h-4 w-4 rounded border-white/20 bg-white/10 accent-emerald-400"
                                    />
                                    Met ontlasting
                                  </label>
                                ) : null}
                              </div>
                            )
                          ) : (
                            formatEntryDetails(entry)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            {isEditing &&
                            entry.kind !== "water" &&
                            entry.kind !== "clock" ? (
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
        {selectedParticipant ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/55 shadow-lg shadow-slate-950/20">
            <div className="overflow-x-auto p-4 sm:p-5">
              <div className="min-w-150">
                <DiaryChart
                  participantId={selectedParticipant.id}
                  participantBirthDate={selectedParticipant.birth_date}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default PageUser;
