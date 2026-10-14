@echo off
setlocal
cd /d "%~dp0"
set "PATH=%~dp0.runtime\node\node-v22.14.0-win-x64;%PATH%"

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto :error
)

echo Starting CS_DEMO at http://127.0.0.1:3000
call npx vite --host 127.0.0.1 --port 3000 --strictPort
goto :eof

:error
echo Failed to start CS_DEMO.
exit /b 1
