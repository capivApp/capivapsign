@echo off
REM Convenience launcher for the ICP agent jar on Windows (requires a JRE on PATH).
REM
REM   run.bat serve            (tray agent on http://localhost:3231; NO console window)
REM   run.bat serve --no-gui   (same, system-tray only — what the installer auto-starts at logon)
REM   run.bat list  --source windows-my
REM   run.bat sign  --base-url https://app.documenso.com --token <TOKEN> --source windows-my
REM   run.bat sign  --base-url https://app.documenso.com --token <TOKEN> --source p12 --p12 C:\cert.p12
REM   run.bat sign  --base-url https://app.documenso.com --token <TOKEN> --source pkcs11 --module C:\path\to\token.dll
REM
REM Tip: set ICP_ALLOWED_ORIGIN=https://app.documenso.com to refuse other hosts.

setlocal
set HERE=%~dp0
set JAR=%HERE%..\build\icp-helper.jar

REM `serve` is a long-lived tray agent: launch it with javaw.exe (the windowless
REM JVM) via `start` so it detaches from this console. Otherwise the agent is a
REM child of cmd.exe and dies the moment the window is closed — and a console
REM lingers the whole time. `list`/`sign` are short CLI commands that must print
REM their result, so those keep java.exe + the console.
if /i "%~1"=="serve" (
  start "Documenso ICP Agent" javaw -jar "%JAR%" %*
) else (
  java -jar "%JAR%" %*
)
endlocal
