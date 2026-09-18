import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aviso legal" };

export default function AvisoLegalPage() {
  return (
    <article className="shell grid max-w-[46rem] gap-[var(--space-lg)] py-[var(--space-2xl)]">
      <header className="grid gap-[var(--space-sm)]">
        <span className="meta">Última actualización: 19 de agosto de 2026</span>
        <h1 className="display text-(length:--text-display-s)">Aviso legal</h1>
      </header>

      <div className="prose">
        <h2>Identificación</h2>
        <p>
          Este sitio (novals.es) lo opera <strong>gmstudios_</strong>, responsable
          del proyecto de rol NOVA Los Santos. Para cualquier consulta
          relacionada con este aviso legal, la privacidad o el uso del sitio,
          escribe a <a href="mailto:contacto@novals.es">contacto@novals.es</a>.
        </p>
        <p>
          NOVA Los Santos es un proyecto de comunidad centrado en el rol
          (roleplay) sobre Grand Theft Auto V. No tiene relación ni está
          avalado por Rockstar Games ni Take-Two Interactive, titulares de las
          marcas y contenidos originales de GTA V.
        </p>

        <h2>Objeto</h2>
        <p>
          A través de novals.es se ofrece información sobre el servidor de
          rol (noticias, normativa, formularios de acceso), un foro para la
          comunidad, un sistema de tickets de soporte y la posibilidad de
          aportar al proyecto mediante donaciones voluntarias.
        </p>

        <h2>Condiciones de uso</h2>
        <p>
          El acceso a determinadas secciones (foro, tickets, postulaciones,
          perfil) requiere iniciar sesión con una cuenta de Discord. Al usar
          el sitio te comprometes a:
        </p>
        <ul>
          <li>No suplantar a otra persona ni facilitar datos falsos en los formularios.</li>
          <li>
            Mantener un trato respetuoso en el foro y los tickets; el equipo
            de moderación puede retirar contenido o restringir el acceso ante
            un uso indebido.
          </li>
          <li>No usar el sitio para fines distintos de los propios de la comunidad de rol.</li>
        </ul>
        <p>
          El acceso mediante Discord está sujeto además a los términos de
          servicio de Discord Inc., ajenos a este sitio.
        </p>

        <h2>Donaciones</h2>
        <p>
          Las donaciones al proyecto se gestionan fuera de esta web (por
          ejemplo, a través de un ticket de soporte con la referencia del
          pago). Novals.es no procesa ni almacena datos de tarjeta ni de
          medios de pago: pedimos expresamente no incluirlos en ningún
          formulario o mensaje.
        </p>

        <h2>Propiedad intelectual</h2>
        <p>
          Los textos, el diseño, el código y los elementos gráficos propios
          de novals.es (logotipo, identidad de NOVA Los Santos, contenidos de
          noticias y normativa) pertenecen a gmstudios_ o se usan con la
          autorización correspondiente. El contenido publicado por las
          personas usuarias en el foro y los tickets es responsabilidad de
          quien lo escribe.
        </p>

        <h2>Responsabilidad</h2>
        <p>
          Se procura mantener el sitio disponible y con información correcta,
          pero no se garantiza la ausencia de interrupciones o errores. NOVA
          Los Santos no se hace responsable del contenido publicado por
          terceros en el foro, ni del uso que se dé a los enlaces externos
          (por ejemplo, al servidor de Discord de la comunidad).
        </p>

        <h2>Legislación aplicable</h2>
        <p>
          Este aviso legal se rige por la legislación española. Para
          cualquier controversia derivada del uso del sitio, y salvo que la
          normativa de protección de personas consumidoras disponga otra
          cosa, las partes se someten a los juzgados y tribunales que
          correspondan conforme a derecho.
        </p>
      </div>

      <div className="flex flex-wrap gap-[var(--space-md)] pt-[var(--space-md)] border-t border-[var(--color-rule)]">
        <Link href="/privacidad" className="nav-link">Privacidad</Link>
        <Link href="/cookies" className="nav-link">Cookies</Link>
      </div>
    </article>
  );
}
