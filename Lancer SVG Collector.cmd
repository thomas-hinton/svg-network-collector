@echo off
setlocal
title SVG Network Collector
cd /d "%~dp0"
set "BUNDLED_NODE=C:\Users\Dell\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "BUNDLED_MODULES=C:\Users\Dell\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules"

where node >nul 2>nul
if not errorlevel 1 (
  node -e "require.resolve('playwright')" >nul 2>nul
  if not errorlevel 1 set "NODE_BIN=node"
)

if not defined NODE_BIN if exist "%BUNDLED_NODE%" (
  set "NODE_BIN=%BUNDLED_NODE%"
  set "NODE_PATH=%BUNDLED_MODULES%"
)

if not defined NODE_BIN (
  echo Node.js ou Playwright est introuvable.
  echo Lance d'abord « Installer Windows.cmd ».
  pause
  exit /b 1
)
"%NODE_BIN%" "%~dp0app.js"
if errorlevel 1 pause
