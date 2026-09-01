@echo off
setlocal
title Installation SVG Network Collector
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable. Installe Node.js 18 ou plus recent depuis nodejs.org.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm est introuvable. Reinstalle Node.js avec npm.
  pause
  exit /b 1
)

call npm install --omit=dev
if errorlevel 1 (
  echo L'installation a echoue.
  pause
  exit /b 1
)

echo Installation terminee. Edge sera utilise automatiquement.
pause
