#!/usr/bin/env bash
# Unit tests for the agent, JDK only (no JUnit/Gradle): compiles src/main +
# src/test into build/test-classes and runs each *Test class's main().
#
#   ./test.sh
set -euo pipefail
cd "$(dirname "$0")"

OUT_DIR="build/test-classes"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

find src/main/java src/test/java -name '*.java' > build/test-sources.txt
javac --release "${JAVA_RELEASE:-17}" -d "$OUT_DIR" @build/test-sources.txt

find src/test/java -name '*Test.java' \
  | sed -e 's#^src/test/java/##' -e 's#\.java$##' -e 's#/#.#g' \
  | while read -r testClass; do
      java -cp "$OUT_DIR" "$testClass"
    done
