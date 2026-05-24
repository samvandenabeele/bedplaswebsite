import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
} from "react";
import {
  addParticipant,
  deleteEntry,
  getRecentEntries,
  queryParticipants,
  register,
  updateEntry,
  uploadParticipantsCounselorsExcel,
  type ParticipantSummary,
  queryCounselors,
  type CounselorSummary,
  type RecentEntry,
} from "../api";
import CustomSelect from "../components/CustomSelect";

function AdminSections() {
  const [participants, setParticipants] = useState<ParticipantSummary[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [participantStatus, setParticipantStatus] = useState<string | null>(
    null,
  );
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [excelUploadStatus, setExcelUploadStatus] = useState<string | null>(
    null,
  );
  const [excelUploadError, setExcelUploadError] = useState<string | null>(null);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [counselors, setCounselors] = useState<CounselorSummary[]>([]);
  const [isLoadingCounselors, setIsLoadingCounselors] = useState(true);
  const [counselorError, setCounselorError] = useState<string | null>(null);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [isLoadingRecentEntries, setIsLoadingRecentEntries] = useState(true);
  const [recentEntriesError, setRecentEntriesError] = useState<string | null>(
    null,
  );
  const [entryActionKey, setEntryActionKey] = useState<string | null>(null);
  const [editingEntryKey, setEditingEntryKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    meal: false,
    amount: "0",
    weight: "0",
    note: "",
  });
  const [recentEntryTypeFilter, setRecentEntryTypeFilter] = useState<
    "all" | RecentEntry["kind"]
  >("all");
  const [recentEntryParticipantFilter, setRecentEntryParticipantFilter] =
    useState("");

  const [participantForm, setParticipantForm] = useState({
    name: "",
    last_name: "",
    phone_1: "",
    phone_2: "",
    empty_diaper: "0",
  });

  const [accountForm, setAccountForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  async function loadParticipants() {
    setIsLoadingParticipants(true);
    setParticipantError(null);

    try {
      const response = await queryParticipants();
      setParticipants(response.participants);
    } catch (error) {
      setParticipantError(
        error instanceof Error ? error.message : "Failed to load participants.",
      );
    } finally {
      setIsLoadingParticipants(false);
    }
  }

  useEffect(() => {
    void loadParticipants();
  }, []);

  async function loadCounselors() {
    setIsLoadingCounselors(true);
    setCounselorError(null);

    try {
      const response = await queryCounselors();
      setCounselors(response.counselors);
    } catch (error) {
      setCounselorError(
        error instanceof Error ? error.message : "Failed to load counselors.",
      );
    } finally {
      setIsLoadingCounselors(false);
    }
  }

  useEffect(() => {
    void loadCounselors();
  }, []);

  async function loadRecentEntries() {
    setIsLoadingRecentEntries(true);
    setRecentEntriesError(null);

    try {
      const response = await getRecentEntries(120);
      setRecentEntries(response.entries);
    } catch (error) {
      setRecentEntriesError(
        error instanceof Error
          ? error.message
          : "Failed to load recent entries.",
      );
    } finally {
      setIsLoadingRecentEntries(false);
    }
  }

  useEffect(() => {
    void loadRecentEntries();
  }, []);

  async function loadData() {
    await Promise.all([
      loadParticipants(),
      loadCounselors(),
      loadRecentEntries(),
    ]);
  }

  async function handleParticipantSubmit(
    event: SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setParticipantError(null);
    setParticipantStatus(null);

    try {
      await addParticipant({
        name: participantForm.name.trim(),
        last_name: participantForm.last_name.trim(),
        phone_1: participantForm.phone_1.trim(),
        phone_2: participantForm.phone_2.trim() || undefined,
        empty_diaper: Number(participantForm.empty_diaper) || 0,
      });

      setParticipantStatus("Participant added successfully.");
      setParticipantForm({
        name: "",
        last_name: "",
        phone_1: "",
        phone_2: "",
        empty_diaper: "0",
      });
      await Promise.all([loadParticipants(), loadRecentEntries()]);
    } catch (error) {
      setParticipantError(
        error instanceof Error ? error.message : "Failed to add participant.",
      );
    }
  }

  async function handleAccountSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountStatus(null);

    if (accountForm.password !== accountForm.confirmPassword) {
      setAccountStatus("Passwords do not match.");
      return;
    }

    try {
      await register({
        username: accountForm.username.trim(),
        email: accountForm.email.trim() || undefined,
        password: accountForm.password,
      });

      setAccountStatus("User account created successfully.");
      setAccountForm({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      await loadCounselors();
    } catch (error) {
      setAccountStatus(
        error instanceof Error
          ? error.message
          : "Failed to create user account.",
      );
    }
  }

  async function handleExcelFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    setExcelUploadStatus(null);
    setExcelUploadError(null);
    setIsUploadingExcel(true);

    try {
      const result = await uploadParticipantsCounselorsExcel(selectedFile);
      setExcelUploadStatus(
        `Upload complete. ${result.participants_created} participants added, ${result.participants_skipped} skipped, ${result.counselors_created.length} counselors created.`,
      );
      await Promise.all([loadParticipants(), loadRecentEntries()]);
    } catch (error) {
      setExcelUploadError(
        error instanceof Error ? error.message : "Failed to upload Excel file.",
      );
    } finally {
      setIsUploadingExcel(false);
      event.target.value = "";
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

  function formatEntryType(kind: RecentEntry["kind"]) {
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

  function formatEntryDetails(entry: RecentEntry) {
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

  const normalizedParticipantFilter = recentEntryParticipantFilter
    .trim()
    .toLowerCase();

  const filteredRecentEntries = recentEntries.filter((entry) => {
    const typeMatch =
      recentEntryTypeFilter === "all" || entry.kind === recentEntryTypeFilter;
    const participantFullName =
      `${entry.participant_name} ${entry.participant_last_name}`
        .trim()
        .toLowerCase();
    const participantMatch =
      !normalizedParticipantFilter ||
      participantFullName.includes(normalizedParticipantFilter);

    return typeMatch && participantMatch;
  });

  function rowKeyForEntry(entry: RecentEntry) {
    return `${entry.kind}-${entry.id}-${entry.participant_id}`;
  }

  function startEditingRecentEntry(entry: RecentEntry) {
    setEditingEntryKey(rowKeyForEntry(entry));
    setEditDraft({
      meal: Boolean(entry.meal),
      amount: String(entry.amount ?? 0),
      weight: String(entry.weight ?? 0),
      note: entry.note ?? "",
    });
  }

  async function handleSaveRecentEntry(entry: RecentEntry) {
    const rowKey = rowKeyForEntry(entry);
    setEntryActionKey(rowKey);
    setRecentEntriesError(null);

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
          throw new Error("Amount must be 0 or greater.");
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
          throw new Error("Weight must be 0 or greater.");
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

      setEditingEntryKey(null);
      await Promise.all([loadParticipants(), loadRecentEntries()]);
    } catch (entryError) {
      setRecentEntriesError(
        entryError instanceof Error
          ? entryError.message
          : "Failed to update entry.",
      );
    } finally {
      setEntryActionKey(null);
    }
  }

  async function handleDeleteRecentEntry(entry: RecentEntry) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this entry?",
    );
    if (!confirmed) {
      return;
    }

    const rowKey = rowKeyForEntry(entry);
    setEntryActionKey(rowKey);
    setRecentEntriesError(null);

    try {
      await deleteEntry(entry.kind, entry.id);
      await Promise.all([loadParticipants(), loadRecentEntries()]);
    } catch (entryError) {
      setRecentEntriesError(
        entryError instanceof Error
          ? entryError.message
          : "Failed to delete entry.",
      );
    } finally {
      setEntryActionKey(null);
    }
  }

  return (
    <section className="flex justify-center">
      <div className="w-full max-w-6xl rounded-4xl border border-white/10 bg-white/8 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-6 lg:p-8">
        <div className="mb-8 flex flex-col gap-3 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Admin dashboard
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Add new participants, create user accounts, and review the current
              participant list in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            className="w-fit rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
          >
            Refresh data
          </button>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <form
            className="h-fit self-start rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-4 shadow-lg shadow-cyan-950/20 sm:p-6"
            onSubmit={handleParticipantSubmit}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  New participant
                </h3>
                <p className="text-sm text-slate-400">
                  Create a participant record that will appear in the table
                  below.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  First name
                </span>
                <input
                  value={participantForm.name}
                  onChange={(event) =>
                    setParticipantForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  placeholder="First name"
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  Last name
                </span>
                <input
                  value={participantForm.last_name}
                  onChange={(event) =>
                    setParticipantForm((current) => ({
                      ...current,
                      last_name: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  placeholder="Last name"
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  Primary phone
                </span>
                <input
                  value={participantForm.phone_1}
                  onChange={(event) =>
                    setParticipantForm((current) => ({
                      ...current,
                      phone_1: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  placeholder="Primary phone"
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  Secondary phone
                </span>
                <input
                  value={participantForm.phone_2}
                  onChange={(event) =>
                    setParticipantForm((current) => ({
                      ...current,
                      phone_2: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  placeholder="Optional"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-200">
                  Empty diaper weight
                </span>
                <input
                  value={participantForm.empty_diaper}
                  onChange={(event) =>
                    setParticipantForm((current) => ({
                      ...current,
                      empty_diaper: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  placeholder="0"
                  type="number"
                  min="0"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                Add participant
              </button>
              {participantStatus ? (
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  {participantStatus}
                </div>
              ) : null}
              {participantError ? (
                <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {participantError}
                </div>
              ) : null}
            </div>
          </form>

          <form
            className="h-fit self-start rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-4 shadow-lg shadow-cyan-950/20 sm:p-6"
            onSubmit={handleAccountSubmit}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  New user account
                </h3>
                <p className="text-sm text-slate-400">
                  Create a login account for a team member or admin user.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  Username
                </span>
                <input
                  value={accountForm.username}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  placeholder="username"
                  autoComplete="username"
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  Email
                </span>
                <input
                  value={accountForm.email}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  placeholder="you@example.com"
                  autoComplete="email"
                  type="email"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  Password
                </span>
                <input
                  value={accountForm.password}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  type="password"
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  Confirm password
                </span>
                <input
                  value={accountForm.confirmPassword}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  type="password"
                  required
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                Create account
              </button>
              {accountStatus ? (
                <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
                  {accountStatus}
                </div>
              ) : null}
            </div>
          </form>
        </div>

        <section className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/55 shadow-lg shadow-cyan-950/20">
          <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-white">
                  Counselor data
                </h3>
                <p className="text-sm text-slate-400">
                  View the current counselors.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoadingCounselors ? (
              <div className="px-5 py-8 text-sm text-slate-300 sm:px-6">
                Loading counselors...
              </div>
            ) : counselors.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-300 sm:px-6">
                No counselors found.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
                <thead className="bg-white/5 text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium sm:px-6">Name</th>
                    <th className="px-4 py-3 font-medium sm:px-6">email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {counselors.map((counselor) => (
                    <tr key={counselor.id} className="hover:bg-white/3">
                      <td className="px-4 py-3 font-medium text-white sm:px-6">
                        {counselor.username}
                      </td>
                      <td className="px-4 py-3 text-slate-300 sm:px-6">
                        {counselor.email}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {counselorError && !isLoadingCounselors ? (
            <div className="border-t border-white/10 px-5 py-3 text-sm text-rose-100 sm:px-6">
              {counselorError}
            </div>
          ) : null}
        </section>

        <section className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/55 shadow-lg shadow-cyan-950/20">
          <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-white">
                  Participant data
                </h3>
                <p className="text-sm text-slate-400">
                  View the current participants and their activity totals.
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 sm:items-end">
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleExcelFileChange}
                />
                <button
                  type="button"
                  onClick={() => excelInputRef.current?.click()}
                  disabled={isUploadingExcel}
                  className="rounded-2xl border border-cyan-300/35 bg-cyan-300/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                >
                  {isUploadingExcel ? "Uploading Excel..." : "Upload Excel"}
                </button>
              </div>
            </div>

            {excelUploadStatus ? (
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                {excelUploadStatus}
              </div>
            ) : null}
            {excelUploadError ? (
              <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {excelUploadError}
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            {isLoadingParticipants ? (
              <div className="px-5 py-8 text-sm text-slate-300 sm:px-6">
                Loading participants...
              </div>
            ) : participants.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-300 sm:px-6">
                No participants found.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
                <thead className="bg-white/5 text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium sm:px-6">Name</th>
                    <th className="px-4 py-3 font-medium sm:px-6">Phone 1</th>
                    <th className="px-4 py-3 font-medium sm:px-6">Phone 2</th>
                    <th className="px-4 py-3 font-medium sm:px-6">
                      Drank today
                    </th>
                    <th className="px-4 py-3 font-medium sm:px-6">
                      Peeed today
                    </th>
                    <th className="px-4 py-3 font-medium sm:px-6">
                      Largest pee
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {participants.map((participant) => (
                    <tr key={participant.id} className="hover:bg-white/3">
                      <td className="px-4 py-3 font-medium text-white sm:px-6">
                        {participant.name} {participant.last_name}
                      </td>
                      <td className="px-4 py-3 text-slate-300 sm:px-6">
                        {participant.phone_1}
                      </td>
                      <td className="px-4 py-3 text-slate-300 sm:px-6">
                        {participant.phone_2 || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-300 sm:px-6">
                        {participant.drank_today}
                      </td>
                      <td className="px-4 py-3 text-slate-300 sm:px-6">
                        {participant.peed_today}
                      </td>
                      <td className="px-4 py-3 text-slate-300 sm:px-6">
                        {participant.largest_pee}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {participantError && !isLoadingParticipants ? (
            <div className="border-t border-white/10 px-5 py-3 text-sm text-rose-100 sm:px-6">
              {participantError}
            </div>
          ) : null}
        </section>

        <section className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/55 shadow-lg shadow-cyan-950/20">
          <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-white">
                  Recent participant entries
                </h3>
                <p className="text-sm text-slate-400">
                  Latest water, pee, and diaper entries across all participants.
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-80">
                <input
                  value={recentEntryParticipantFilter}
                  onChange={(event) =>
                    setRecentEntryParticipantFilter(event.target.value)
                  }
                  placeholder="Filter by participant name"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                />
                <div className="min-w-52">
                  <CustomSelect<"all" | RecentEntry["kind"]>
                    value={recentEntryTypeFilter}
                    onChange={(next) =>
                      setRecentEntryTypeFilter(
                        next as "all" | RecentEntry["kind"],
                      )
                    }
                    options={[
                      { id: "all", label: "All entry types" },
                      { id: "water", label: "Water" },
                      { id: "urine", label: "Pee" },
                      { id: "diaper", label: "Diaper" },
                      { id: "clock", label: "Plaswekker" },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoadingRecentEntries ? (
              <div className="px-5 py-8 text-sm text-slate-300 sm:px-6">
                Loading recent entries...
              </div>
            ) : filteredRecentEntries.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-300 sm:px-6">
                No entries match the current filters.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
                <thead className="bg-white/5 text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium sm:px-6">Time</th>
                    <th className="px-4 py-3 font-medium sm:px-6">
                      Participant
                    </th>
                    <th className="px-4 py-3 font-medium sm:px-6">Type</th>
                    <th className="px-4 py-3 font-medium sm:px-6">Details</th>
                    <th className="px-4 py-3 font-medium sm:px-6">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredRecentEntries.map((entry) => {
                    const rowKey = rowKeyForEntry(entry);
                    const isEditing = editingEntryKey === rowKey;
                    return (
                      <tr
                        key={`${entry.kind}-${entry.id}-${entry.participant_id}`}
                        className="group hover:bg-white/3"
                      >
                        <td className="px-4 py-3 text-slate-300 sm:px-6 whitespace-nowrap">
                          {formatEntryTime(entry.created_at)}
                        </td>
                        <td className="px-4 py-3 font-medium text-white sm:px-6 whitespace-nowrap">
                          {entry.participant_name} {entry.participant_last_name}
                        </td>
                        <td className="px-4 py-3 text-slate-300 sm:px-6 whitespace-nowrap">
                          {formatEntryType(entry.kind)}
                        </td>
                        <td className="px-4 py-3 text-slate-300 sm:px-6 whitespace-nowrap">
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
                                  className="h-4 w-4 rounded border-white/20 bg-white/10 accent-cyan-400"
                                />
                                With meal
                              </label>
                            ) : entry.kind === "clock" ? (
                              <span className="text-slate-400">
                                Plaswekker gebruikt
                              </span>
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
                                className="w-28 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-slate-100 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                              />
                            )
                          ) : (
                            formatEntryDetails(entry)
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-300 sm:px-6">
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
                                className="w-full max-w-56 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-slate-100 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
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
                                    aria-label="Save entry"
                                    title="Save"
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
                                    aria-label="Cancel editing"
                                    title="Cancel"
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
                                  aria-label="Edit entry"
                                  title="Edit"
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
                                aria-label="Delete entry"
                                title="Delete"
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
                  })}
                </tbody>
              </table>
            )}
          </div>

          {recentEntriesError && !isLoadingRecentEntries ? (
            <div className="border-t border-white/10 px-5 py-3 text-sm text-rose-100 sm:px-6">
              {recentEntriesError}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

export default AdminSections;
