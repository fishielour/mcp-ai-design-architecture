@echo off
setlocal

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo Starting MCP Elite Design Architect Hub...
echo.
echo Opening canvas server terminal...
start "MCP Canvas Server" cmd /k "cd /d ""%ROOT%"" && node src\server.js"

echo Opening frontend canvas terminal...
start "MCP Frontend Canvas" cmd /k "cd /d ""%ROOT%"" && npm.cmd run dev --workspace mcp-canvas-app"

call :wait_for "Canvas server" "http://127.0.0.1:3210/health" 90
if errorlevel 1 goto :startup_warning

call :wait_for "Frontend canvas" "http://127.0.0.1:5173/" 90
if errorlevel 1 goto :startup_warning

echo.
echo Both services are ready. Opening the canvas in your browser...
start "" "http://localhost:5173"
exit /b 0

:wait_for
set "NAME=%~1"
set "URL=%~2"
set "ATTEMPTS=%~3"

echo Waiting for %NAME%...
for /L %%I in (1,1,%ATTEMPTS%) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { $response = Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 (
    echo %NAME% is ready.
    exit /b 0
  )
  timeout /t 1 /nobreak >nul
)

echo Timed out waiting for %NAME%.
exit /b 1

:startup_warning
echo.
echo One or more services did not report ready in time.
echo The terminals were still opened, so check them for any errors.
exit /b 1
