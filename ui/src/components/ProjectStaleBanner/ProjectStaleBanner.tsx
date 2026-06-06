interface ProjectStaleBannerProps {
  /** Stale summary text; null hides the banner. */
  summary: string | null;
  onUpdate: () => void;
  onDismiss: () => void;
}

/** Amber warning bar shown when project memories may be out of date. */
export function ProjectStaleBanner({ summary, onUpdate, onDismiss }: ProjectStaleBannerProps) {
  if (summary === null) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-3 border border-amber-700 bg-amber-900/30 px-4 py-2.5 text-amber-200">
      <p className="min-w-0 flex-1 text-[13px] leading-snug">{summary}</p>
      <button
        type="button"
        className="shrink-0 cursor-pointer rounded-default border border-amber-600 bg-transparent px-3 py-1 text-[12px] font-medium text-amber-200 transition-colors hover:bg-amber-800/40"
        onClick={onUpdate}
      >
        Update Memories
      </button>
      <button
        type="button"
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-default border-none bg-transparent p-0 text-[18px] leading-none text-amber-200 transition-colors hover:bg-amber-800/40"
        onClick={onDismiss}
        aria-label="Dismiss stale project warning"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
