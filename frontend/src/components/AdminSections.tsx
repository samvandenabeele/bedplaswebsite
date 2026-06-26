import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
} from "react";
import {
  addParticipant,
  downloadDiaries,
  deleteEntry,
  createCamp,
  getCamps,
  getRecentEntries,
  queryParticipants,
  createUser,
  updateUser,
  updateEntry,
  updateCamp,
  uploadParticipantsCounselorsExcel,
  type AuthUser,
  type CampSummary,
  type ParticipantSummary,
  queryCounselors,
  type CounselorSummary,
  type RecentEntry,
} from "../api";
import CustomSelect from "../components/CustomSelect";

type AdminSectionsProps = {
  currentUser: AuthUser | null;
  panel: "admin" | "superuser";
};

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

function formatCampDate(dateValue: string | null) {
  if (!dateValue) {
    return "-";
  }

  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatCampLabel(camp: CampSummary) {
  const baseLabel = camp.name ? `${camp.name} (${camp.code})` : camp.code;
  return baseLabel;
}

function formatCampList(campList: CampSummary[] | undefined) {
  if (!campList || campList.length === 0) {
    return "-";
  }
  return campList.map((camp) => formatCampLabel(camp)).join(", ");
}

function readSelectedCampIds(event: ChangeEvent<HTMLSelectElement>) {
  const selectedIds: number[] = [];
  for (const option of Array.from(event.target.selectedOptions)) {
    const parsed = Number(option.value);
    if (Number.isInteger(parsed)) {
      selectedIds.push(parsed);
    }
  }
  return selectedIds;
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

function rowKeyForEntry(entry: RecentEntry) {
  return `${entry.kind}-${entry.id}-${entry.participant_id}`;
}

function AdminSections({ currentUser, panel }: AdminSectionsProps) {
  const isAdminPanel = panel === "admin";
  const isSuperuserPanel = panel === "superuser";

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
  const [counselorStatus, setCounselorStatus] = useState<string | null>(null);
  const [counselorActionKey, setCounselorActionKey] = useState<string | null>(
    null,
  );
  const [counselorRoleDrafts, setCounselorRoleDrafts] = useState<
    Record<number, string>
  >({});
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
  const [camps, setCamps] = useState<CampSummary[]>([]);
  const [isLoadingCamps, setIsLoadingCamps] = useState(true);
  const [campError, setCampError] = useState<string | null>(null);
  const [campStatus, setCampStatus] = useState<string | null>(null);
  const [campActionKey, setCampActionKey] = useState<string | null>(null);
  const [downloadCampId, setDownloadCampId] = useState<number | "">(
    currentUser?.camp_ids?.[0] ?? currentUser?.camp_id ?? "",
  );
  const [isDownloadingDiaries, setIsDownloadingDiaries] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [selectedParticipantCampIds, setSelectedParticipantCampIds] = useState<
    number[]
  >(
    currentUser?.camp_ids ??
      (currentUser?.camp_id ? [currentUser.camp_id] : []),
  );
  const [selectedAccountCampIds, setSelectedAccountCampIds] = useState<
    number[]
  >(
    currentUser?.camp_ids ??
      (currentUser?.camp_id ? [currentUser.camp_id] : []),
  );
  const [campForm, setCampForm] = useState({
    code: "",
    name: "",
    source_header: "",
    start_date: "",
    end_date: "",
  });

  const [participantForm, setParticipantForm] = useState({
    name: "",
    last_name: "",
    phone_1: "",
    phone_2: "",
    empty_diaper: "0",
    birth_date: "",
  });

  const [accountForm, setAccountForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [accountRole, setAccountRole] = useState<string>("user");

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

  async function loadCamps() {
    setIsLoadingCamps(true);
    setCampError(null);

    try {
      const response = await getCamps();
      setCamps(response.camps);
      const defaultCampIds = currentUser?.camp_ids?.length
        ? currentUser.camp_ids
        : currentUser?.camp_id
          ? [currentUser.camp_id]
          : response.camps[0]?.id
            ? [response.camps[0].id]
            : [];
      setSelectedParticipantCampIds(defaultCampIds);
      setSelectedAccountCampIds(defaultCampIds);
      setDownloadCampId(defaultCampIds[0] ?? "");
    } catch (error) {
      setCampError(
        error instanceof Error ? error.message : "Failed to load camps.",
      );
    } finally {
      setIsLoadingCamps(false);
    }
  }

  async function handleCampSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setCampError(null);
    setCampStatus(null);

    try {
      await createCamp({
        code: campForm.code.trim(),
        name: campForm.name.trim() || undefined,
        source_header: campForm.source_header.trim() || undefined,
        start_date: campForm.start_date || undefined,
        end_date: campForm.end_date || undefined,
      });

      setCampStatus("Camp created successfully.");
      setCampForm({
        code: "",
        name: "",
        source_header: "",
        start_date: "",
        end_date: "",
      });
      await loadCamps();
    } catch (error) {
      setCampError(
        error instanceof Error ? error.message : "Failed to create camp.",
      );
    }
  }

  async function handleCampToggleActive(camp: CampSummary) {
    const rowKey = `camp-${camp.id}`;
    setCampActionKey(rowKey);
    setCampError(null);
    setCampStatus(null);

    try {
      await updateCamp(camp.id, { active: !camp.active });
      setCampStatus(
        `${camp.code} is now ${camp.active ? "inactive" : "active"}.`,
      );
      await loadCamps();
    } catch (error) {
      setCampError(
        error instanceof Error ? error.message : "Failed to update camp.",
      );
    } finally {
      setCampActionKey(null);
    }
  }

  async function handleDownloadDiaries(campId: number | undefined) {
    setDownloadStatus(null);
    setIsDownloadingDiaries(true);

    try {
      if (campId === undefined) {
        throw new Error("Select a camp before downloading diaries.");
      }

      await downloadDiaries(campId);
      setDownloadStatus("Diary export started.");
    } catch (error) {
      setDownloadStatus(
        error instanceof Error ? error.message : "Failed to download diaries.",
      );
    } finally {
      setIsDownloadingDiaries(false);
    }
  }

  useEffect(() => {
    void loadCamps();
  }, []);

  async function loadCounselors() {
    setIsLoadingCounselors(true);
    setCounselorError(null);

    try {
      const response = await queryCounselors();
      setCounselors(response.counselors);
      setCounselorRoleDrafts(
        Object.fromEntries(
          response.counselors.map((counselor) => [
            counselor.id,
            counselor.role ?? "user",
          ]),
        ),
      );
    } catch (error) {
      setCounselorError(
        error instanceof Error ? error.message : "Failed to load counselors.",
      );
    } finally {
      setIsLoadingCounselors(false);
    }
  }

  useEffect(() => {
    if (isAdminPanel) {
      void loadCounselors();
      return;
    }

    void loadParticipants();
  }, [isAdminPanel]);

  useEffect(() => {
    if (isAdminPanel) {
      return;
    }

    void loadCounselors();
  }, [isAdminPanel]);

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
    if (isAdminPanel) {
      return;
    }

    void loadRecentEntries();
  }, [isAdminPanel]);

  async function loadData() {
    await Promise.all([
      loadParticipants(),
      loadCounselors(),
      loadRecentEntries(),
      loadCamps(),
    ]);
  }

  async function handleRefresh() {
    if (isAdminPanel) {
      await Promise.all([loadCamps(), loadCounselors()]);
      return;
    }

    await loadData();
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
        birth_date: participantForm.birth_date || undefined,
        empty_diaper: Number(participantForm.empty_diaper) || 0,
        camp_ids: selectedParticipantCampIds,
      });

      setParticipantStatus("Participant added successfully.");
      setParticipantForm({
        name: "",
        last_name: "",
        phone_1: "",
        phone_2: "",
        empty_diaper: "0",
        birth_date: "",
      });
      await Promise.all([loadParticipants(), loadRecentEntries()]);
    } catch (error) {
      setParticipantError(
        error instanceof Error ? error.message : "Failed to add participant.",
      );
    }
  }

  async function handleCounselorRoleSave(counselor: CounselorSummary) {
    const nextRole =
      counselorRoleDrafts[counselor.id] ?? counselor.role ?? "user";

    if (nextRole === (counselor.role ?? "user")) {
      setCounselorStatus(
        `${counselor.username} already has the selected role.`,
      );
      return;
    }

    const rowKey = `counselor-${counselor.id}`;
    setCounselorActionKey(rowKey);
    setCounselorStatus(null);
    setCounselorError(null);

    try {
      await updateUser(counselor.id, { role: nextRole });
      setCounselorStatus(`${counselor.username} updated to ${nextRole}.`);
      await loadCounselors();
    } catch (error) {
      setCounselorError(
        error instanceof Error ? error.message : "Failed to update user role.",
      );
    } finally {
      setCounselorActionKey(null);
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
      const role = isAdminPanel ? accountRole : "user";

      await createUser({
        username: accountForm.username.trim(),
        email: accountForm.email.trim() || undefined,
        password: accountForm.password,
        camp_ids: selectedAccountCampIds,
        role,
      });

      setAccountStatus("User account created successfully.");
      setAccountForm({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      setAccountRole("user");
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

    const campName = window.prompt(
      "Enter the camp name for this Excel upload.",
    );
    if (campName === null) {
      event.target.value = "";
      return;
    }

    const normalizedCampName = campName.trim();
    if (!normalizedCampName) {
      setExcelUploadError(
        "Camp name is required before uploading the Excel file.",
      );
      event.target.value = "";
      return;
    }

    setExcelUploadStatus(null);
    setExcelUploadError(null);
    setIsUploadingExcel(true);

    try {
      const result = await uploadParticipantsCounselorsExcel(
        selectedFile,
        normalizedCampName,
      );
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
              {isAdminPanel ? "Admin dashboard" : "Superuser dashboard"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              {isAdminPanel
                ? "Manage camps and keep the global setup in order."
                : "Manage participants, counselors, accounts, and recent entries for your camp."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="w-fit rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
          >
            Refresh data
          </button>
        </div>

        {isAdminPanel ? (
          <>
            {campError ? (
              <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                {campError}
              </div>
            ) : null}

            {campStatus ? (
              <div className="mb-6 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                {campStatus}
              </div>
            ) : null}

            <section className="mb-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/55 shadow-lg shadow-cyan-950/20">
              <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 sm:px-6 sm:py-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-white">
                      Camp management
                    </h3>
                    <p className="text-sm text-slate-400">
                      Create camps, review their vacation dates, and see how
                      many counselors and participants belong to each one.
                    </p>
                  </div>

                  <div className="text-sm text-slate-300">
                    {(currentUser?.camps?.length ?? 0) > 0 ? (
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-cyan-100">
                        Camp-scoped user: {formatCampList(currentUser?.camps)}
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-100">
                        Global admin access
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <label className="block w-full space-y-2 sm:max-w-md">
                    <span className="text-sm font-medium text-slate-200">
                      Camp for diary export
                    </span>
                    <CustomSelect<number>
                      value={downloadCampId}
                      onChange={(next) => setDownloadCampId(next)}
                      options={camps.map((camp) => ({
                        id: camp.id,
                        label: formatCampLabel(camp),
                      }))}
                      placeholder={
                        isLoadingCamps ? "Loading camps..." : "Select a camp"
                      }
                      disabled={isLoadingCamps || currentUser?.role !== "admin"}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      void handleDownloadDiaries(
                        downloadCampId === "" ? undefined : downloadCampId,
                      )
                    }
                    disabled={
                      isDownloadingDiaries ||
                      isLoadingCamps ||
                      currentUser?.role !== "admin" ||
                      downloadCampId === ""
                    }
                    className="w-fit rounded-2xl border border-cyan-300/35 bg-cyan-300/15 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                  >
                    {isDownloadingDiaries
                      ? "Downloading diaries..."
                      : "Download diaries"}
                  </button>
                </div>

                {downloadStatus ? (
                  <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
                    {downloadStatus}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-6 border-b border-white/10 px-5 py-5 sm:px-6 lg:grid-cols-[0.95fr_1.05fr]">
                <form className="space-y-4" onSubmit={handleCampSubmit}>
                  <div>
                    <h4 className="text-base font-semibold text-white">
                      New camp
                    </h4>
                    <p className="text-sm text-slate-400">
                      Add a camp manually when it is not coming from an upload.
                    </p>
                  </div>

                  <label className="space-y-2 block">
                    <span className="text-sm font-medium text-slate-200">
                      Code
                    </span>
                    <input
                      value={campForm.code}
                      onChange={(event) =>
                        setCampForm((current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                      placeholder="2614526001"
                      required
                    />
                  </label>

                  <label className="space-y-2 block">
                    <span className="text-sm font-medium text-slate-200">
                      Name
                    </span>
                    <input
                      value={campForm.name}
                      onChange={(event) =>
                        setCampForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                      placeholder="Optional camp name"
                    />
                  </label>

                  <label className="space-y-2 block">
                    <span className="text-sm font-medium text-slate-200">
                      Source header
                    </span>
                    <textarea
                      value={campForm.source_header}
                      onChange={(event) =>
                        setCampForm((current) => ({
                          ...current,
                          source_header: event.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                      placeholder="Optional A1 workbook text"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 block">
                      <span className="text-sm font-medium text-slate-200">
                        Start date
                      </span>
                      <input
                        value={campForm.start_date}
                        onChange={(event) =>
                          setCampForm((current) => ({
                            ...current,
                            start_date: event.target.value,
                          }))
                        }
                        type="date"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                      />
                    </label>

                    <label className="space-y-2 block">
                      <span className="text-sm font-medium text-slate-200">
                        End date
                      </span>
                      <input
                        value={campForm.end_date}
                        onChange={(event) =>
                          setCampForm((current) => ({
                            ...current,
                            end_date: event.target.value,
                          }))
                        }
                        type="date"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={currentUser?.role !== "admin"}
                    className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                  >
                    Create camp
                  </button>
                </form>

                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
                  {isLoadingCamps ? (
                    <div className="px-5 py-8 text-sm text-slate-300">
                      Loading camps...
                    </div>
                  ) : camps.length === 0 ? (
                    <div className="px-5 py-8 text-sm text-slate-300">
                      No camps found.
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
                      <thead className="bg-white/5 text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
                        <tr>
                          <th className="px-4 py-3 font-medium">Code</th>
                          <th className="px-4 py-3 font-medium">Name</th>
                          <th className="px-4 py-3 font-medium">Dates</th>
                          <th className="px-4 py-3 font-medium">People</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {camps.map((camp) => {
                          const rowKey = `camp-${camp.id}`;
                          const isBusy = campActionKey === rowKey;
                          return (
                            <tr key={camp.id} className="hover:bg-white/3">
                              <td className="px-4 py-3 font-medium text-white">
                                {camp.code}
                              </td>
                              <td className="px-4 py-3 text-slate-300">
                                {camp.name || "-"}
                              </td>
                              <td className="px-4 py-3 text-slate-300">
                                <div>
                                  {camp.start_date || camp.end_date
                                    ? `${camp.start_date ? formatCampDate(camp.start_date) : "-"} → ${camp.end_date ? formatCampDate(camp.end_date) : "-"}`
                                    : "Dates not set"}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-300">
                                <div className="text-nowrap">
                                  {camp.participant_count} participants
                                </div>
                                <div className="text-nowrap">
                                  {camp.counselor_count} counselors
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-300">
                                {camp.active ? "Active" : "Inactive"}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleCampToggleActive(camp)
                                  }
                                  disabled={
                                    isBusy || currentUser?.role !== "admin"
                                  }
                                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {camp.active ? "Deactivate" : "Activate"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </section>

            <section className="mb-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/55 shadow-lg shadow-cyan-950/20">
              <div className="border-b border-white/10 px-5 py-4 sm:px-6 sm:py-5">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-white">
                    New user account
                  </h3>
                  <p className="text-sm text-slate-400">
                    Create accounts for users, superusers, or admins.
                  </p>
                </div>
              </div>

              <form
                className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-2"
                onSubmit={handleAccountSubmit}
              >
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
                    Camps
                  </span>
                  <select
                    multiple
                    value={selectedAccountCampIds.map(String)}
                    onChange={(event) =>
                      setSelectedAccountCampIds(readSelectedCampIds(event))
                    }
                    className="min-h-32 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                    disabled={isLoadingCamps || currentUser?.role !== "admin"}
                  >
                    {camps.map((camp) => (
                      <option key={camp.id} value={camp.id}>
                        {formatCampLabel(camp)}
                      </option>
                    ))}
                  </select>
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

                <label className="space-y-2 lg:col-span-2">
                  <span className="text-sm font-medium text-slate-200">
                    Role
                  </span>
                  <CustomSelect<string>
                    value={accountRole}
                    onChange={(next) => setAccountRole(next)}
                    options={[
                      { id: "user", label: "User" },
                      { id: "superuser", label: "Superuser" },
                      { id: "admin", label: "Admin" },
                    ]}
                  />
                </label>

                <div className="flex flex-wrap gap-3 lg:col-span-2">
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
            </section>

            <section className="mb-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/55 shadow-lg shadow-cyan-950/20">
              <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 sm:px-6 sm:py-5">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-white">
                    User roles
                  </h3>
                  <p className="text-sm text-slate-400">
                    Promote a regular user to superuser or admin, or demote an
                    existing account.
                  </p>
                </div>
                {counselorStatus ? (
                  <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                    {counselorStatus}
                  </div>
                ) : null}
              </div>

              <div className="overflow-x-auto">
                {isLoadingCounselors ? (
                  <div className="px-5 py-8 text-sm text-slate-300 sm:px-6">
                    Loading users...
                  </div>
                ) : counselors.length === 0 ? (
                  <div className="px-5 py-8 text-sm text-slate-300 sm:px-6">
                    No users found.
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
                    <thead className="bg-white/5 text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3 font-medium sm:px-6">Name</th>
                        <th className="px-4 py-3 font-medium sm:px-6">Email</th>
                        <th className="px-4 py-3 font-medium sm:px-6">Camp</th>
                        <th className="px-4 py-3 font-medium sm:px-6">Role</th>
                        <th className="px-4 py-3 font-medium sm:px-6">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {counselors.map((counselor) => {
                        const rowKey = `counselor-${counselor.id}`;
                        const isBusy = counselorActionKey === rowKey;
                        const selectedRole =
                          counselorRoleDrafts[counselor.id] ??
                          counselor.role ??
                          "user";
                        return (
                          <tr key={counselor.id} className="hover:bg-white/3">
                            <td className="px-4 py-3 font-medium text-white sm:px-6">
                              {counselor.username}
                            </td>
                            <td className="px-4 py-3 text-slate-300 sm:px-6">
                              {counselor.email || "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-300 sm:px-6">
                              {formatCampList(counselor.camps)}
                            </td>
                            <td className="px-4 py-3 text-slate-300 sm:px-6">
                              <CustomSelect<string>
                                value={selectedRole}
                                onChange={(next) =>
                                  setCounselorRoleDrafts((current) => ({
                                    ...current,
                                    [counselor.id]: next,
                                  }))
                                }
                                options={[
                                  { id: "user", label: "User" },
                                  { id: "superuser", label: "Superuser" },
                                  { id: "admin", label: "Admin" },
                                ]}
                              />
                            </td>
                            <td className="px-4 py-3 sm:px-6">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleCounselorRoleSave(counselor)
                                }
                                disabled={
                                  isBusy ||
                                  selectedRole === (counselor.role ?? "user")
                                }
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isBusy ? "Saving..." : "Save role"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
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
          </>
        ) : null}

        {isSuperuserPanel ? (
          <>
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

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">
                      Birth date
                    </span>
                    <input
                      value={participantForm.birth_date}
                      onChange={(event) =>
                        setParticipantForm((current) => ({
                          ...current,
                          birth_date: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                      placeholder="YYYY-MM-DD"
                      type="date"
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

                  <label className="space-y-2 sm:col-span-2">
                    <span className="text-sm font-medium text-slate-200">
                      Camps
                    </span>
                    <select
                      multiple
                      value={selectedParticipantCampIds.map(String)}
                      onChange={(event) =>
                        setSelectedParticipantCampIds(
                          readSelectedCampIds(event),
                        )
                      }
                      className="min-h-32 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                      disabled={
                        isLoadingCamps ||
                        (currentUser?.camp_ids?.length ?? 0) > 0
                      }
                    >
                      {camps.map((camp) => (
                        <option key={camp.id} value={camp.id}>
                          {formatCampLabel(camp)}
                        </option>
                      ))}
                    </select>
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
                      Camps
                    </span>
                    <select
                      multiple
                      value={selectedAccountCampIds.map(String)}
                      onChange={(event) =>
                        setSelectedAccountCampIds(readSelectedCampIds(event))
                      }
                      className="min-h-32 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                      disabled={isLoadingCamps || currentUser?.role !== "admin"}
                    >
                      {camps.map((camp) => (
                        <option key={camp.id} value={camp.id}>
                          {formatCampLabel(camp)}
                        </option>
                      ))}
                    </select>
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

                  {isAdminPanel ? (
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-200">
                        Role
                      </span>
                      <CustomSelect<string>
                        value={accountRole}
                        onChange={(next) => setAccountRole(next)}
                        options={[
                          { id: "user", label: "User" },
                          { id: "superuser", label: "Superuser" },
                        ]}
                      />
                    </label>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                      Role is fixed to{" "}
                      <span className="font-semibold text-white">user</span> in
                      the superuser panel.
                    </div>
                  )}
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
                        <th className="px-4 py-3 font-medium sm:px-6">Camp</th>
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
                          <td className="px-4 py-3 text-slate-300 sm:px-6">
                            {formatCampList(counselor.camps)}
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
                    <button
                      type="button"
                      onClick={() =>
                        void handleDownloadDiaries(
                          currentUser?.camp_ids?.[0] ??
                            currentUser?.camp_id ??
                            undefined,
                        )
                      }
                      disabled={
                        isDownloadingDiaries ||
                        !(
                          (currentUser?.camp_ids?.[0] ??
                            currentUser?.camp_id) != null
                        )
                      }
                      className="rounded-2xl border border-cyan-300/35 bg-cyan-300/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                    >
                      {isDownloadingDiaries
                        ? "Downloading diaries..."
                        : "Download diaries"}
                    </button>
                  </div>
                </div>

                {downloadStatus ? (
                  <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
                    {downloadStatus}
                  </div>
                ) : null}

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
                        <th className="px-4 py-3 font-medium sm:px-6">Camp</th>
                        <th className="px-4 py-3 font-medium sm:px-6">Birth</th>
                        <th className="px-4 py-3 font-medium sm:px-6">
                          Phone 1
                        </th>
                        <th className="px-4 py-3 font-medium sm:px-6">
                          Phone 2
                        </th>
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
                            {formatCampList(participant.camps)}
                          </td>
                          <td className="px-4 py-3 text-slate-300 sm:px-6">
                            {participant.birth_date
                              ? formatCampDate(participant.birth_date)
                              : "-"}
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
                      Latest water, pee, and diaper entries across all
                      participants.
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
                        <th className="px-4 py-3 font-medium sm:px-6">Camp</th>
                        <th className="px-4 py-3 font-medium sm:px-6">Type</th>
                        <th className="px-4 py-3 font-medium sm:px-6">
                          Details
                        </th>
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
                              {entry.participant_name}{" "}
                              {entry.participant_last_name}
                            </td>
                            <td className="px-4 py-3 text-slate-300 sm:px-6 whitespace-nowrap">
                              {entry.participant_camp_name ||
                                entry.participant_camp_code ||
                                "-"}
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
                                      onClick={() =>
                                        startEditingRecentEntry(entry)
                                      }
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
          </>
        ) : null}
      </div>
    </section>
  );
}

export default AdminSections;
