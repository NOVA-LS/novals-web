"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="shell grid min-h-[60vh] content-center gap-[var(--space-md)]">
      <span className="meta">Error 500</span>
      <h1 className="display text-(length:--text-display-s)">Algo se rompió</h1>
      <p className="max-w-[52ch] text-[var(--color-muted)]">
        Ha fallado algo por nuestra parte. Si sigue pasando, avisa por Discord.
      </p>
      <div>
        <button type="button" className="btn btn--primary" onClick={reset}>
          Reintentar
        </button>
      </div>
    </div>
  );
}
