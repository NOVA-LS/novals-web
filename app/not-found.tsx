import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell grid min-h-[60vh] content-center gap-[var(--space-md)]">
      <span className="meta">Error 404</span>
      <h1 className="display text-(length:--text-display-s)">
        Esa página no existe
      </h1>
      <p className="max-w-[52ch] text-[var(--color-muted)]">
        El enlace está roto o la página se movió de sitio.
      </p>
      <div>
        <Link href="/" className="btn btn--primary">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
