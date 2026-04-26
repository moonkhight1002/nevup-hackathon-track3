import { DEFAULT_API_BASE_URL } from "./config.js";
import { chunkText } from "./utils.js";

function buildUrl(baseUrl, path, query = {}) {
  const cleanPath = String(path).replace(/^\/+/, "");
  const url = new URL(cleanPath, `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function parseJsonResponse(response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchJson(baseUrl, path, token, query) {
  const response = await fetch(buildUrl(baseUrl, path, query), {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return parseJsonResponse(response);
}

async function postJson(baseUrl, path, token, body) {
  const response = await fetch(buildUrl(baseUrl, path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return parseJsonResponse(response);
}

async function checkHealth(baseUrl) {
  return fetchJson(baseUrl, "/health");
}

function createStreamParser({ onToken, onDone }) {
  let buffer = "";

  function processChunk(chunk) {
    buffer += chunk;
    const messages = buffer.split("\n\n");
    buffer = messages.pop() || "";

    messages.forEach((message) => {
      const lines = message.split("\n");
      const event = lines.find((line) => line.startsWith("event:"))?.replace("event:", "").trim();
      const dataLine = lines.find((line) => line.startsWith("data:"))?.replace("data:", "").trim();
      if (!event || !dataLine) {
        return;
      }

      const payload = JSON.parse(dataLine);
      if (event === "token") {
        onToken(payload.token);
      }
      if (event === "done") {
        onDone(payload.fullMessage || "");
      }
    });
  }

  return { processChunk };
}

function simulateSeedStream(tokens, { onToken, onDone, onStatus, signal }) {
  return new Promise((resolve, reject) => {
    let index = 0;
    const parts = [];
    onStatus?.("Streaming seeded coaching...");
    const timer = setInterval(() => {
      if (signal?.aborted) {
        clearInterval(timer);
        reject(new DOMException("Stream aborted", "AbortError"));
        return;
      }

      const token = tokens[index];
      if (!token) {
        clearInterval(timer);
        const fullMessage = parts.join("");
        onDone?.(fullMessage);
        resolve(fullMessage);
        return;
      }

      parts.push(token);
      onToken?.(token);
      index += 1;
    }, 70);
  });
}

export function createApiClient(seedAdapter) {
  async function withLiveFallback(mode, liveRequest, seedRequest, onFallback) {
    if (mode === "live") {
      try {
        return await liveRequest();
      } catch (error) {
        onFallback?.(error);
        return seedRequest();
      }
    }

    return seedRequest();
  }

  return {
    async checkHealth(baseUrl = DEFAULT_API_BASE_URL) {
      return checkHealth(baseUrl);
    },

    async listTraders() {
      return seedAdapter.listTraders();
    },

    async getTraderRange(userId) {
      return seedAdapter.getTraderRange(userId);
    },

    async getSession({ baseUrl, sessionId, token, mode, onFallback }) {
      return withLiveFallback(
        mode,
        () => fetchJson(baseUrl, `/sessions/${sessionId}`, token),
        () => seedAdapter.getSession(sessionId),
        onFallback
      );
    },

    async getTrade({ baseUrl, tradeId, token, mode, onFallback }) {
      return withLiveFallback(
        mode,
        () => fetchJson(baseUrl, `/trades/${tradeId}`, token),
        () => seedAdapter.getTrade(tradeId),
        onFallback
      );
    },

    async createTrade({ baseUrl, token, mode, payload, onFallback }) {
      return withLiveFallback(
        mode,
        () => postJson(baseUrl, "/trades", token, payload),
        () => seedAdapter.createTrade(payload),
        onFallback
      );
    },

    async getMetrics({ baseUrl, userId, token, mode, query, onFallback }) {
      return withLiveFallback(
        mode,
        () => fetchJson(baseUrl, `/users/${userId}/metrics`, token, query),
        () => seedAdapter.getMetrics(userId, query),
        onFallback
      );
    },

    async getProfile({ baseUrl, userId, token, mode, onFallback }) {
      return withLiveFallback(
        mode,
        () => fetchJson(baseUrl, `/users/${userId}/profile`, token),
        () => seedAdapter.getProfile(userId),
        onFallback
      );
    },

    async submitDebrief({ baseUrl, sessionId, token, mode, payload, onFallback }) {
      return withLiveFallback(
        mode,
        () => postJson(baseUrl, `/sessions/${sessionId}/debrief`, token, payload),
        () => seedAdapter.submitDebrief(sessionId, payload),
        onFallback
      );
    },

    async streamCoaching({
      baseUrl,
      sessionId,
      token,
      mode,
      onToken,
      onDone,
      onStatus,
      signal,
    }) {
      if (mode !== "live") {
        const seeded = await seedAdapter.buildCoachingPayload(sessionId);
        return simulateSeedStream(seeded.tokens, { onToken, onDone, onStatus, signal });
      }

      let attempt = 0;
      let fullMessage = "";
      let doneSeen = false;
      while (attempt < 4 && !doneSeen) {
        attempt += 1;
        onStatus?.(
          attempt === 1 ? "Connecting to coaching stream..." : `Reconnecting... attempt ${attempt - 1}`
        );

        try {
          const response = await fetch(buildUrl(baseUrl, `/sessions/${sessionId}/coaching`), {
            headers: {
              Accept: "text/event-stream",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal,
          });

          if (!response.ok || !response.body) {
            throw new Error(`Stream failed with HTTP ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          const parser = createStreamParser({
            onToken: (tokenChunk) => {
              fullMessage += tokenChunk;
              onToken?.(tokenChunk);
            },
            onDone: (message) => {
              doneSeen = true;
              if (message) {
                fullMessage = message;
              }
              onDone?.(fullMessage);
            },
          });

          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }
            parser.processChunk(decoder.decode(value, { stream: true }));
          }

          if (!doneSeen) {
            throw new Error("Connection closed before done event");
          }
        } catch (error) {
          if (signal?.aborted) {
            throw error;
          }

          if (attempt >= 4) {
            onStatus?.("Live stream unavailable. Switching to seeded fallback.");
            const seeded = await seedAdapter.buildCoachingPayload(sessionId);
            const tokenStartIndex = chunkText(fullMessage).length;
            return simulateSeedStream(seeded.tokens.slice(tokenStartIndex), {
              onToken,
              onDone,
              onStatus,
              signal,
            });
          }

          await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** (attempt - 1)));
        }
      }

      return fullMessage;
    },
  };
}
