import { Icon } from "./Icon";

export function EmptyState({
  title,
  description,
  error = false,
}: {
  title: string;
  description: string;
  error?: boolean;
}) {
  return (
    <div className={`empty-state${error ? " empty-state-error" : ""}`}>
      <div className="empty-mark">
        <Icon name={error ? "lock" : "photo"} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
