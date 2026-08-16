# Deja un Windows Server 2022 o 2025 listo y la web arrancando. También sirve
# para subir código nuevo: relanzado, vuelve a copiar el proyecto entero a WSL
# (sin arrastrar ficheros viejos) y reconstruye.
#
#   Clic derecho -> "Ejecutar con PowerShell" (como Administrador)
#   o bien:  powershell -ExecutionPolicy Bypass -File .\deploy\windows\desplegar.ps1
#
# Va en dos vueltas: la primera pone WSL y pide reiniciar; la segunda hace el
# resto. Se puede relanzar las veces que haga falta: lo de WSL/Docker/Caddy no
# se toca si ya estaba, pero el código del proyecto se copia de cero cada vez.
#
# Lo que monta:
#   internet -> Windows (80/443) -> Caddy -> 127.0.0.1:3000 -> WSL2 -> Docker -> la web

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
EnLinux "printf '[boot]\nsystemd=true\n' > /etc/wsl.conf"
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
EnLinux "rm -rf '$CarpetaLinux' && mkdir -p '$CarpetaLinux' && cp -r '$rutaEnLinux/.' '$CarpetaLinux/' && chmod +x '$CarpetaLinux/deploy/'*.sh"
if ($LASTEXITCODE -ne 0) { Fallar "No se ha podido copiar el proyecto." }
Bien "copiado"

# ---- 5. Levantar la web ----

Decir "Construyendo y levantando la web (la primera vez tarda varios minutos)"
EnLinux "cd '$CarpetaLinux' && ./deploy/instalar.sh"
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

Copy-Item "$PSScriptRoot\Caddyfile" "$CarpetaCaddy\Caddyfile" -Force

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

Decir "Arranque automático tras reiniciar"
if ($SinArranqueAutomatico) {
	Ojo "saltado. Sin esto, un reinicio deja la web caída"
} else {
	# Un servicio y no una tarea programada: WSL no solo deja de arrancar cuando
	# nadie inicia sesión, es que además se apaga sola tras un rato sin uso. El
	# servicio la mantiene viva y la relanza si se cae.
	& "$PSScriptRoot\autoarranque.ps1" -Distro $Distro -CarpetaLinux $CarpetaLinux -CarpetaCaddy $CarpetaCaddy
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
Write-Host ""
Write-Host "  La prueba de verdad: reinicia el servidor y entra" -ForegroundColor Gray
Write-Host "  sin iniciar sesión. Si carga, aguanta." -ForegroundColor Gray
Write-Host " ---------------------------------------------" -ForegroundColor White
Write-Host ""
