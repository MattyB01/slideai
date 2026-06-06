export interface StreamChangeEvent {
  type: 'change';
  slideIndex: number;
  elementId?: string | null;
  field: string;
  value: unknown;
}

export interface StreamThemeEvent {
  type: 'theme';
  field: string;
  value: unknown;
}

export interface StreamProgressEvent {
  type: 'progress';
  changes: number;
}

export interface StreamDoneEvent {
  type: 'done';
  changes?: number;
}

export type StreamEvent = StreamChangeEvent | StreamThemeEvent | StreamProgressEvent | StreamDoneEvent;

export interface StreamCallbacks {
  onChange: (change: StreamChangeEvent) => void;
  onThemeChange: (field: string, value: unknown) => void;
  onProgress: (changes: number) => void;
  onDone: (totalChanges: number) => void;
  onError: (error: Error) => void;
}

/**
 * Stream AI processing results via SSE.
 * Reads a text/event-stream response and calls the appropriate callback
 * for each event type. Handles AbortError gracefully.
 */
export async function streamAI(
  url: string,
  body: Record<string, unknown>,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let totalChanges = 0;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const err = await response.json();
        errorMsg = err.error || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    if (!response.body) {
      throw new Error('Response body is null — streaming not supported');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by \n\n
      const parts = buffer.split('\n\n');
      // Keep the last (possibly incomplete) part in the buffer
      buffer = parts.pop() || '';

      for (const part of parts) {
        for (const line of part.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const dataStr = trimmed.slice(6);
          try {
            const data = JSON.parse(dataStr) as StreamEvent;

            switch (data.type) {
              case 'change':
                totalChanges++;
                callbacks.onChange(data);
                break;
              case 'theme':
                callbacks.onThemeChange(data.field, data.value);
                break;
              case 'progress':
                callbacks.onProgress(data.changes);
                break;
              case 'done':
                callbacks.onDone(data.changes ?? totalChanges);
                return;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }

    // Stream ended without a 'done' event — still signal completion
    callbacks.onDone(totalChanges);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // User cancelled — not an error
      callbacks.onDone(totalChanges);
      return;
    }
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
