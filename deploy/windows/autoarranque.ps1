# Deja la web arrancando sola con el servidor, y levantandola otra vez si se cae.
#
#   .\deploy\windows\autoarranque.ps1
#
# El problema que resuelve: WSL no arranca si nadie inicia sesion, y ademas se
# apaga sola cuando lleva un rato sin que nadie la use. Una tarea programada solo
# cubre lo primero. Esto monta un servicio de Windows que mantiene la distro viva
# y la relanza si se muere.
#
# Se puede relanzar las veces que haga falta: si el servicio ya existe, se
# reconfigura en vez de fallar.

[CmdletBinding()]
param(
	[string]$Distro = "Ubuntu-24.04",
	[string]$CarpetaLinux = "/opt/novals",
	[string]$CarpetaCaddy = "C:\caddy",
	[string]$Servicio = "NovaWSL"
)

# Los programas de fuera escriben su registro por la salida de errores aunque
# vaya todo bien: con "Stop" PowerShell lo tomaria por un fallo mortal.
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Decir($texto) { Write-Host "`n- $texto" -ForegroundColor Cyan }
function Bien($texto) { Write-Host "  $texto" -ForegroundColor Green }
function Ojo($texto) { Write-Host "  $texto" -ForegroundColor Yellow }
function Fallar($texto) { Write-Host "`nX $texto`n" -ForegroundColor Red; exit 1 }

# ---- Comprobaciones ----

$identidad = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identidad)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
	Fallar "Hay que abrir PowerShell como Administrador."
}

Write-Host ""
Write-Host " -- NOVA - arranque automatico ---------------" -ForegroundColor White

Decir "Comprobando que la distro existe"
$env:WSL_UTF8 = 1
$distros = (wsl -l -q) -split "`r?`n" | Where-Object { $_.Trim() -ne "" }
if ($distros -notcontains $Distro) {
	Fallar "No encuentro $Distro. Mira como se llama con: wsl -l -v"
}
Bien "$Distro"

# ---- NSSM ----

Decir "Buscando NSSM"
$nssm = Get-ChildItem -Path $CarpetaCaddy -Filter nssm.exe -Recurse -ErrorAction SilentlyContinue |
	Where-Object { $_.FullName -match "win64" } | Select-Object -First 1

if (-not $nssm) {
	Ojo "no esta: descargando"
	New-Item -ItemType Directory -Force -Path $CarpetaCaddy | Out-Null
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
Bien $nssm.FullName

# ---- El guion que mantiene la distro viva ----

Decir "Escribiendo el guion de arranque"
New-Item -ItemType Directory -Force -Path "$CarpetaCaddy\logs" | Out-Null

# "sleep infinity" es lo que impide que WSL se apague: mientras haya un proceso
# dentro, la distro sigue en pie. Va en un .cmd y no como argumentos sueltos para
# no pelearse con el escapado de comillas entre PowerShell, NSSM y sh.
$guion = "$CarpetaCaddy\nova-wsl.cmd"
$contenido = @"
@echo off
wsl.exe -d $Distro -u root -e sh -c "cd $CarpetaLinux && docker compose up -d && sleep infinity"
"@
Set-Content -Path $guion -Value $contenido -Encoding ASCII
Bien $guion

# ---- El servicio ----

Decir "Registrando el servicio $Servicio"
$yaExistia = [bool](Get-Service -Name $Servicio -ErrorAction SilentlyContinue)
if ($yaExistia) {
	Ojo "ya existia: parandolo para reconfigurarlo"
	Stop-Service $Servicio -Force -ErrorAction SilentlyContinue
	Start-Sleep -Seconds 2
} else {
	& $nssm.FullName install $Servicio $guion | Out-Null
	if ($LASTEXITCODE -ne 0) { Fallar "NSSM no ha podido crear el servicio." }
}

& $nssm.FullName set $Servicio Application $guion | Out-Null
& $nssm.FullName set $Servicio DisplayName "NOVA - WSL y la web" | Out-Null
& $nssm.FullName set $Servicio Description "Mantiene WSL en pie y la web levantada" | Out-Null
& $nssm.FullName set $Servicio Start SERVICE_AUTO_START | Out-Null
& $nssm.FullName set $Servicio AppStdout "$CarpetaCaddy\logs\wsl.log" | Out-Null
& $nssm.FullName set $Servicio AppStderr "$CarpetaCaddy\logs\wsl.log" | Out-Null
& $nssm.FullName set $Servicio AppRotateFiles 1 | Out-Null
& $nssm.FullName set $Servicio AppRotateBytes 10485760 | Out-Null
Bien "configurado"

# ---- Con que usuario corre ----

Decir "Usuario del servicio"
if ($yaExistia) {
	# Ya venia configurado de una vez anterior. Se puede dejar como esta: pedir la
	# contrasena a la fuerza y abortar si no la dan dejaria el servicio parado,
	# que es justo la web caida.
	Ojo "ya estaba puesto. Intro para dejarlo como esta, o escribela para cambiarlo"
} else {
	Write-Host ""
	Ojo "Las distros de WSL pertenecen al usuario que las instalo, asi que el"
	Ojo "servicio tiene que correr como $($identidad.Name) y no como SYSTEM."
	Ojo "Windows pide la contrasena para poder arrancarlo sin sesion abierta."
	Write-Host ""
}

$clave = Read-Host "  Contrasena de $($identidad.Name)" -AsSecureString
$plana = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
	[Runtime.InteropServices.Marshal]::SecureStringToBSTR($clave))

if ([string]::IsNullOrWhiteSpace($plana)) {
	if (-not $yaExistia) {
		Fallar "Sin contrasena el servicio no puede arrancar solo. Vuelve a lanzarlo."
	}
	Bien "se queda el que ya tenia"
} else {
	& $nssm.FullName set $Servicio ObjectName $identidad.Name $plana | Out-Null
	if ($LASTEXITCODE -ne 0) { Fallar "NSSM no ha aceptado ese usuario o esa contrasena." }
	Bien "puesto"
}

# ---- Arrancar y comprobar ----

Decir "Arrancando"
Start-Service $Servicio -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5

$estado = (Get-Service -Name $Servicio).Status
if ($estado -ne "Running") {
	Write-Host ""
	Ojo "El servicio no ha arrancado. Casi siempre es la contrasena."
	Ojo "Mira el detalle en: $CarpetaCaddy\logs\wsl.log"
	Fallar "Servicio en estado $estado."
}
Bien "en marcha"

Decir "Esperando a que la web responda (Docker tarda un poco en arrancar dentro)"
$responde = $false
foreach ($intento in 1..30) {
	try {
		Invoke-WebRequest -Uri "http://127.0.0.1:3000/" -UseBasicParsing -TimeoutSec 5 | Out-Null
		$responde = $true
		break
	} catch { Start-Sleep -Seconds 4 }
}
if (-not $responde) {
	Ojo "No responde todavia. Mira: $CarpetaCaddy\logs\wsl.log"
	Fallar "La web no ha levantado."
}
Bien "responde en 127.0.0.1:3000"

# ---- La tarea programada ya sobra ----

if (Get-ScheduledTask -TaskName "NOVA arrancar WSL" -ErrorAction SilentlyContinue) {
	Decir "Quitando la tarea programada"
	# El servicio hace lo mismo y ademas relanza WSL si se cae.
	Unregister-ScheduledTask -TaskName "NOVA arrancar WSL" -Confirm:$false -ErrorAction SilentlyContinue
	Bien "quitada"
}

# ---- Final ----

Write-Host ""
Write-Host " ---------------------------------------------" -ForegroundColor White
Write-Host "  Listo. Servicios en marcha:" -ForegroundColor White
Get-Service $Servicio, Caddy -ErrorAction SilentlyContinue |
	Format-Table Status, Name, DisplayName -AutoSize | Out-String | Write-Host

Write-Host "  La prueba de verdad: reinicia y entra en la web" -ForegroundColor Gray
Write-Host "  SIN abrir sesion por escritorio remoto." -ForegroundColor Gray
Write-Host ""
Write-Host "    Restart-Computer" -ForegroundColor Gray
Write-Host ""
Write-Host "  Registro de WSL:    Get-Content $CarpetaCaddy\logs\wsl.log -Tail 30" -ForegroundColor Gray
Write-Host "  Registro de Caddy:  Get-Content $CarpetaCaddy\logs\servicio.log -Tail 30" -ForegroundColor Gray
Write-Host " ---------------------------------------------" -ForegroundColor White
Write-Host ""
