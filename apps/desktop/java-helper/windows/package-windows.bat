@echo off
REM Build a self-contained Windows executable (bundles a trimmed JRE) so the
REM signer's machine needs no separate Java install. RUN THIS ON WINDOWS with a
REM JDK 17+ on PATH (jpackage/jlink are platform-specific — a Windows binary
REM must be produced on Windows).
REM
REM Output: dist\IcpAgent\IcpAgent.exe  (app-image; launches the jar)
REM
REM Prereqs: JDK 17+ (includes jpackage + jlink). WiX Toolset only needed for
REM the optional --type msi installer.

setlocal
set HERE=%~dp0
set ROOT=%HERE%..

REM 1) Build the jar (no Gradle/deps).
call "%ROOT%\build.bat"
if errorlevel 1 (echo build failed & exit /b 1)

REM 2) Trimmed runtime with just the modules the agent uses.
set MODULES=java.base,java.naming,java.net.http,java.desktop,jdk.crypto.cryptoki,jdk.crypto.mscapi
if exist "%ROOT%\build\runtime" rmdir /s /q "%ROOT%\build\runtime"
jlink --add-modules %MODULES% --strip-debug --no-header-files --no-man-pages --compress=2 --output "%ROOT%\build\runtime"
if errorlevel 1 (echo jlink failed & exit /b 1)

REM 3) Package an app-image .exe around the jar + runtime.
if exist "%ROOT%\dist" rmdir /s /q "%ROOT%\dist"
jpackage ^
  --type app-image ^
  --name IcpAgent ^
  --input "%ROOT%\build" ^
  --main-jar icp-helper.jar ^
  --main-class com.documenso.icp.Main ^
  --runtime-image "%ROOT%\build\runtime" ^
  --dest "%ROOT%\dist"
if errorlevel 1 (echo jpackage failed & exit /b 1)

echo.
echo Built: %ROOT%\dist\IcpAgent\IcpAgent.exe
echo Test:  "%ROOT%\dist\IcpAgent\IcpAgent.exe" list --source windows-my
endlocal
