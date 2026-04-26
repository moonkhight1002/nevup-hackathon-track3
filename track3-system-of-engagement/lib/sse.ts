type StreamCallbacks = {
  onToken: (token: string) => void;
  onStatus: (status: string) => void;
  onComplete: (message: string) => void;
  onError: (message: string) => void;
};

type StreamOptions = {
  baseUrl: string;
  token: string;
  sessionId: string;
  signal?: AbortSignal;
} & StreamCallbacks;

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

function parseSseChunk(chunk: string, onToken: (token: string) => void, onDone: (msg: string) => void) {
  const blocks = chunk.split("\n\n");
  for (const block of blocks) {
    const lines = block.split("\n");
    const event = lines.find((line) => line.startsWith("event:"))?.replace("event:", "").trim();
    const dataLine = lines.find((line) => line.startsWith("data:"))?.replace("data:", "").trim();
    if (!event || !dataLine) continue;
    let parsed: { token?: string; fullMessage?: string };
    try {
      parsed = JSON.parse(dataLine);
    } catch {
      continue;
    }
    if (event === "token" && parsed.token) onToken(parsed.token);
    if (event === "done") onDone(parsed.fullMessage ?? "");
  }
}

export async function streamCoaching({
  baseUrl,
  token,
  sessionId,
  signal,
  onToken,
  onStatus,
  onComplete,
  onError,
}: StreamOptions) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const candidates = [
    `${normalizedBase}/api/sessions/${sessionId}/coaching`,
    `${normalizedBase}/sessions/${sessionId}/coaching`,
  ];

  if (baseUrl === "SEED") {
    onStatus("Simulating AI Coaching...");
    const mockMessage = "Based on the session data, your performance shows strong execution on Trend Continuation setups. However, I noticed a slight dip in plan adherence during the NVDA trade. Consider widening your stops during high-volatility windows to avoid premature exits. Overall, a disciplined session!";
    const tokens = mockMessage.split(" ");
    let currentText = "";
    for (let i = 0; i < tokens.length; i++) {
      if (signal?.aborted) return;
      const token = tokens[i] + (i === tokens.length - 1 ? "" : " ");
      currentText += token;
      onToken(token);
      await new Promise(r => setTimeout(r, 80 + Math.random() * 100));
    }
    onComplete(currentText);
    return;
  }

  const retryDelays = [1000, 2000, 4000, 8000];
  let fullText = "";

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    if (attempt === 0) onStatus("Connecting...");
    if (attempt > 0) onStatus(`Reconnecting... Retry in ${retryDelays[attempt - 1] / 1000}s`);

    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          headers: {
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal,
          cache: "no-store",
        });

        if (!response.ok || !response.body) {
          throw new Error(`Stream request failed (${response.status})`);
        }

        onStatus("Streaming...");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let doneEvent = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            parseSseChunk(
              `${part}\n\n`,
              (tokenChunk) => {
                fullText += tokenChunk;
                onToken(tokenChunk);
              },
              (message) => {
                doneEvent = true;
                if (message) fullText = message;
              }
            );
          }
        }

        if (doneEvent) {
          onComplete(fullText);
          return;
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
      }
    }

    if (attempt === retryDelays.length) {
      onError("Streaming failed after retries. Check token/session and retry manually.");
      return;
    }

    try {
      await delay(retryDelays[attempt], signal);
    } catch {
      return;
    }
  }
}
