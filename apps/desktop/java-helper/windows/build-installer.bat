@echo off
REM Build the Windows .exe INSTALLER for the CapivaSign ICP agent (Inno Setup).
REM
REM Output: dist\installer\CapivaSign-Setup.exe — one self-contained setup that
REM bundles a JRE, registers capivasign-icp://, sets ICP_ALLOWED_ORIGIN, and
REM auto-starts the tray serve agent at every user logon.
REM
REM RUN THIS ON WINDOWS. Prereqs:
REM   - JDK 17+ on PATH (jpackage + jlink; produces a Windows app-image).
REM   - Inno Setup 6 (ISCC.exe on PATH): https://jrsoftware.org/isdl.php
REM
REM Usage:
REM   build-installer.bat                         (origin = https://app.capivapp.com.br)
REM   build-installer.bat https://app.suaempresa.com

setlocal
set HERE=%~dp0
set ROOT=%HERE%..

REM Allowed origin baked into the installer (SSRF guard). Override via arg 1.
set ORIGIN=%~1
if "%ORIGIN%"=="" set ORIGIN=https://app.capivapp.com.br

REM 1) Build the self-contained app-image (dist\CapivaSign\CapivaSign.exe).
call "%HERE%package-windows.bat"
if errorlevel 1 (echo package-windows failed & exit /b 1)

REM 2) Find the Inno Setup compiler.
where ISCC >nul 2>&1
if errorlevel 1 (
  echo.
  echo ISCC.exe not found on PATH. Install Inno Setup 6 and re-run:
  echo   https://jrsoftware.org/isdl.php
  echo Typical path: "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
  exit /b 1
)

REM 3) Compile the installer.
ISCC /DAllowedOrigin=%ORIGIN% "%HERE%installer.iss"
if errorlevel 1 (echo ISCC failed & exit /b 1)

echo.
echo Built: %ROOT%\dist\installer\CapivaSign-Setup.exe
echo Origin baked in: %ORIGIN%
endlocal
