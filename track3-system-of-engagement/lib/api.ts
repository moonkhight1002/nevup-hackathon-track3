import * as seed from "./seed";
import { sleep } from "./utils";

type RequestOptions = {
  baseUrl: string;
  token: string;
  signal?: AbortSignal;
};

type FetchOptions = RequestOptions & {
  method?: "GET" | "POST";
  path: string;
  body?: unknown;
};

type ApiError = Error & { status?: number; traceId?: string };

const DEFAULT_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4010";

function cleanBase(baseUrl: string) {
  const value = baseUrl.trim() || DEFAULT_BASE;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function parseError(response: Response): Promise<ApiError> {
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  const error = new Error(
    (parsed as { message?: string })?.message || text || `Request failed with ${response.status}`
  ) as ApiError;
  error.status = response.status;
  error.traceId = (parsed as { traceId?: string })?.traceId;
  return error;
}

async function requestJson<T>(options: FetchOptions): Promise<T> {
  const baseUrl = cleanBase(options.baseUrl);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };

  const normalized = options.path.startsWith("/") ? options.path : `/${options.path}`;
  const candidates = normalized.startsWith("/api/")
    ? [normalized, normalized.replace("/api", "")]
    : [normalized, `/api${normalized}`];

  for (let index = 0; index < candidates.length; index += 1) {
    const path = candidates[index];
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      cache: "no-store",
    });
    if (response.ok) {
      return (await response.json()) as T;
    }
    if (response.status === 404 && index < candidates.length - 1) {
      continue;
    }
    throw await parseError(response);
  }

  throw new Error("Unreachable fetch state");
}

export function getApiBase() {
  return DEFAULT_BASE;
}

export async function fetchSession(
  sessionId: string,
  options: RequestOptions
): Promise<SessionSummary> {
  const normalizedBase = options.baseUrl?.trim()?.toUpperCase();
  if (normalizedBase === "SEED") {
    return Promise.resolve(seed.getSeedSession(sessionId)!);
  }
  return requestJson<SessionSummary>({
    ...options,
    path: `/api/sessions/${sessionId}`,
  });
}

export async function fetchMetrics(
  userId: string,
  options: RequestOptions
): Promise<MetricsResponse> {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 90);

  const query = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    granularity: "daily",
  });

  const normalizedBase = options.baseUrl?.trim()?.toUpperCase();
  if (normalizedBase === "SEED") {
    return Promise.resolve(seed.getSeedMetrics(userId)!);
  }
  return requestJson<MetricsResponse>({
    ...options,
    path: `/api/users/${userId}/metrics?${query.toString()}`,
  });
}

export async function fetchProfile(
  userId: string,
  options: RequestOptions
): Promise<ProfileResponse> {
  const normalizedBase = options.baseUrl?.trim()?.toUpperCase();

  if (normalizedBase === "SEED") {
    const profile = seed.getSeedProfile(userId);
    if (!profile) return Promise.reject(new Error("Trader profile not found in seed dataset"));
    return Promise.resolve(profile);
  }
  return requestJson<ProfileResponse>({
    ...options,
    path: `/api/users/${userId}/profile`,
  });
}

export async function submitDebrief(
  sessionId: string,
  payload: DebriefRequest,
  options: RequestOptions
) {
  const normalizedBase = options.baseUrl?.trim()?.toUpperCase();
  if (normalizedBase === "SEED") {
    return Promise.resolve({ debriefId: "seed-debrief", sessionId, savedAt: new Date().toISOString() });
  }
  return requestJson<{ debriefId?: string; sessionId?: string; savedAt?: string }>({
    ...options,
    method: "POST",
    path: `/api/sessions/${sessionId}/debrief`,
    body: payload,
  });
}
