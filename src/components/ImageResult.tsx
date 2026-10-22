import { useState } from "react";
import type { ImageAnalysisResult } from "../types";
import { StatusBadge } from "./StatusBadge";
import { Icon } from "./Icon";

export function ImageResult({ result }: { result: ImageAnalysisResult }) {
  const [brokenPreview, setBrokenPreview] = useState(false);
  const title = result.alt || "Image from this page";
  const openable = /^https?:\/\//i.test(result.url);
  return (
    <article className="image-result">
      <div className="result-line">
        <div className="thumbnail">
          {brokenPreview ? (
            <Icon name="photo" />
          ) : (
            <img
              src={result.url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setBrokenPreview(true)}
            />
          )}
        </div>
        <div className="result-body">
          <h3 title={title}>{title}</h3>
          <StatusBadge verdict={result.verdict} />
          {result.verdict !== "error" && (
            <p className="result-summary">{result.summary}</p>
          )}
        </div>
      </div>
      <details className="result-details">
        <summary>Why this result</summary>
        <div className="evidence">
          <p>{result.explanation}</p>
          <dl>
            <dt>Credentials</dt>
            <dd>
              {result.validation === "trusted"
                ? "Signature, image binding and signer verified"
                : result.validation === "missing"
                  ? "Not found"
                  : "Not verified"}
            </dd>
            {result.software && (
              <>
                <dt>Source says</dt>
                <dd>{result.software}</dd>
              </>
            )}
            {result.issuer && (
              <>
                <dt>Signer</dt>
                <dd>{result.issuer}</dd>
              </>
            )}
            <dt>Image</dt>
            <dd>
              {result.width} × {result.height}
            </dd>
          </dl>
          {result.validation !== "missing" &&
            result.validation !== "unavailable" && (
              <p className="validation-note">
                Offline validation with the bundled C2PA trust list. Current
                certificate revocation is not checked.
              </p>
            )}
          <div className="evidence-links">
            {openable && (
              <a href={result.url} target="_blank" rel="noreferrer">
                Open original ↗
              </a>
            )}
            {result.verdict !== "ai" && (
              <a href="https://synthid.com/" target="_blank" rel="noreferrer">
                Open SynthID checker ↗
              </a>
            )}
          </div>
          {result.verdict !== "ai" && (
            <p className="validation-note">
              Submit the original image there. RevealAI has not run a watermark
              check.
            </p>
          )}
        </div>
      </details>
    </article>
  );
}
