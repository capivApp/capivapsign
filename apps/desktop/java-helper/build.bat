@echo off
REM Windows build of the ICP agent jar using only the JDK (no Gradle/deps).
REM Mirrors build.sh. Output: build\icp-helper.jar
setlocal
cd /d "%~dp0"

if exist build rmdir /s /q build
mkdir build\classes

dir /s /b src\main\java\*.java > build\sources.txt
rem Target Java 17 (LTS) bytecode so the jar runs on a JRE 17+ even when built
rem with a newer JDK (avoids UnsupportedClassVersionError on Java 17).
javac --release 17 -d build\classes @build\sources.txt
if errorlevel 1 (echo javac failed & exit /b 1)

jar --create --file build\icp-helper.jar --main-class com.documenso.icp.Main -C build\classes .
if errorlevel 1 (echo jar failed & exit /b 1)

echo Built build\icp-helper.jar
endlocal
