@echo off
chcp 65001 >nul
setlocal

rem  Arranca la web en el Windows Server, donde Docker vive dentro de WSL.
rem
rem  Normalmente no hace falta: el contenedor se levanta solo al arrancar la
rem  distro. Esto es para cuando quieras forzarlo sin abrir una consola de WSL.
rem
rem  Si cambiaste el nombre de la distro o la carpeta, corrígelos aquí.

set DISTRO=Ubuntu-24.04
set CARPETA=/opt/novals

echo.
echo  - Levantando la web dentro de %DISTRO%
wsl -d %DISTRO% -u root -e sh -c "cd %CARPETA% && docker compose up -d"
if errorlevel 1 (
	echo.
	echo  [X] No se ha podido. Comprueba que la distro existe:  wsl -l -v
	echo.
	pause
	exit /b 1
)

echo.
echo  - Esperando a que responda
set INTENTO=0
:esperar
curl.exe -fsS -o nul -m 5 http://127.0.0.1:3000/ >nul 2>&1
if not errorlevel 1 goto lista
set /a INTENTO+=1
if %INTENTO% GEQ 30 (
	echo.
	echo  [X] No responde. Ultimas lineas del registro:
	wsl -d %DISTRO% -u root -e sh -c "cd %CARPETA% && docker compose logs --tail 40 web"
	echo.
	pause
	exit /b 1
)
timeout /t 4 /nobreak >nul
goto esperar

:lista
echo    en marcha, escuchando en el 3000
echo.
echo   Delante esta Caddy, que es quien atiende https://novals.es
echo   Registro:  wsl -d %DISTRO% -u root -e sh -c "cd %CARPETA% ^&^& docker compose logs -f web"
echo.
pause
endlocal
