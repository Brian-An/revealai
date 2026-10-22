export function Icon({ name }: { name: "eye" | "scan" | "lock" | "photo" }) {
  const paths = {
    eye: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      </>
    ),
    scan: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M5 12h14" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    photo: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="15.5" cy="8.5" r="1.7" />
        <path d="m3 16 5-5 8 10m-3-4 3-3 5 5" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
