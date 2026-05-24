export type AuthUser = {
  id: number;
  username: string;
  email: string | null;
  created_at: string;
};

export type AuthResponse = {
  user: AuthUser;
  token: string;
};

export type ParticipantSummary = {
  id: number;
  name: string;
  last_name: string;
  phone_1: string;
  phone_2: string | null;
  empty_diaper: number;
  drank_today: number;
  peed_today: number;
  largest_pee: number;
  clock: boolean;
};

export type CounselorSummary = {
  id: number;
  username: string;
  email: string | null;
};

export type ExcelCounselorAccount = {
  username: string;
  email: string;
  password: string;
};

export type ExcelParticipantsCounselorsResponse = {
  participants_created: number;
  participants_skipped: number;
  counselors_created: ExcelCounselorAccount[];
};

export type ApiError = {
  error: string;
};

export type RegisterPayload = {
  username: string;
  email?: string;
  password: string;
};

export type LoginPayload = {
  identifier?: string;
  username?: string;
  email?: string;
  password: string;
};

export type ParticipantPayload = {
  name: string;
  last_name: string;
  phone_1: string;
  phone_2?: string;
  empty_diaper?: number;
};

export type ParticipantQuery = Partial<
  Pick<ParticipantPayload, "name" | "last_name" | "phone_1" | "phone_2">
>;

export type CounselorQuery = Partial<
  Pick<ParticipantPayload, "name" | "last_name" | "phone_1" | "phone_2">
>;

export type WaterPayload = {
  participant_id?: number;
  name: string;
  last_name: string;
  meal?: boolean;
};

export type UrinePayload = {
  participant_id?: number;
  name: string;
  last_name: string;
  amount: number;
  note?: string;
};

export type DiaperPayload = {
  participant_id?: number;
  name: string;
  last_name: string;
  weight: number;
  note?: string;
};

export type ClockPayload = {
  participant_id?: number;
  name: string;
  last_name: string;
};

export type EmptyDiaperPayload = {
  participant_id: number;
  empty_diaper: number;
};

export type ParticipantRecentEntry = {
  id: number;
  kind: "water" | "urine" | "diaper" | "clock";
  created_at: string | null;
  meal: boolean | null;
  amount: number | null;
  weight: number | null;
  note: string | null;
};

export type RecentEntry = ParticipantRecentEntry & {
  participant_id: number;
  participant_name: string;
  participant_last_name: string;
};

export type EntryKind = ParticipantRecentEntry["kind"];

export type UpdateEntryPayload = {
  kind: EntryKind;
  id: number;
  meal?: boolean;
  amount?: number;
  weight?: number;
  note?: string;
};

const DEFAULT_API_BASE_URL = "/api";
const AUTH_TOKEN_STORAGE_KEY = "bedplas_auth_token";

function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL as
    | string
    | undefined;
  return (configuredBaseUrl || DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

function storeToken(token: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
}

function buildUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const hasJsonBody = contentType.includes("application/json");

  if (response.status === 204) {
    return undefined as T;
  }

  const body = hasJsonBody
    ? await response.json().catch(() => null)
    : await response.text();

  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : typeof body === "string" && body.trim()
          ? body
          : `Request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return body as T;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const authToken = token ?? getStoredToken();
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  return parseResponse<T>(response);
}

export function getAuthToken() {
  return getStoredToken();
}

export function setAuthToken(token: string | null) {
  storeToken(token);
}

export function clearAuthToken() {
  storeToken(null);
}

export function healthCheck() {
  return request<{ status: string }>("/health", { method: "GET" });
}

export function register(payload: RegisterPayload) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: LoginPayload) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((response) => {
    setAuthToken(response.token);
    return response;
  });
}

export function logout() {
  return request<{ message: string }>("/auth/logout", {
    method: "POST",
  }).finally(() => {
    clearAuthToken();
  });
}

export function me() {
  return request<{ user: AuthUser }>("/auth/me", { method: "GET" });
}

export function addParticipant(payload: ParticipantPayload) {
  return request<{ message: string; name: string }>("/addParticipant", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteParticipant(name: string, last_name: string) {
  return request<{ message: string }>("/delParticipant", {
    method: "POST",
    body: JSON.stringify({ name, last_name }),
  });
}

export function queryParticipants(payload: ParticipantQuery = {}) {
  return request<{ participants: ParticipantSummary[] }>("/queryParticipant", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function queryCounselors(payload: CounselorQuery = {}) {
  return request<{ counselors: CounselorSummary[] }>("/queryCounselor", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function uploadParticipantsCounselorsExcel(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return request<ExcelParticipantsCounselorsResponse>(
    "/excelParticipantsCounselors",
    {
      method: "POST",
      body: formData,
    },
  );
}

export function addWater(payload: WaterPayload) {
  return request<void>("/addWater", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addUrine(payload: UrinePayload) {
  return request<void>("/addUrine", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addDiaper(payload: DiaperPayload) {
  return request<void>("/addDiaper", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addClock(payload: ClockPayload) {
  return request<void>("/addClock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addClockUse(payload: ClockPayload) {
  return request<void>("/addClockUse", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEmptyDiaper(payload: EmptyDiaperPayload) {
  return request<{ message: string; empty_diaper: number }>(
    "/updateEmptyDiaper",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function getParticipantRecentEntries(participantId: number, limit = 50) {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.trunc(limit))
    : 50;
  return request<{ entries: ParticipantRecentEntry[] }>(
    `/participantRecentEntries/${participantId}?limit=${safeLimit}`,
    {
      method: "GET",
    },
  );
}

export function getRecentEntries(limit = 100) {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.trunc(limit))
    : 100;
  return request<{ entries: RecentEntry[] }>(
    `/recentEntries?limit=${safeLimit}`,
    {
      method: "GET",
    },
  );
}

export function updateEntry(payload: UpdateEntryPayload) {
  const { kind, id, ...updates } = payload;
  return request<{ message: string }>(`/entry/${kind}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteEntry(kind: EntryKind, id: number) {
  return request<{ message: string }>(`/entry/${kind}/${id}`, {
    method: "DELETE",
  });
}
