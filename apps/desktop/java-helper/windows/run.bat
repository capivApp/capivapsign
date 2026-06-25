@echo off
REM Convenience launcher for the ICP agent jar on Windows (requires a JRE on PATH).
REM
REM   run.bat serve   (recommended: waits on http://localhost:3231 for sign requests from the web)
REM   run.bat list  --source windows-my
REM   run.bat sign  --base-url https://app.documenso.com --token <TOKEN> --source windows-my
REM   run.bat sign  --base-url https://app.documenso.com --token <TOKEN> --source p12 --p12 C:\cert.p12
REM   run.bat sign  --base-url https://app.documenso.com --token <TOKEN> --source pkcs11 --module C:\path\to\token.dll
REM
REM Tip: set ICP_ALLOWED_ORIGIN=https://app.documenso.com to refuse other hosts.

setlocal
set HERE=%~dp0
java -jar "%HERE%..\build\icp-helper.jar" %*
endlocal
