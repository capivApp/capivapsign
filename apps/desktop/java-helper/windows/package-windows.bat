@echo off
REM Build a self-contained Windows executable (bundles a trimmed JRE) so the
REM signer's machine needs no separate Java install. RUN THIS ON WINDOWS with a
REM JDK 17+ on PATH (jpackage/jlink are platform-specific — a Windows binary
REM must be produced on Windows).
REM
REM Output:
REM   dist\CapivaSign\CapivaSign.exe       WINDOWED  — the agent users run
REM   dist\CapivaSign\CapivaSignCli.exe    CONSOLE   — list/sign for support
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
set MODULES=java.base,java.naming,java.net.http,java.desktop,jdk.httpserver,jdk.crypto.cryptoki,jdk.crypto.mscapi
if exist "%ROOT%\build\runtime" rmdir /s /q "%ROOT%\build\runtime"
jlink --add-modules %MODULES% --strip-debug --no-header-files --no-man-pages --compress=2 --output "%ROOT%\build\runtime"
if errorlevel 1 (echo jlink failed & exit /b 1)

REM 3) Package an app-image .exe around the jar + runtime.
REM
REM THE MAIN LAUNCHER IS DELIBERATELY WINDOWED (no --win-console).
REM
REM jpackage's --win-console flag builds a CONSOLE-subsystem binary, which makes
REM Windows allocate and show a cmd window for EVERY launch of that exe — at
REM logon, from the Start menu, and on every `capivasign-icp://` deep link the
REM browser fires. That stray console next to the agent was the bug: the fix is
REM for the exe users actually run to be a GUI-subsystem binary.
REM
REM --arguments supplies DEFAULT arguments, used only when the launcher is
REM started with none. So:
REM   double-click / logon / Start menu  -> `serve --no-gui` -> straight to tray
REM   protocol handler                   -> the URI overrides them -> signs
REM
REM Diagnostics are not lost: the agent tees stderr to
REM %LOCALAPPDATA%\CapivaSign\agent.log (see Log.java), reachable from the tray
REM menu. CapivaSignCli.exe keeps a console for interactive support work.
jpackage ^
  --type app-image ^
  --name CapivaSign ^
  --description "CapivaSign - Assinador ICP-Brasil" ^
  --vendor "CapivApp" ^
  --input "%ROOT%\build" ^
  --main-jar icp-helper.jar ^
  --main-class br.com.capivapp.icp.Main ^
  --runtime-image "%ROOT%\build\runtime" ^
  --icon "%HERE%capivasign.ico" ^
  --arguments "serve --no-gui" ^
  --add-launcher CapivaSignCli="%HERE%cli-launcher.properties" ^
  --dest "%ROOT%\dist"
if errorlevel 1 (echo jpackage failed & exit /b 1)

echo.
echo Built: %ROOT%\dist\CapivaSign\CapivaSign.exe       (windowed - tray agent, no console)
echo        %ROOT%\dist\CapivaSign\CapivaSignCli.exe    (console  - CLI: list/sign)
echo Test:  "%ROOT%\dist\CapivaSign\CapivaSignCli.exe" list --source windows-my
endlocal
