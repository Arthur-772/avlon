@echo off
setlocal
cd /d "%~dp0"
set "PATH=%~dp0.runtime\node\node-v22.14.0-win-x64;%PATH%"

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto :error
)

call npm run build
goto :eof

:error
echo Failed to build CS_DEMO.
exit /b 1
