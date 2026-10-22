import type { CredentialEvidence } from "../types";

interface PendingRead {
  resolve: (evidence: CredentialEvidence) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
let worker: Worker | undefined;
const pending = new Map<string, PendingRead>();

export function disposeReader() {
  worker?.terminate();
  worker = undefined;
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(
      new Error("The credential check was interrupted. Try scanning again."),
    );
  }
  pending.clear();
}

export function analyzeBlob(blob: Blob): Promise<CredentialEvidence> {
  if (!worker) {
    worker = new Worker(new URL("./credential.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onerror = () => disposeReader();
    worker.onmessage = (
      event: MessageEvent<{
        id: string;
        evidence?: CredentialEvidence;
        error?: string;
      }>,
    ) => {
      const request = pending.get(event.data.id);
      if (!request) return;
      pending.delete(event.data.id);
      clearTimeout(request.timer);
      if (event.data.evidence) request.resolve(event.data.evidence);
      else
        request.reject(
          new Error(
            event.data.error || "Content Credentials could not be read.",
          ),
        );
    };
  }
  const current = worker;
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    pending.set(id, {
      resolve,
      reject,
      timer: setTimeout(() => disposeReader(), 20_000),
    });
    current.postMessage({ id, blob });
  });
}
