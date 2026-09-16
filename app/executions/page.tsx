export default function ExecutionsIndexPage() {
  return (
    <div className="hidden flex-1 items-center justify-center px-6 text-center md:flex">
      <div>
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface-muted text-ink-muted">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-5 w-5"
          >
            <path d="M5 4.75h14v5.5H5zM5 13.75h14v5.5H5z" />
            <path d="M8 7.5h.01M8 16.5h.01" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm font-medium text-ink-soft">Select an execution</p>
        <p className="mt-1 text-xs text-ink-muted">
          Steps, events, and run details appear here.
        </p>
      </div>
    </div>
  );
}
