@echo off
chcp 65001 >nul

rem  Para la web sin borrar nada: la base de datos y las fotos viven en volúmenes
rem  de Docker y siguen ahí para el próximo arranque.

cd /d "%~dp0.."

echo.
echo  - Parando la web
docker compose down

echo.
echo    parada. Los datos siguen guardados.
echo.
pause
