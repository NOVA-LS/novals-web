# Poner la web en un Windows Server

Para Windows Server 2022 o 2025.

## La vía corta

`deploy\windows\instalar.ps1` hace del paso 1 al 10 solo. En PowerShell **como
Administrador**, desde la carpeta del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows\instalar.ps1
```

Va en dos vueltas: la primera pone WSL y pide reiniciar; al volver se relanza y
hace el resto. Se puede repetir las veces que haga falta.

Lo único que pide por teclado es la contraseña de Windows, y solo para el paso
10: sin ella no se puede dejar una tarea que arranque sin sesión abierta.

El resto del documento explica esos mismos pasos a mano, que es lo que hay que
mirar cuando algo no salga.

## Cómo encaja

La web es una imagen de Linux, así que en Windows hace falta algo que sepa
correrla. El montaje es este:

```
internet → Windows (80/443) → Caddy → 127.0.0.1:3000 → WSL2 → Docker → la web
```

Caddy va nativo en Windows y Docker dentro de WSL. Se hablan por `127.0.0.1`
porque WSL abre sus puertos en el localhost del propio Windows: así no hay que
averiguar la IP de la distro, que cambia en cada arranque.

## 0 · Comprobar que el VPS deja virtualizar

WSL2 necesita virtualización anidada y no todos los VPS de Windows la dan. En
PowerShell **como Administrador**:

```powershell
systeminfo
```

Mira el final. Si sale «Se detectó un hipervisor», el proveedor lo permite. Si
sale que faltan requisitos de Hyper-V, no sigas: hay que pedírselo al proveedor
o cambiar a un VPS Linux.

## 1 · WSL2 con Ubuntu

```powershell
wsl --install -d Ubuntu-24.04
```

Reinicia. Al volver se abre sola una ventana de Ubuntu que pide un usuario y una
contraseña: son de Linux, no tienen que ver con las de Windows.

## 2 · systemd dentro de Ubuntu

Sin esto, ni Docker ni las copias arrancan solos. Dentro de Ubuntu:

```bash
sudo tee /etc/wsl.conf >/dev/null <<'EOF'
[boot]
systemd=true
EOF
```

Luego, en PowerShell:

```powershell
wsl --shutdown
```

Vuelve a abrir Ubuntu y compruébalo:

```bash
systemctl is-system-running     # vale «running» y vale «degraded»
```

## 3 · Docker dentro de Ubuntu

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Cierra la ventana de Ubuntu y ábrela otra vez —el grupo nuevo no vale hasta
entonces— y prueba:

```bash
docker run --rm hello-world
```

## 4 · Subir el proyecto

Copia la carpeta al servidor por escritorio remoto (arrastrando) a `C:\novals`.
Después, dentro de Ubuntu, muévela al disco de Linux:

```bash
sudo mkdir -p /opt/novals
sudo cp -r /mnt/c/novals/. /opt/novals/
sudo chown -R "$USER:$USER" /opt/novals
```

No la dejes en `/mnt/c`: desde ahí Docker va lentísimo y los permisos de los
ficheros no se respetan.

## 5 · Arrancar la web

```bash
cd /opt/novals
sudo ./deploy/instalar.sh
```

El proxy va en Windows, no dentro de la distro: el guion no lo toca. Pone el
`.env`, construye la imagen, aplica las migraciones, espera a que responda y
deja programada la copia diaria.

Comprueba desde **PowerShell**, no desde Ubuntu:

```powershell
curl.exe -I http://127.0.0.1:3000/
```

Si responde, el puente entre Windows y WSL funciona, que es la pieza que suele
fallar.

## 6 · Liberar el puerto 80

Windows Server suele traer IIS escuchando ahí:

```powershell
Get-NetTCPConnection -LocalPort 80 -State Listen
Stop-Service W3SVC
Set-Service W3SVC -StartupType Disabled
```

## 7 · Caddy en Windows

```powershell
New-Item -ItemType Directory -Force C:\caddy\logs | Out-Null
Invoke-WebRequest "https://caddyserver.com/api/download?os=windows&arch=amd64" -OutFile C:\caddy\caddy.exe
Copy-Item C:\novals\deploy\windows\Caddyfile C:\caddy\Caddyfile
C:\caddy\caddy.exe validate --config C:\caddy\Caddyfile
```

Pruébalo en primer plano antes de dejarlo de servicio:

```powershell
C:\caddy\caddy.exe run --config C:\caddy\Caddyfile
```

Entra desde tu casa a `https://novals.es`. Si va, corta con `Ctrl+C` y sigue.

## 8 · Caddy como servicio

Caddy no se registra solo como servicio de Windows: hace falta NSSM.

```powershell
Invoke-WebRequest https://nssm.cc/release/nssm-2.24.zip -OutFile C:\caddy\nssm.zip
Expand-Archive C:\caddy\nssm.zip -DestinationPath C:\caddy
C:\caddy\nssm-2.24\win64\nssm.exe install Caddy "C:\caddy\caddy.exe" "run --config C:\caddy\Caddyfile"
Start-Service Caddy
Get-Service Caddy
```

## 9 · Abrir el cortafuegos

```powershell
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

Si el proveedor del VPS tiene además su propio cortafuegos en el panel, ábrelos
también ahí.

## 10 · Que arranque sola al reiniciar

Esta es la parte más delicada del montaje: **WSL no arranca solo si nadie inicia
sesión**. Sin esto, un reinicio del servidor deja la web caída aunque Caddy siga
en pie. Hay que crear una tarea programada.

Por interfaz, que es donde menos se falla:

1. Abre el **Programador de tareas** → Crear tarea (no «tarea básica»).
2. Pestaña **General**:
   - Nombre: `NOVA · arrancar WSL`.
   - Marca **Ejecutar tanto si el usuario inició sesión como si no**.
   - Marca **Ejecutar con los privilegios más altos**.
   - El usuario tiene que ser **el mismo que instaló WSL**. Al guardar pedirá su
     contraseña; si esa cuenta no la tiene, no funcionará.
3. Pestaña **Desencadenadores** → Nuevo → **Al iniciar el sistema**.
4. Pestaña **Acciones** → Nuevo → Iniciar un programa:
   - Programa: `C:\Windows\System32\wsl.exe`
   - Argumentos: `-d Ubuntu-24.04 -u root -e /bin/true`
5. Pestaña **Condiciones**: desmarca lo de la corriente alterna, si sale.

Arranca la distro; systemd levanta Docker dentro, y el contenedor sube solo
porque el `docker-compose.yml` lo tiene puesto (`restart: unless-stopped`).

## 11 · DNS y Discord

Igual que en Linux, y sin esto el certificado no sale:

```
A     novals.es      → <IP del servidor>
A     www.novals.es  → <IP del servidor>
```

Y en el portal de Discord → OAuth2 → Redirects:

```
https://novals.es/api/auth/callback/discord
```

## 12 · La prueba de verdad

Reinicia el servidor entero y, sin tocar nada ni iniciar sesión, entra en
`https://novals.es`. Si carga, el montaje aguanta. Si no, el fallo casi siempre
está en la tarea del paso 10.

## Día a día

Desde PowerShell:

```powershell
wsl -d Ubuntu-24.04 -u root -e sh -c "cd /opt/novals && docker compose logs -f web"
wsl -d Ubuntu-24.04 -u root -e sh -c "cd /opt/novals && docker compose restart web"
wsl -d Ubuntu-24.04 -u root -e sh -c "cd /opt/novals && docker compose up -d --build"
Restart-Service Caddy
```

`deploy\windows\arrancar.bat` hace lo primero de la lista con un doble clic.

Para subir una versión nueva: copia los ficheros a `C:\novals`, repite el `cp` del
paso 4 y lanza el `up -d --build`. Las migraciones se aplican solas.

## Si algo falla

**«No se puede habilitar la plataforma de máquina virtual».** El VPS no permite
virtualización anidada. No hay arreglo desde dentro: o lo habilita el proveedor,
o toca un VPS Linux.

**Caddy arranca pero no da certificado.** El puerto 80 está ocupado (paso 6),
cerrado en el cortafuegos (paso 9), o el DNS todavía no apunta aquí.

**Caddy responde 502.** La web no está levantada dentro de WSL, o WSL no está
arrancado. Compruébalo con `wsl -l -v`: tiene que decir «Running».

**Tras reiniciar, la web no vuelve.** La tarea del paso 10. Mírala en el
Programador de tareas: la columna «Resultado de la última ejecución» dice si
llegó a lanzarse.

**Los avisos llegan tarde.** El `flush_interval -1` del Caddyfile es lo que evita
que el canal de eventos se quede almacenado en el proxy.
