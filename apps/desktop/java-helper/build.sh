#!/usr/bin/env bash
# Builds the ICP crypto helper into a runnable jar using only the JDK — no
# Gradle/Maven, no third-party dependencies. The shipped desktop bundle runs
# this jar under a jlink'd JRE; Fase 1 runs it standalone for tests.
#
#   ./build.sh           -> build/icp-helper.jar
#   java -jar build/icp-helper.jar   (then feed NDJSON on stdin)
set -euo pipefail
cd "$(dirname "$0")"

SRC_DIR="src/main/java"
OUT_DIR="build/classes"
JAR="build/icp-helper.jar"

rm -rf build
mkdir -p "$OUT_DIR"

find "$SRC_DIR" -name '*.java' > build/sources.txt
javac -d "$OUT_DIR" @build/sources.txt

jar --create --file "$JAR" --main-class com.documenso.icp.Main -C "$OUT_DIR" .
echo "Built $JAR"
