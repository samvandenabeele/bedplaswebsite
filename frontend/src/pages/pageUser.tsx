import { useEffect, useRef, useState } from "react";
import {
  addClock,
  addClockUse,
  addDiaper,
  addUrine,
  addWater,
  type AuthUser,
  queryParticipants,
  updateEmptyDiaper,
  type ParticipantSummary,
} from "../api";
import CustomSelect from "../components/CustomSelect";

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
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Opslaan mislukt.",
      );
    } finally {
      setSubmitting(null);
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
      </div>
    </section>
  );
}

export default PageUser;
