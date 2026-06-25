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

# Target Java 17 (LTS) bytecode so the jar runs on a JRE 17+ even when built
# with a newer JDK. Building with JDK 21 but emitting class file v65 (Java 21)
# breaks `java -jar` on Java 17 with UnsupportedClassVersionError.
JAVA_RELEASE="${JAVA_RELEASE:-17}"

find "$SRC_DIR" -name '*.java' > build/sources.txt
javac --release "$JAVA_RELEASE" -d "$OUT_DIR" @build/sources.txt

jar --create --file "$JAR" --main-class com.documenso.icp.Main -C "$OUT_DIR" .
echo "Built $JAR"
