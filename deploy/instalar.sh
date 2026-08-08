#!/bin/bash
# Deja el servidor listo y la web arrancando. Es para Linux (Ubuntu o Debian);
# el montaje real corre dentro de WSL sobre Windows Server, donde quien
# atiende el dominio es un Caddy de Windows, fuera de esta distro (ver
# docs/despliegue-windows.md).
#
#   sudo ./deploy/instalar.sh
#
# Se puede volver a lanzar las veces que haga falta: lo que ya esté puesto no se
# toca. Lo que hace, por orden:
#   1. Docker, si no está.
#   2. El fichero .env, a partir de .env.produccion.
#   3. Levanta la web y comprueba que responde.
#   4. Deja puesta la copia de seguridad diaria.

set -euo pipefail

DOMINIO="novals.es"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

AVISO_COPIA=0
[ "$#" -eq 0 ] || { printf 'Opción desconocida: %s\n' "$1" >&2; exit 2; }

decir() { printf '\n\033[1m· %s\033[0m\n' "$1"; }
fallar() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fallar "Hace falta root: sudo ./deploy/instalar.sh"

cd "$RAIZ"

# ---- 1. Docker ----
if command -v docker >/dev/null 2>&1; then
	decir "Docker ya está puesto"
else
	decir "Instalando Docker"
	curl -fsSL https://get.docker.com | sh
	systemctl enable --now docker
fi

docker compose version >/dev/null 2>&1 || fallar "Falta el complemento «compose» de Docker"

decir "Caddy: fuera de esta distro. Quien atiende el dominio es el de Windows"

# ---- 2. Variables ----
if [ -f .env ]; then
	decir "El .env ya está"
elif [ -f .env.produccion ]; then
	decir "Creando .env a partir de .env.produccion"
	cp .env.produccion .env
	chmod 600 .env
else
	fallar "No hay .env ni .env.produccion: sin eso la web no arranca"
fi

grep -q '^AUTH_URL="https://' .env || fallar "AUTH_URL tiene que empezar por https:// en el .env"

# ---- 3. Arrancar ----
decir "Construyendo y levantando la web (la primera vez tarda unos minutos)"
docker compose up -d --build

decir "Esperando a que responda"
for intento in $(seq 1 30); do
	if curl -fsS -o /dev/null -m 5 http://127.0.0.1:3000/; then
		printf '  responde a la primera petición\n'
		break
	fi
	[ "$intento" -eq 30 ] && {
		docker compose logs --tail 40 web
		fallar "No responde. Arriba están las últimas líneas del registro"
	}
	sleep 4
done

# ---- 4. Copias ----
decir "Dejando puesta la copia diaria"
chmod +x deploy/copia.sh

# Nada de aquí abajo tumba la instalación: para cuando se llega a este punto la
# web ya está en pie, y quedarse sin copia programada es un aviso, no un motivo
# para dejar el servidor a medias —sobre todo con los pasos que vengan después,
# que en Windows son los que ponen el proxy.
programar_copia() {
	# Una Ubuntu recién puesta —y la de WSL sobre todo— no trae cron. El
	# «update» tiene que ir delante: sin él, en una distro nueva el paquete no
	# se encuentra.
	if ! command -v crontab >/dev/null 2>&1; then
		apt-get update -qq || return 1
		apt-get install -y -qq cron || return 1
	fi

	systemctl enable --now cron >/dev/null 2>&1 \
		|| printf '  ojo: cron está puesto pero no arrancado\n'

	local linea="17 4 * * * cd $RAIZ && ./deploy/copia.sh >> /var/log/novals-copia.log 2>&1"
	if crontab -l 2>/dev/null | grep -qF "$RAIZ/deploy/copia.sh"; then
		printf '  ya estaba\n'
	else
		(crontab -l 2>/dev/null; echo "$linea") | crontab - || return 1
		printf '  todos los días a las 4:17\n'
	fi
}

if ! programar_copia; then
	AVISO_COPIA=1
	printf '  ojo: no se ha podido programar. La web sigue en pie\n'
	printf '       para hacerlo luego: ver docs/despliegue-windows.md\n'
fi

echo
echo "────────────────────────────────────────────────"

cat <<FIN
 La web está en pie, escuchando en el 3000.

 Aquí no se ha tocado el proxy: quien atiende
 $DOMINIO está fuera de esta distro.
FIN

cat <<FIN

 Registro de la web:   docker compose logs -f web
 Copia a mano:         ./deploy/copia.sh
FIN

# Con «set -e», una lista «condición && orden» que da falso aborta el guion: por
# eso esto va en un if y no en una línea.
if [ "$AVISO_COPIA" -eq 1 ]; then
	printf ' Copia diaria:         SIN PROGRAMAR\n'
fi

echo "────────────────────────────────────────────────"
echo

# Explícito: lo último que se ejecute no puede decidir por su cuenta con qué
# código sale el guion, que es lo que mira quien lo llama.
exit 0
