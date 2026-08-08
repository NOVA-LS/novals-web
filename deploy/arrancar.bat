@echo off
chcp 65001 >nul
setlocal

rem  Arranca la web en un Windows con Docker Desktop.
rem
rem  Es para levantarla en tu propio equipo. El servidor de verdad es Linux y ahí
rem  se usa deploy/instalar.sh, que además pone Caddy y el certificado.
rem
rem  Doble clic y ya. Se puede volver a lanzar las veces que haga falta.

cd /d "%~dp0.."

echo.
echo  -- NOVA - Los Santos ----------------------
echo.

rem ---- Docker ----
where docker >nul 2>&1
if errorlevel 1 (
	echo  [X] No hay Docker en este equipo.
	echo.
	echo      Instala Docker Desktop desde:
	echo      https://www.docker.com/products/docker-desktop/
	echo.
	echo      Cuando termine, vuelve a lanzar esto.
	echo.
	pause
	exit /b 1
)

rem Docker Desktop tarda en levantar del todo aunque la orden ya exista.
echo  - Esperando a Docker...
set INTENTO=0
:esperar_docker
docker info >nul 2>&1
if not errorlevel 1 goto docker_listo
set /a INTENTO+=1
if %INTENTO% GEQ 30 (
	echo.
	echo  [X] Docker no acaba de arrancar.
	echo      Abre Docker Desktop a mano y espera a que ponga "Engine running".
	echo.
	pause
	exit /b 1
)
timeout /t 2 /nobreak >nul
goto esperar_docker

:docker_listo
echo    listo

rem ---- Variables ----
if not exist ".env" (
	if exist ".env.produccion" (
		echo  - No hay .env: copiando el de produccion
		copy /y ".env.produccion" ".env" >nul
	) else (
		echo.
		echo  [X] Falta el fichero .env y no hay .env.produccion del que copiarlo.
		echo      Sin el, la web no sabe ni con que Discord hablar.
		echo.
		pause
		exit /b 1
	)
)

rem ---- Arrancar ----
echo  - Construyendo y levantando ^(la primera vez tarda unos minutos^)
echo.
docker compose up -d --build
if errorlevel 1 (
	echo.
	echo  [X] Algo ha fallado al levantarla. El detalle esta arriba.
	echo.
	pause
	exit /b 1
)

echo.
echo  - Esperando a que responda
set INTENTO=0
:esperar_web
curl -fsS -o nul -m 5 http://127.0.0.1:3000/ >nul 2>&1
if not errorlevel 1 goto web_lista
set /a INTENTO+=1
if %INTENTO% GEQ 30 (
	echo.
	echo  [X] No responde. Ultimas lineas del registro:
	echo.
	docker compose logs --tail 40 web
	echo.
	pause
	exit /b 1
)
timeout /t 4 /nobreak >nul
goto esperar_web

:web_lista
echo    en marcha
echo.
echo  -------------------------------------------
echo   Abierta en http://localhost:3000
echo.
echo   Parar:     deploy\parar.bat
echo   Registro:  docker compose logs -f web
echo  -------------------------------------------
echo.

start "" http://localhost:3000

rem Sigue viva en segundo plano: cerrar esta ventana no la tumba.
timeout /t 5 /nobreak >nul
endlocal
