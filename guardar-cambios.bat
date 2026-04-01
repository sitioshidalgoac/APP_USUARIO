@echo off
setlocal enabledelayedexpansion

cd /d "C:\Users\LapHP\Desktop\Proyecto"

REM Eliminar lock si existe
if exist ".git\index.lock" del ".git\index.lock"

REM Configurar git
git config user.email "usuario@sitios-hidalgo.com"
git config user.name "Usuario Proyecto"

REM Commit 1: Cambios de conductor
echo ==============================
echo COMMIT 1: Conductor
echo ==============================
git add conductor/ -f
git commit -m "Actualización Integral Conductor"
if errorlevel 1 (
    echo Sin cambios nuevos en conductor (ya está sincronizado)
)

REM Commit 2: CODIGO_CORREGIDO.js
echo ==============================
echo COMMIT 2: CODIGO_CORREGIDO.js
echo ==============================
git add CODIGO_CORREGIDO.js
git commit -m "Sincronización de funciones"
if errorlevel 1 (
    echo Sin cambios nuevos en CODIGO_CORREGIDO.js
)

REM Agregar archivos generales
echo ==============================
echo Agregando archivos generales
echo ==============================
git add .gitignore package.json firebase.json database.rules.json *.md -f
git commit -m "Documentación y configuración del proyecto" --allow-empty
if errorlevel 1 (
    echo No hay más cambios para agregar
)

REM Ver log
echo ==============================
echo HISTORIAL DE COMMITS
echo ==============================
git log --oneline

echo.
echo ==============================
echo Estado final del repositorio
echo ==============================
git status

echo.
echo NOTA: Para hacer push, necesitas tener un remote configurado:
echo git remote add origin [URL]
echo git push -u origin master
