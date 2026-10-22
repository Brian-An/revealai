import { fetchImage } from "../utils/fetchImage";

const requests = new Map<string, AbortController>();

chrome.runtime.onMessage.addListener(
  (message: unknown, sender, sendResponse) => {
    if (
      sender.id !== chrome.runtime.id ||
      sender.url !== chrome.runtime.getURL("index.html")
    )
      return;
    if (!message || typeof message !== "object") return;
    const request = message as Record<string, unknown>;
    if (typeof request.id !== "string" || request.id.length > 100) return;
    if (request.action === "cancelImage") {
      requests.get(request.id)?.abort();
      return;
    }
    if (request.action !== "fetchImage" || typeof request.url !== "string")
      return;
    if (requests.size >= 4 || requests.has(request.id)) {
      sendResponse({ error: "Too many image checks. Try scanning again." });
      return;
    }
    const controller = new AbortController();
    const id = request.id;
    requests.set(id, controller);
    fetchImage(request.url, controller.signal)
      .then(sendResponse)
      .catch((error: unknown) =>
        sendResponse({
          error:
            error instanceof Error && error.name === "TimeoutError"
              ? "The image server took too long. Try opening the original image."
              : error instanceof Error
                ? error.message
                : "Image could not be fetched.",
        }),
      )
      .finally(() => requests.delete(id));
    return true;
  },
);
