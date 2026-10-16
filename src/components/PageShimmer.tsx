export function ShimmerBlock({ className = "" }: { className?: string }) {
  return <span className={`shimmer-block ${className}`.trim()} aria-hidden="true" />;
}

/** Navbar actions shimmer — keep brand logo outside this. */
export function NavBarShimmer({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="nav-session-shimmer" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <span className="nav-tools-shimmer desktop-nav-shimmer" aria-hidden="true">
        <ShimmerBlock className="shimmer-block--nav-year" />
        <ShimmerBlock className="shimmer-block--nav-icon" />
        <ShimmerBlock className="shimmer-block--nav-icon" />
      </span>
      <span className="nav-account-shimmer desktop-nav-shimmer" aria-hidden="true">
        <span className="nav-user">
          <ShimmerBlock className="shimmer-block--nav-name" />
          <ShimmerBlock className="shimmer-block--nav-level" />
        </span>
        <ShimmerBlock className="shimmer-block--nav-avatar" />
      </span>
      <span className="nav-tools-shimmer mobile-nav-shimmer" aria-hidden="true">
        <ShimmerBlock className="shimmer-block--nav-icon" />
        <ShimmerBlock className="shimmer-block--nav-icon" />
      </span>
    </div>
  );
}

export function PageShimmer({
  label = "Memuat…",
  cards = 4,
  rows = 6,
}: {
  label?: string;
  cards?: number;
  rows?: number;
}) {
  return (
    <div className="page-shimmer" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="page-shimmer-cards" aria-hidden="true">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="page-shimmer-card">
            <ShimmerBlock className="shimmer-block--title" />
            <ShimmerBlock className="shimmer-block--value" />
            <ShimmerBlock className="shimmer-block--line" />
            <ShimmerBlock className="shimmer-block--line-sm" />
          </div>
        ))}
      </div>
      <section className="panel page-shimmer-panel" aria-hidden="true">
        <div className="shimmer-panel-head">
          <ShimmerBlock className="shimmer-block--heading" />
          <ShimmerBlock className="shimmer-block--search" />
        </div>
        <div className="shimmer-list">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="shimmer-card">
              <ShimmerBlock className="shimmer-block--line shimmer-block--line-lg" />
              <ShimmerBlock className="shimmer-block--line" />
              <ShimmerBlock className="shimmer-block--line shimmer-block--line-sm" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
