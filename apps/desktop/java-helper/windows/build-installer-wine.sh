#!/usr/bin/env bash
# Build the Windows installer (dist/installer/CapivaSign-Setup.exe) from Linux,
# running the WINDOWS jlink/jpackage and Inno Setup's ISCC under Wine. Same
# output as windows\build-installer.bat on a Windows box.
#
# Prereqs (none are downloaded by this script):
#   - wine
#   - a Windows x64 JDK 17+ unpacked somewhere      WIN_JDK=/path/to/jdk
#   - Inno Setup 6 installed in a Wine prefix       WINEPREFIX=... ISCC='C:\InnoSetup6\ISCC.exe'
#     e.g. WINEPREFIX=~/.wine-inno wine innosetup-6.x.exe /VERYSILENT /CURRENTUSER '/DIR=C:\InnoSetup6'
#
# Usage:
#   WIN_JDK=~/jdk-win WINEPREFIX=~/.wine-inno windows/build-installer-wine.sh ["https://*.capivapp.com.br"]
set -euo pipefail
cd "$(dirname "$0")/.."

: "${WIN_JDK:?set WIN_JDK to an unpacked Windows JDK 17+}"
ISCC="${ISCC:-C:\\InnoSetup6\\ISCC.exe}"
ORIGIN="${1:-https://*.capivapp.com.br}"
MODULES="java.base,java.naming,java.net.http,java.desktop,jdk.httpserver,jdk.crypto.cryptoki,jdk.crypto.mscapi"
export WINEDEBUG="${WINEDEBUG:--all}"

# 1) Jar (Java 17 bytecode, built with the local Linux JDK).
./build.sh

# jpackage refuses Wine's Z: drive as "not writable", so it works inside the
# prefix's C: drive and the result is copied back.
STAGE_UNIX="$(winepath -u 'C:\capivasign-build')"
rm -rf "$STAGE_UNIX" dist/CapivaSign dist/installer
mkdir -p "$STAGE_UNIX/input" dist
cp build/icp-helper.jar "$STAGE_UNIX/input/"
cp windows/capivasign.ico windows/cli-launcher.properties "$STAGE_UNIX/"

# 2) Trimmed Windows runtime + app-image (both launchers).
wine "$WIN_JDK/bin/jlink.exe" --add-modules "$MODULES" --strip-debug --no-header-files \
  --no-man-pages --compress=2 --output 'C:\capivasign-build\runtime'
wine "$WIN_JDK/bin/jpackage.exe" \
  --type app-image \
  --name CapivaSign \
  --description "CapivaSign - Assinador ICP-Brasil" \
  --vendor "CapivApp" \
  --input 'C:\capivasign-build\input' \
  --main-jar icp-helper.jar \
  --main-class br.com.capivapp.icp.Main \
  --runtime-image 'C:\capivasign-build\runtime' \
  --icon 'C:\capivasign-build\capivasign.ico' \
  --arguments "serve --no-gui" \
  --add-launcher 'CapivaSignCli=C:\capivasign-build\cli-launcher.properties' \
  --dest 'C:\capivasign-build\dist'
cp -r "$STAGE_UNIX/dist/CapivaSign" dist/
rm -rf "$STAGE_UNIX"

# 3) Installer.
(cd windows && wine "$ISCC" /Q "/DAllowedOrigin=$ORIGIN" installer.iss)

echo "Built: $(pwd)/dist/installer/CapivaSign-Setup.exe (origins: $ORIGIN)"
