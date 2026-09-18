import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function PrivacidadPage() {
  return (
    <article className="shell grid max-w-[46rem] gap-[var(--space-lg)] py-[var(--space-2xl)]">
      <header className="grid gap-[var(--space-sm)]">
        <span className="meta">Última actualización: 19 de agosto de 2026</span>
        <h1 className="display text-(length:--text-display-s)">Política de privacidad</h1>
      </header>

      <div className="prose">
        <h2>Responsable del tratamiento</h2>
        <p>
          <strong>gmstudios_</strong>, a través de novals.es, es responsable
          de los datos que se tratan en este sitio. Puedes escribir para
          cualquier asunto relacionado con tus datos a{" "}
          <a href="mailto:contacto@novals.es">contacto@novals.es</a>.
        </p>

        <h2>Qué datos tratamos</h2>
        <ul>
          <li>
            <strong>Cuenta:</strong> al entrar con Discord (único método de
            acceso) recibimos tu identificador de Discord, tu nombre de
            usuario y tu avatar. Para el panel de staff también se consulta,
            mediante un bot, los roles que tienes en el servidor de Discord
            de la comunidad.
          </li>
          <li>
            <strong>Postulaciones:</strong> los datos que escribes
            voluntariamente en los formularios de acceso (whitelist,
            facción, staff).
          </li>
          <li>
            <strong>Foro:</strong> los mensajes e hilos que publicas,
            visibles para el resto de la comunidad.
          </li>
          <li>
            <strong>Tickets de soporte:</strong> el contenido de la
            conversación con el equipo de soporte; en la categoría de
            donaciones puede incluir una referencia de pago y una fecha,
            nunca datos de tarjeta.
          </li>
          <li>
            <strong>Insignias y actividad:</strong> los logros e insignias
            asociados a tu cuenta.
          </li>
          <li>
            <strong>Invitaciones:</strong> si entras a través del enlace de
            invitación de otra persona, se guarda temporalmente a quién
            atribuir el alta (ver{" "}
            <Link href="/cookies">política de cookies</Link>).
          </li>
        </ul>
        <p>
          No pedimos ni tratamos tu email ni tu contraseña de Discord: el
          inicio de sesión lo gestiona Discord mediante OAuth, y novals.es
          solo recibe el perfil público que autorices.
        </p>

        <h2>Para qué usamos tus datos</h2>
        <ul>
          <li>Gestionar tu cuenta y darte acceso a las secciones correspondientes según tu rol.</li>
          <li>Tramitar tus postulaciones y tickets de soporte.</li>
          <li>Mostrar el foro y atribuir correctamente cada mensaje a su autor.</li>
          <li>Reconocer quién te invitó al proyecto, para las insignias asociadas.</li>
          <li>Moderar la comunidad y mantener la seguridad del sitio.</li>
        </ul>

        <h2>Base legal</h2>
        <p>
          El tratamiento se basa en la ejecución de la relación que se
          establece al usar el sitio (art. 6.1.b RGPD) y, en la moderación y
          seguridad, en nuestro interés legítimo en mantener un espacio
          funcional y respetuoso (art. 6.1.f RGPD).
        </p>

        <h2>Con quién compartimos tus datos</h2>
        <ul>
          <li>
            <strong>Discord Inc.</strong>, como proveedor del inicio de
            sesión y, para el staff, de la sincronización de roles; el
            tratamiento que hace Discord de tus datos se rige por su propia
            política de privacidad.
          </li>
          <li>El proveedor de alojamiento donde corre la web, en la medida necesaria para prestar el servicio.</li>
        </ul>
        <p>
          No cedemos ni vendemos tus datos a terceros con fines
          publicitarios, ni utilizamos herramientas de analítica o
          publicidad en el sitio.
        </p>

        <h2>Cuánto tiempo conservamos tus datos</h2>
        <p>
          Mientras tu cuenta esté activa. Si solicitas la baja, se eliminan o
          anonimizan los datos que ya no sean necesarios, salvo los que
          debamos conservar por una obligación legal o para resolver una
          controversia pendiente (por ejemplo, un ticket abierto).
        </p>

        <h2>Tus derechos</h2>
        <p>
          Puedes ejercer tus derechos de acceso, rectificación, supresión,
          oposición, limitación y portabilidad escribiendo a{" "}
          <a href="mailto:contacto@novals.es">contacto@novals.es</a>. Si
          consideras que no hemos atendido tu solicitud correctamente, puedes
          reclamar ante la{" "}
          <a href="https://www.aepd.es" target="_blank" rel="noreferrer noopener">
            Agencia Española de Protección de Datos
          </a>.
        </p>

        <h2>Menores de edad</h2>
        <p>
          Discord exige tener al menos 13 años para usar su servicio, y por
          tanto también para entrar en novals.es. Si eres menor de 14 años,
          necesitas el consentimiento de tu madre, padre o tutor para que
          tratemos tus datos.
        </p>

        <h2>Seguridad</h2>
        <p>
          Aplicamos medidas técnicas razonables (conexión cifrada, cabeceras
          de seguridad, control de acceso por roles) para proteger tus
          datos, aunque ningún sistema es invulnerable al cien por cien.
        </p>
      </div>

      <div className="flex flex-wrap gap-[var(--space-md)] pt-[var(--space-md)] border-t border-[var(--color-rule)]">
        <Link href="/aviso-legal" className="nav-link">Aviso legal</Link>
        <Link href="/cookies" className="nav-link">Cookies</Link>
      </div>
    </article>
  );
}
