#!/bin/sh
# Copia de la base de datos y de las imágenes subidas.
#
# La base se saca con la orden «.backup» de SQLite y no copiando el fichero:
# copiarlo mientras alguien escribe deja una copia rota, y eso solo se descubre
# el día que hace falta restaurarla.
#
# Todo se prepara dentro del contenedor y se saca con «docker compose cp», así el
# script no depende de cómo se llamen los volúmenes.
#
# Instalación en el servidor, desde la carpeta del proyecto:
#   sudo crontab -e
#   17 4 * * * cd /opt/novals && ./deploy/copia.sh >> /var/log/novals-copia.log 2>&1

set -eu

# Se ejecuta desde la carpeta que tiene el docker-compose.yml.
cd "$(dirname "$0")/.."

DESTINO="${NOVALS_COPIAS:-/var/backups/novals}"
DIAS="${NOVALS_DIAS:-30}"
FECHA="$(date +%F)"

mkdir -p "$DESTINO"

docker compose exec -T web sh -c "
	set -e
	sqlite3 /app/data/nova.db \".backup '/tmp/nova.db'\"
	tar czf /tmp/uploads.tar.gz -C /app/public/uploads .
"

docker compose cp web:/tmp/nova.db "$DESTINO/nova-$FECHA.db"
docker compose cp web:/tmp/uploads.tar.gz "$DESTINO/uploads-$FECHA.tar.gz"
docker compose exec -T web rm -f /tmp/nova.db /tmp/uploads.tar.gz

# Que la copia se pueda abrir se comprueba ahora, no el día de restaurarla.
docker compose exec -T web sqlite3 /app/data/nova.db "pragma quick_check" >/dev/null

find "$DESTINO" -name "nova-*.db" -mtime "+$DIAS" -delete
find "$DESTINO" -name "uploads-*.tar.gz" -mtime "+$DIAS" -delete

echo "$(date '+%F %T') · copia hecha en $DESTINO"
