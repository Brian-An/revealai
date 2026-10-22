import { useEffect, useRef, useState } from "react";
import { ImageResult } from "../components/ImageResult";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { ScanError, scanCurrentPage } from "../utils/imageAnalyzer";
import { disposeReader } from "../utils/c2pa";
import type { ImageAnalysisResult, ScanProgress } from "../types";

type Phase = "ready" | "scanning" | "complete" | "error";
interface ScanState extends ScanProgress {
  phase: Phase;
  error?: { title: string; description: string };
}
const initial: ScanState = {
  phase: "ready",
  total: 0,
  hostname: "",
  limited: false,
  results: [],
};

function ScanContent({
  scan,
  results,
}: {
  scan: ScanState;
  results: ImageAnalysisResult[];
}) {
  if (scan.phase === "error" && scan.error)
    return (
      <EmptyState
        title={scan.error.title}
        description={scan.error.description}
        error
      />
    );
  if (scan.results.length > 0)
    return results.length ? (
      <div className="result-list">
        {results.map((result) => (
          <ImageResult key={result.url} result={result} />
        ))}
      </div>
    ) : (
      <EmptyState
        title="No matching images"
        description="Choose All to see every image checked on this page."
      />
    );
  if (scan.phase === "scanning")
    return (
      <div className="empty-state">
        <div className="scan-ring" aria-hidden="true" />
        <p>Looking for Content Credentials</p>
      </div>
    );
  if (scan.phase === "complete")
    return (
      <EmptyState
        title="No eligible images"
        description="This page has no loaded images large enough to check. Try a page with photos or illustrations."
      />
    );
  return (
    <EmptyState
      title="Curious about an image?"
      description="Scan this page to see what its images reveal about their origin."
    />
  );
}

function ScanControls({
  scan,
  onScan,
}: {
  scan: ScanState;
  onScan: () => void;
}) {
  const scanning = scan.phase === "scanning";
  const complete = scan.phase === "complete" && scan.results.length > 0;
  return (
    <section className="hero" aria-label="Scan images">
      <h1>
        {scanning ? (
          "Looking a little closer."
        ) : complete ? (
          "A little more context."
        ) : (
          <>
            A closer look.
            <br />A clearer picture.
          </>
        )}
      </h1>
      <p>
        {scanning
          ? "Checking image origin information on this page."
          : complete
            ? "Here’s what this page’s images reveal."
            : "Check this page’s images for signs of AI."}
      </p>
      <button className="scan-button" onClick={onScan} disabled={scanning}>
        <Icon name="scan" />
        {scanning
          ? "Scanning page…"
          : scan.phase === "ready"
            ? "Scan page"
            : "Scan again"}
      </button>
      {scanning && (
        <div className="scan-progress">
          <progress
            aria-label="Images checked"
            value={scan.results.length}
            max={scan.total || 1}
          />
          <div>
            <span>Checking images</span>
            <span>
              {scan.results.length} / {scan.total || "…"}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

export function Popup() {
  const [scan, setScan] = useState<ScanState>(initial);
  const [filter, setFilter] = useState<"all" | "ai" | "unknown">("all");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const cancel = () => {
      controller.current?.abort();
      disposeReader();
    };
    window.addEventListener("pagehide", cancel);
    return () => {
      cancel();
      window.removeEventListener("pagehide", cancel);
    };
  }, []);

  async function startScan() {
    controller.current?.abort();
    disposeReader();
    const current = new AbortController();
    controller.current = current;
    setFilter("all");
    setScan({ ...initial, phase: "scanning" });
    try {
      const page = await scanCurrentPage((progress) => {
        if (!current.signal.aborted)
          setScan({ ...progress, phase: "scanning" });
      }, current.signal);
      if (!current.signal.aborted)
        setScan({ ...page, total: page.results.length, phase: "complete" });
    } catch (error) {
      if (!current.signal.aborted)
        setScan({
          ...initial,
          phase: "error",
          error: {
            title:
              error instanceof ScanError
                ? error.title
                : "The scan couldn’t finish",
            description:
              error instanceof Error
                ? error.message
                : "Try reloading this page and scanning again.",
          },
        });
    }
  }

  const scanning = scan.phase === "scanning";
  const hasResults = scan.results.length > 0;
  const counts = {
    all: scan.results.length,
    ai: scan.results.filter((result) => result.verdict === "ai").length,
    unknown: scan.results.filter((result) => result.verdict === "unknown")
      .length,
  };
  const unavailable = scan.results.filter(
    (result) => result.verdict === "error",
  ).length;
  const results = scan.results.filter(
    (result) => filter === "all" || result.verdict === filter,
  );

  return (
    <main className="popup">
      <header className="popup-header">
        <div className="brand">
          <Icon name="eye" />
          <span>RevealAI</span>
        </div>
        <span className="device">
          <Icon name="lock" />
          On device
        </span>
      </header>
      <ScanControls scan={scan} onScan={startScan} />
      {hasResults && (
        <div className="results-top">
          <div className="page-context">
            <span title={scan.hostname}>{scan.hostname}</span>
            <strong>
              {scan.results.length}{" "}
              {scan.results.length === 1 ? "image" : "images"} checked
            </strong>
          </div>
          {unavailable > 0 && (
            <p className="scan-note">
              {unavailable} {unavailable === 1 ? "image" : "images"} could not
              be checked.
            </p>
          )}
          {scan.limited && (
            <p className="scan-note">
              Showing the first 100 unique images on this page.
            </p>
          )}
          <nav className="filter-tabs" aria-label="Filter image results">
            {(["all", "ai", "unknown"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value === "all"
                  ? "All"
                  : value === "ai"
                    ? "AI indicated"
                    : "Unknown"}
                <span>{counts[value]}</span>
              </button>
            ))}
          </nav>
        </div>
      )}
      <div className="results-content" aria-busy={scanning}>
        <ScanContent scan={scan} results={results} />
      </div>
      <p className="sr-only" role="status">
        {scanning
          ? `Checking ${scan.results.length} of ${scan.total} images.`
          : scan.phase === "complete"
            ? `${scan.results.length} images checked. ${counts.ai} AI indications. ${unavailable} unavailable.`
            : scan.error?.title}
      </p>
      <footer className="popup-footer">
        <span>
          <Icon name="lock" />
          Images stay in your browser
        </span>
        <p>Missing evidence doesn’t mean an image is real.</p>
      </footer>
    </main>
  );
}
