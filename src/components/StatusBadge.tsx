import type { CredentialEvidence } from "../types";

export function StatusBadge({ verdict }: Pick<CredentialEvidence, "verdict">) {
  return (
    <span className={`status-badge status-${verdict}`}>
      {verdict === "ai"
        ? "AI indicated"
        : verdict === "error"
          ? "Could not check"
          : "Unknown"}
    </span>
  );
}
