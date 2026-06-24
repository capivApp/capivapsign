#!/usr/bin/env bash
# Generates the throwaway test material the Fase 0 spike consumes:
#   - two A1 identities (RSA-2048 self-signed certs mimicking ICP-Brasil
#     subjects "CN=<NAME>:<CPF>"), each as PEM key + DER cert + .p12
#   - input.pdf: a PDF that already carries a /ID (REQUIRED — see README)
#
# Nothing here is secret; the certs are self-signed test material. Re-run
# freely. Outputs are git-ignored.
set -euo pipefail
cd "$(dirname "$0")"

gen() { # $1=index  $2="NAME:CPF"
  openssl req -x509 -newkey rsa:2048 -keyout "key$1.pem" -out "cert$1.pem" -days 730 -nodes \
    -subj "/C=BR/O=ICP-Brasil Test/OU=AC Teste/CN=$2" >/dev/null 2>&1
  openssl x509 -in "cert$1.pem" -outform DER -out "cert$1.der" >/dev/null 2>&1
  openssl pkcs12 -export -inkey "key$1.pem" -in "cert$1.pem" -out "cert$1.p12" \
    -passout pass:test -name "signer$1" >/dev/null 2>&1
  echo "  signer$1: $2"
}

echo "Generating test A1 identities:"
gen 1 "ALICE SILVA:11144477735"
gen 2 "BRUNO COSTA:52998224725"

# CRITICAL: the input PDF must already have a trailer /ID. libpdf's sign()
# generates a random /ID when the source lacks one, which makes the signedAttrs
# digest non-deterministic and breaks the two-pass capture/embed contract. Real
# Documenso PDFs (and the persisted renderedBytes from materialize-anchors)
# always carry an /ID, so production is unaffected; the spike just mirrors that
# precondition. assets/a4-size.pdf has one; assets/example.pdf does NOT.
cp ../../../../../../assets/a4-size.pdf input.pdf
echo "input.pdf: $(stat -c%s input.pdf) bytes (has /ID: $(grep -qa '/ID' input.pdf && echo yes || echo NO))"
echo "Done. Run: node spike.mjs"
