import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de cookies" };

export default function CookiesPage() {
  return (
    <article className="shell grid max-w-[46rem] gap-[var(--space-lg)] py-[var(--space-2xl)]">
      <header className="grid gap-[var(--space-sm)]">
        <span className="meta">Última actualización: 19 de agosto de 2026</span>
        <h1 className="display text-(length:--text-display-s)">Política de cookies</h1>
      </header>

      <div className="prose">
        <h2>Qué son las cookies</h2>
        <p>
          Son pequeños archivos que un sitio guarda en tu navegador para
          recordar información entre visitas. Novals.es solo usa cookies
          técnicas, necesarias para que la web funcione: no usamos cookies de
          analítica ni de publicidad, así que no necesitamos pedirte
          consentimiento para ellas (quedan exentas por el artículo 22.2 de
          la LSSI).
        </p>

        <h2>Cookies que usamos</h2>
        <ul>
          <li>
            <strong>Sesión (Auth.js):</strong> te mantiene identificado tras
            entrar con Discord. Dura hasta que cierras sesión o caduca (por
            defecto, 30 días).
          </li>
          <li>
            <strong><code>ref</code>:</strong> recuerda temporalmente quién
            te invitó al proyecto, para atribuir el alta al enlace de
            invitación que usaste. Dura 30 días.
          </li>
        </ul>

        <h2>Cómo desactivarlas</h2>
        <p>
          Puedes bloquear o borrar las cookies desde la configuración de tu
          navegador. Si bloqueas la cookie de sesión, no podrás mantener la
          sesión iniciada con Discord; si bloqueas la cookie{" "}
          <code>ref</code>, simplemente no se atribuirá tu alta a quien te
          haya invitado.
        </p>

        <h2>Cambios en esta política</h2>
        <p>
          Si en el futuro incorporamos cookies de analítica o de terceros,
          actualizaremos esta página y, si la ley lo exige, pediremos tu
          consentimiento antes de activarlas.
        </p>
      </div>

      <div className="flex flex-wrap gap-[var(--space-md)] pt-[var(--space-md)] border-t border-[var(--color-rule)]">
        <Link href="/aviso-legal" className="nav-link">Aviso legal</Link>
        <Link href="/privacidad" className="nav-link">Privacidad</Link>
      </div>
    </article>
  );
}
