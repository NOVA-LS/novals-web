# Deja un Windows Server 2022 o 2025 listo y la web arrancando. También sirve
# para subir código nuevo: relanzado, vuelve a copiar el proyecto entero a WSL
# (sin arrastrar ficheros viejos), reconstruye la imagen y aplica lo que haga
# falta (migraciones, copia de seguridad programada, Caddy, autoarranque...).
#
#   Clic derecho -> "Ejecutar con PowerShell" (como Administrador)
#   o bien:  powershell -ExecutionPolicy Bypass -File .\deploy\windows\desplegar.ps1
#
# Va en dos vueltas: la primera pone WSL y pide reiniciar; la segunda hace el
# resto. Se puede relanzar las veces que haga falta: lo de WSL/Docker/Caddy no
# se toca si ya estaba, pero el código del proyecto, el Caddyfile y los guiones
# de dentro de la distro se rehacen de cero cada vez.
#
# Es el único guion de todo el despliegue: como solo se usa Windows Server, no
# hace falta repartir esto en media docena de ficheros (uno de Linux para
# construir, otro para la copia diaria, otro para el arranque automático, un
# .bat para forzarlo a mano...). Lo que en otra vida vivía en ficheros sueltos
# —instalar.sh, copia.sh, autoarranque.ps1, arrancar.bat, el Caddyfile— se
# escribe aquí mismo como texto y se deja en su sitio en cada arranque.
#
# Lo que monta:
#   internet -> Windows (80/443) -> Caddy -> 127.0.0.1:3000 -> WSL2 -> Docker -> la web
#
# Para forzar un reinicio de la web a mano, sin esperar al servicio de
# autoarranque (normalmente no hace falta: se relanza solo si se cae):
#   wsl -d Ubuntu-24.04 -u root -e sh -c "cd /opt/novals && docker compose up -d"
#
# Si algo falla:
#   "No se puede habilitar la plataforma de máquina virtual" -> el VPS no
#     permite virtualización anidada. No hay arreglo desde dentro: o lo
#     habilita el proveedor, o toca un VPS Linux.
#   Caddy arranca pero no da certificado -> el puerto 80 está ocupado, cerrado
#     en el cortafuegos, o el DNS todavía no apunta aquí.
#   Caddy responde 502 -> la web no está levantada dentro de WSL, o WSL no
#     está arrancado. Compruébalo con: wsl -l -v (tiene que decir "Running").
#   Tras reiniciar el servidor, la web no vuelve -> mira el servicio NovaWSL
#     (Get-Service NovaWSL) y su registro en C:\caddy\logs\wsl.log.
#   Los avisos llegan tarde -> el flush_interval -1 del Caddyfile es lo que
#     evita que el canal de eventos se quede almacenado en el proxy.
#
# Antes de nada, esto no depende del servidor y hay que tenerlo hecho aparte:
#   - DNS: A <dominio> y A www.<dominio> -> la IP de este servidor.
#   - Discord -> OAuth2 -> Redirects: https://<dominio>/api/auth/callback/discord

[CmdletBinding()]
param(
	[string]$Distro = "Ubuntu-24.04",
	[string]$Dominio = "novals.es",
	# Carpeta dentro de Linux. No se usa /mnt/c: desde ahí Docker va lentísimo.
	[string]$CarpetaLinux = "/opt/novals",
	[string]$CarpetaCaddy = "C:\caddy",
	# Salta la tarea de arranque automático, que es lo único que pide contraseña.
	[switch]$SinArranqueAutomatico
)

# "Continue" y no "Stop" a propósito: este guion llama sobre todo a programas de
# fuera -wsl, docker, caddy, nssm- y varios escriben su registro normal por la
# salida de errores. Con "Stop", PowerShell toma eso por un fallo mortal y aborta
# aunque haya ido bien. Cada paso comprueba aquí abajo su propio código de salida,
# que es lo que de verdad dice si algo falló.
$ErrorActionPreference = "Continue"
# Sin esto, lo que devuelve wsl.exe llega en UTF-16 y no hay quien lo compare.
$env:WSL_UTF8 = 1
# La barra de progreso de las descargas las vuelve diez veces más lentas.
$ProgressPreference = "SilentlyContinue"
# El PowerShell que trae Windows Server negocia TLS viejo por defecto y varias de
# estas descargas lo rechazan.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RaizProyecto = (Resolve-Path "$PSScriptRoot\..\..").Path

function Decir($texto) { Write-Host "`n- $texto" -ForegroundColor Cyan }
function Bien($texto) { Write-Host "  $texto" -ForegroundColor Green }
function Ojo($texto) { Write-Host "  $texto" -ForegroundColor Yellow }
function Fallar($texto) { Write-Host "`nX $texto`n" -ForegroundColor Red; exit 1 }

function EnLinux($orden) {
	# Todo se ejecuta como root: la distro se instala sin usuario para no tener
	# que contestar preguntas a mitad de la instalación.
	wsl -d $Distro -u root -e sh -c $orden
}

# Escribe texto dentro de la distro directamente por su ruta de red, sin pasar
# por argumentos de línea de comandos: así los guiones de dentro de WSL —con
# sus propias comillas, sus "$variables" de bash y sus heredocs— no se pelean
# con el escapado de PowerShell ni con el de wsl.exe.
function EscribirEnDistro($rutaLinux, $contenido) {
	$rutaWindows = "\\wsl.localhost\$Distro" + ($rutaLinux -replace '/', '\')
	# LF y sin BOM: un BOM delante del "#!" le rompe el shebang a sh, y un CRLF
	# en un heredoc de bash deja el "EOF" de cierre sin reconocer.
	$texto = $contenido -replace "`r`n", "`n"
	[System.IO.File]::WriteAllText($rutaWindows, $texto, (New-Object System.Text.UTF8Encoding($false)))
}

# ---- Comprobaciones ----

$identidad = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identidad)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
	Fallar "Hay que abrir PowerShell como Administrador."
}

if (-not (Test-Path "$RaizProyecto\docker-compose.yml")) {
	Fallar "No encuentro el proyecto. Este guion va dentro de deploy\windows\ del proyecto."
}

Write-Host ""
Write-Host " -- NOVA - Los Santos - instalación ----------" -ForegroundColor White
Write-Host ""

# ---- 1. WSL ----

Decir "WSL"
$wslPuesto = $false
try {
	wsl --status | Out-Null
	if ($LASTEXITCODE -eq 0) { $wslPuesto = $true }
} catch { $wslPuesto = $false }

if (-not $wslPuesto) {
	Ojo "no está: instalando"
	wsl --install --no-distribution
	Write-Host ""
	Write-Host " ---------------------------------------------" -ForegroundColor Yellow
	Write-Host "  Hay que REINICIAR el servidor." -ForegroundColor Yellow
	Write-Host "  Cuando vuelva, lanza este mismo guion otra vez." -ForegroundColor Yellow
	Write-Host " ---------------------------------------------" -ForegroundColor Yellow
	Write-Host ""
	Fallar "Reinicia y vuelve a lanzarlo."
}
Bien "puesto"

# La lista viene con una línea por distro; se busca la nuestra tal cual.
$distros = (wsl -l -q) -split "`r?`n" | Where-Object { $_.Trim() -ne "" }
if ($distros -notcontains $Distro) {
	Decir "Instalando $Distro"
	# Sin lanzarla: si se abre, se queda esperando a que alguien invente un
	# usuario y el guion no puede seguir.
	wsl --install -d $Distro --no-launch
	if ($LASTEXITCODE -ne 0) {
		Fallar "No se ha podido instalar $Distro. Si habla de virtualización, el VPS no la permite: hay que pedírsela al proveedor."
	}
} else {
	Bien "$Distro ya está"
}

# ---- 2. systemd dentro de la distro ----

Decir "systemd dentro de $Distro"
# El "default=root" es necesario aparte de los "-u root" de EnLinux: los accesos
# por \\wsl.localhost\ (EscribirEnDistro) no llevan usuario y usan el que la
# distro tenga por defecto. Si en algún momento se creó ahí un usuario normal
# (p. ej. abriendo la distro a mano), ese quedaba de defecto y no podía escribir
# en /opt/novals, que es de root.
EnLinux "printf '[boot]\nsystemd=true\n\n[user]\ndefault=root\n' > /etc/wsl.conf"
if ($LASTEXITCODE -ne 0) {
	Fallar "No arranca $Distro. Si habla de virtualización, el VPS no la permite."
}

wsl --terminate $Distro | Out-Null
Start-Sleep -Seconds 3
EnLinux "systemctl is-system-running || true" | Out-Null
Bien "activado"

# ---- 3. Docker dentro de la distro ----

Decir "Docker dentro de $Distro"
EnLinux "command -v docker >/dev/null 2>&1"
if ($LASTEXITCODE -ne 0) {
	Ojo "no está: instalando (tarda un par de minutos)"
	EnLinux "curl -fsSL https://get.docker.com | sh"
	if ($LASTEXITCODE -ne 0) { Fallar "No se ha podido instalar Docker dentro de $Distro." }
	EnLinux "systemctl enable --now docker"
} else {
	Bien "ya está"
}

EnLinux "docker run --rm hello-world >/dev/null 2>&1"
if ($LASTEXITCODE -ne 0) { Fallar "Docker está pero no arranca contenedores. Mira: wsl -d $Distro -u root -e journalctl -u docker" }
Bien "funcionando"

# ---- 4. Copiar el proyecto al disco de Linux ----

Decir "Copiando el proyecto a $CarpetaLinux"
$rutaEnLinux = (wsl -d $Distro -e wslpath -a "$RaizProyecto").Trim()
if (-not $rutaEnLinux) { Fallar "No he podido traducir la ruta del proyecto." }

# «rm -rf» primero y no un «cp -r» encima de lo que ya hubiera: en una
# actualización, un fichero borrado o renombrado en el origen se quedaba
# rondando en $CarpetaLinux, y de ahí salían builds con código de dos
# versiones distintas mezclado. Lo que persiste va en volúmenes de Docker
# aparte (nova-data, nova-uploads), así que borrar esto no toca datos.
EnLinux "rm -rf '$CarpetaLinux' && mkdir -p '$CarpetaLinux' && cp -r '$rutaEnLinux/.' '$CarpetaLinux/'"
if ($LASTEXITCODE -ne 0) { Fallar "No se ha podido copiar el proyecto." }
Bien "copiado"

# ---- 5. El .env, la imagen y la copia diaria ----
#
# Esto vivía en deploy/instalar.sh, aparte. Ahora se escribe dentro de la
# distro en cada arranque —vía EscribirEnDistro, sin pasar por argumentos de
# wsl.exe— y se ejecuta una vez. La copia de seguridad se deja como un guion
# propio de verdad (deploy-copia.sh) porque a ese lo tiene que poder llamar
# cron por su cuenta, sin este PowerShell de por medio.

Decir "Preparando el .env, construyendo la imagen y programando la copia diaria"

$ScriptInstalar = @'
#!/bin/sh
set -eu
cd '__CARPETA__'

if [ -f .env ]; then
	echo '  el .env ya estaba'
elif [ -f .env.produccion ]; then
	echo '  creando .env a partir de .env.produccion'
	cp .env.produccion .env
	chmod 600 .env .env.produccion
else
	echo '  falta .env y .env.produccion: sin eso la web no arranca' >&2
	exit 1
fi

grep -q '^AUTH_URL="https://' .env || { echo '  AUTH_URL tiene que empezar por https:// en el .env' >&2; exit 1; }

echo '  construyendo la imagen (la primera vez tarda varios minutos)'
docker compose build

# El contenedor no corre como root: si los volúmenes vienen de una instalación
# anterior a ese cambio, sus ficheros siguen siendo de root y el usuario sin
# privilegios no podría ni leer la base de datos. En una instalación nueva los
# volúmenes están vacíos y esto no hace nada.
echo '  ajustando permisos de los volúmenes'
docker compose run --rm --user root --entrypoint sh web -c 'chown -R node:node /app/data /app/public/uploads'

echo '  levantando la web'
docker compose up -d

echo '  programando la copia diaria'
if ! command -v crontab >/dev/null 2>&1; then
	apt-get update -qq
	apt-get install -y -qq cron
fi
systemctl enable --now cron >/dev/null 2>&1 || echo '  ojo: cron puesto pero no arrancado'

chmod +x deploy-copia.sh

if crontab -l 2>/dev/null | grep -qF 'deploy-copia.sh'; then
	echo '  la copia ya estaba programada'
else
	(crontab -l 2>/dev/null; echo "17 4 * * * cd '__CARPETA__' && ./deploy-copia.sh >> /var/log/novals-copia.log 2>&1") | crontab -
	echo '  copia programada: todos los días a las 4:17'
fi
'@.Replace('__CARPETA__', $CarpetaLinux)

$ScriptCopia = @'
#!/bin/sh
# Copia de la base de datos y de las imágenes subidas.
#
# La base se saca con la orden «.backup» de SQLite y no copiando el fichero:
# copiarlo mientras alguien escribe deja una copia rota, y eso solo se
# descubre el día que hace falta restaurarla.
#
# La programa deploy\windows\desplegar.ps1 en cada arranque; para lanzarla a
# mano basta con: cd /opt/novals && ./deploy-copia.sh
set -eu
cd '__CARPETA__'

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
'@.Replace('__CARPETA__', $CarpetaLinux)

EscribirEnDistro "$CarpetaLinux/deploy-copia.sh" $ScriptCopia
EscribirEnDistro "$CarpetaLinux/deploy-instalar.sh" $ScriptInstalar
EnLinux "chmod +x '$CarpetaLinux/deploy-copia.sh' '$CarpetaLinux/deploy-instalar.sh' && '$CarpetaLinux/deploy-instalar.sh'"
if ($LASTEXITCODE -ne 0) { Fallar "La web no ha levantado. Mira: wsl -d $Distro -u root -e sh -c 'cd $CarpetaLinux && docker compose logs --tail 50 web'" }

Decir "Comprobando desde Windows"
$responde = $false
foreach ($intento in 1..20) {
	try {
		Invoke-WebRequest -Uri "http://127.0.0.1:3000/" -UseBasicParsing -TimeoutSec 5 | Out-Null
		$responde = $true
		break
	} catch { Start-Sleep -Seconds 3 }
}
if (-not $responde) { Fallar "La web responde dentro de WSL pero no desde Windows. Es el puente de puertos de WSL." }
Bien "responde en 127.0.0.1:3000"

# ---- 6. Liberar el puerto 80 ----

Decir "Puerto 80"
$iis = Get-Service -Name W3SVC -ErrorAction SilentlyContinue
if ($iis -and $iis.Status -eq "Running") {
	Ojo "lo tenía IIS: parándolo"
	Stop-Service W3SVC -Force
	Set-Service W3SVC -StartupType Disabled
	Bien "liberado"
} else {
	Bien "libre"
}

# ---- 7. Caddy ----

Decir "Caddy"
New-Item -ItemType Directory -Force -Path "$CarpetaCaddy\logs" | Out-Null
# El almacén de certificados, en ruta fija: el Caddyfile lo apunta ahí para que
# den igual el usuario del servicio y el de quien lo pruebe a mano.
New-Item -ItemType Directory -Force -Path "$CarpetaCaddy\data" | Out-Null

if (-not (Test-Path "$CarpetaCaddy\caddy.exe")) {
	Ojo "descargando"
	try {
		Invoke-WebRequest -Uri "https://caddyserver.com/api/download?os=windows&arch=amd64" `
			-OutFile "$CarpetaCaddy\caddy.exe" -UseBasicParsing
	} catch {
		Fallar "No se ha podido descargar Caddy: $($_.Exception.Message)"
	}
}
if (-not (Test-Path "$CarpetaCaddy\caddy.exe")) { Fallar "Caddy no está donde debería." }

# Vivía en deploy\windows\Caddyfile, aparte; se escribe aquí con el dominio ya
# puesto, en vez de copiar un fichero fijo que lo llevaba a mano.
$Caddyfile = @'
{
	# Dónde se guardan los certificados. Sin esto Caddy los mete en el perfil de
	# quien lo ejecuta, y como servicio ese usuario es SYSTEM: los que consigas
	# probándolo a mano no le sirven al servicio, y acaba pidiendo otros. Let's
	# Encrypt no da infinitos por semana, así que conviene un sitio fijo.
	storage file_system __CARPETA_CADDY__\data
}

__DOMINIO__ {
	reverse_proxy 127.0.0.1:3000 {
		# El canal de eventos es un flujo que se queda abierto: si Caddy lo
		# guarda en un buffer, los avisos llegan a ratos o no llegan.
		flush_interval -1
	}

	# Una tanda de galería son diez fotos de diez megas.
	request_body {
		max_size 110MB
	}

	encode gzip

	log {
		output file __CARPETA_CADDY__\logs\novals.log
		format console
	}
}

# Quien llegue por www acaba en el dominio de verdad. Sin esto, la sesión
# abierta en una de las dos direcciones no vale en la otra: para las cookies
# son sitios distintos.
www.__DOMINIO__ {
	redir https://__DOMINIO__{uri} permanent
}
'@.Replace('__DOMINIO__', $Dominio).Replace('__CARPETA_CADDY__', $CarpetaCaddy)

Set-Content -Path "$CarpetaCaddy\Caddyfile" -Value $Caddyfile -Encoding UTF8

# Caddy cuenta lo que hace por la salida de errores aunque vaya todo bien, así
# que aquí solo vale el código de salida.
& "$CarpetaCaddy\caddy.exe" validate --config "$CarpetaCaddy\Caddyfile" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fallar "El Caddyfile no vale." }
Bien "listo"

# ---- 8. Caddy como servicio ----

Decir "Caddy como servicio"
if (Get-Service -Name Caddy -ErrorAction SilentlyContinue) {
	Restart-Service Caddy
	Bien "ya estaba: reiniciado"
} else {
	# Caddy no habla con el gestor de servicios de Windows, así que hace falta
	# algo que lo envuelva. NSSM es lo que recomienda la propia documentación.
	$nssm = Get-ChildItem -Path $CarpetaCaddy -Filter nssm.exe -Recurse -ErrorAction SilentlyContinue |
		Where-Object { $_.FullName -match "win64" } | Select-Object -First 1

	if (-not $nssm) {
		Ojo "descargando NSSM"
		try {
			Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" `
				-OutFile "$CarpetaCaddy\nssm.zip" -UseBasicParsing
			Expand-Archive "$CarpetaCaddy\nssm.zip" -DestinationPath $CarpetaCaddy -Force
			Remove-Item "$CarpetaCaddy\nssm.zip" -Force
		} catch {
			Fallar "No se ha podido preparar NSSM: $($_.Exception.Message)"
		}
		$nssm = Get-ChildItem -Path $CarpetaCaddy -Filter nssm.exe -Recurse |
			Where-Object { $_.FullName -match "win64" } | Select-Object -First 1
	}
	if (-not $nssm) { Fallar "No he podido dejar NSSM en su sitio." }

	& $nssm.FullName install Caddy "$CarpetaCaddy\caddy.exe" "run --config $CarpetaCaddy\Caddyfile" | Out-Null
	& $nssm.FullName set Caddy AppDirectory $CarpetaCaddy | Out-Null
	& $nssm.FullName set Caddy Start SERVICE_AUTO_START | Out-Null

	# Lo que Caddy cuenta de los certificados sale por aquí, no por el registro
	# de visitas del Caddyfile. Sin esto, el día que no consiga un certificado no
	# hay dónde mirar por qué.
	& $nssm.FullName set Caddy AppStdout "$CarpetaCaddy\logs\servicio.log" | Out-Null
	& $nssm.FullName set Caddy AppStderr "$CarpetaCaddy\logs\servicio.log" | Out-Null
	& $nssm.FullName set Caddy AppRotateFiles 1 | Out-Null
	& $nssm.FullName set Caddy AppRotateBytes 10485760 | Out-Null

	Start-Service Caddy
	Bien "registrado y arrancado"
}

# ---- 9. Cortafuegos ----

Decir "Cortafuegos"
foreach ($puerto in 80, 443) {
	$nombre = "NOVA $puerto"
	if (-not (Get-NetFirewallRule -DisplayName $nombre -ErrorAction SilentlyContinue)) {
		New-NetFirewallRule -DisplayName $nombre -Direction Inbound -Protocol TCP `
			-LocalPort $puerto -Action Allow | Out-Null
	}
}
Bien "80 y 443 abiertos"
Ojo "si tu proveedor tiene su propio cortafuegos en el panel, ábrelos también ahí"

# ---- 10. Arranque automático ----
#
# Vivía en deploy\windows\autoarranque.ps1, aparte. El problema que resuelve:
# WSL no arranca solo si nadie inicia sesión, y además se apaga sola cuando
# lleva un rato sin que nadie la use. Una tarea programada solo cubre lo
# primero. Esto monta un servicio de Windows que mantiene la distro viva y la
# relanza si se muere.

Decir "Arranque automático tras reiniciar"
if ($SinArranqueAutomatico) {
	Ojo "saltado. Sin esto, un reinicio deja la web caída"
} else {
	$Servicio = "NovaWSL"

	Decir "  NSSM para el servicio $Servicio"
	$nssmArranque = Get-ChildItem -Path $CarpetaCaddy -Filter nssm.exe -Recurse -ErrorAction SilentlyContinue |
		Where-Object { $_.FullName -match "win64" } | Select-Object -First 1
	if (-not $nssmArranque) { Fallar "No encuentro NSSM. Tendría que haber quedado puesto en el paso de Caddy." }

	# "sleep infinity" es lo que impide que WSL se apague: mientras haya un
	# proceso dentro, la distro sigue en pie. Va en un .cmd y no como argumentos
	# sueltos para no pelearse con el escapado de comillas entre PowerShell,
	# NSSM y sh.
	$guionArranque = "$CarpetaCaddy\nova-wsl.cmd"
	$contenidoArranque = @"
@echo off
wsl.exe -d $Distro -u root -e sh -c "cd $CarpetaLinux && docker compose up -d && sleep infinity"
"@
	Set-Content -Path $guionArranque -Value $contenidoArranque -Encoding ASCII
	Bien "  $guionArranque"

	Decir "  Registrando el servicio"
	$yaExistia = [bool](Get-Service -Name $Servicio -ErrorAction SilentlyContinue)
	if ($yaExistia) {
		Ojo "  ya existía: parándolo para reconfigurarlo"
		Stop-Service $Servicio -Force -ErrorAction SilentlyContinue
		Start-Sleep -Seconds 2
	} else {
		& $nssmArranque.FullName install $Servicio $guionArranque | Out-Null
		if ($LASTEXITCODE -ne 0) { Fallar "NSSM no ha podido crear el servicio." }
	}

	& $nssmArranque.FullName set $Servicio Application $guionArranque | Out-Null
	& $nssmArranque.FullName set $Servicio DisplayName "NOVA - WSL y la web" | Out-Null
	& $nssmArranque.FullName set $Servicio Description "Mantiene WSL en pie y la web levantada" | Out-Null
	& $nssmArranque.FullName set $Servicio Start SERVICE_AUTO_START | Out-Null
	& $nssmArranque.FullName set $Servicio AppStdout "$CarpetaCaddy\logs\wsl.log" | Out-Null
	& $nssmArranque.FullName set $Servicio AppStderr "$CarpetaCaddy\logs\wsl.log" | Out-Null
	& $nssmArranque.FullName set $Servicio AppRotateFiles 1 | Out-Null
	& $nssmArranque.FullName set $Servicio AppRotateBytes 10485760 | Out-Null
	Bien "  configurado"

	Decir "  Usuario del servicio"
	if ($yaExistia) {
		# Ya venía configurado de una vez anterior. Se puede dejar como está: pedir
		# la contraseña a la fuerza y abortar si no la dan dejaría el servicio
		# parado, que es justo la web caída.
		Ojo "  ya estaba puesto. Intro para dejarlo como está, o escríbela para cambiarlo"
	} else {
		Write-Host ""
		Ojo "  Las distros de WSL pertenecen al usuario que las instaló, así que el"
		Ojo "  servicio tiene que correr como $($identidad.Name) y no como SYSTEM."
		Ojo "  Windows pide la contraseña para poder arrancarlo sin sesión abierta."
		Write-Host ""
	}

	$clave = Read-Host "  Contraseña de $($identidad.Name)" -AsSecureString
	$plana = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
		[Runtime.InteropServices.Marshal]::SecureStringToBSTR($clave))

	if ([string]::IsNullOrWhiteSpace($plana)) {
		if (-not $yaExistia) {
			Fallar "Sin contraseña el servicio no puede arrancar solo. Vuelve a lanzarlo."
		}
		Bien "  se queda el que ya tenía"
	} else {
		& $nssmArranque.FullName set $Servicio ObjectName $identidad.Name $plana | Out-Null
		if ($LASTEXITCODE -ne 0) { Fallar "NSSM no ha aceptado ese usuario o esa contraseña." }
		Bien "  puesto"
	}

	Decir "  Arrancando"
	Start-Service $Servicio -ErrorAction SilentlyContinue
	Start-Sleep -Seconds 5

	$estadoServicio = (Get-Service -Name $Servicio).Status
	if ($estadoServicio -ne "Running") {
		Write-Host ""
		Ojo "  El servicio no ha arrancado. Casi siempre es la contraseña."
		Ojo "  Mira el detalle en: $CarpetaCaddy\logs\wsl.log"
		Fallar "Servicio en estado $estadoServicio."
	}
	Bien "  en marcha"

	# La tarea programada de versiones antiguas de este guion ya sobra: el
	# servicio hace lo mismo y además relanza WSL si se cae.
	if (Get-ScheduledTask -TaskName "NOVA arrancar WSL" -ErrorAction SilentlyContinue) {
		Unregister-ScheduledTask -TaskName "NOVA arrancar WSL" -Confirm:$false -ErrorAction SilentlyContinue
	}
}

# ---- Final ----

Write-Host ""
Write-Host " ---------------------------------------------" -ForegroundColor White
Write-Host "  Listo. Comprueba https://$Dominio" -ForegroundColor White
Write-Host ""
Write-Host "  Si no carga, repasa que esté hecho esto," -ForegroundColor Gray
Write-Host "  que no depende del servidor:" -ForegroundColor Gray
Write-Host "    - DNS: A $Dominio y A www.$Dominio -> esta IP" -ForegroundColor Gray
Write-Host "    - Discord -> OAuth2 -> Redirects:" -ForegroundColor Gray
Write-Host "      https://$Dominio/api/auth/callback/discord" -ForegroundColor Gray
Write-Host ""
Write-Host "  Registro de la web:" -ForegroundColor Gray
Write-Host "    wsl -d $Distro -u root -e sh -c `"cd $CarpetaLinux && docker compose logs -f web`"" -ForegroundColor Gray
Write-Host "  Registro de Caddy:  Get-Content $CarpetaCaddy\logs\novals.log -Wait" -ForegroundColor Gray
Write-Host "  Copia a mano:       wsl -d $Distro -u root -e sh -c `"cd $CarpetaLinux && ./deploy-copia.sh`"" -ForegroundColor Gray
Write-Host ""
Write-Host "  La prueba de verdad: reinicia el servidor y entra" -ForegroundColor Gray
Write-Host "  sin iniciar sesión. Si carga, aguanta." -ForegroundColor Gray
Write-Host " ---------------------------------------------" -ForegroundColor White
Write-Host ""
