# Bundled C2PA trust lists

Retrieved October 22, 2026 from the C2PA conformance program's official public repository.
These files are trust data, not executable code.

| File | Source | SHA-256 |
| --- | --- | --- |
| `anchors.pem` | [C2PA Trust List](https://raw.githubusercontent.com/c2pa-org/conformance-public/refs/heads/main/trust-list/C2PA-TRUST-LIST.pem) | `b3949271a07b007e92ef1d18050b55388f5e0d2686a16fd864176c48421af8ae` |
| `tsa.pem` | [C2PA TSA Trust List](https://raw.githubusercontent.com/c2pa-org/conformance-public/refs/heads/main/trust-list/C2PA-TSA-TRUST-LIST.pem) | `7182cb227c02701be0eebd67ab635fca7f85431c32796fb53b267c657cd2c675` |

The reader receives both PEM bundles and checks signature, content binding, and signer trust locally.
Remote manifests and live OCSP lookups are disabled.
An offline result does not establish current certificate revocation status.
The UI discloses this limitation alongside credential evidence.

Before each extension release, download both official PEM files, review changes against the official list and certificate expiry dates, update this retrieval date and the digests, run all tests, and inspect signed fixtures in the loaded extension.
Do not add a self-signed test certificate to the production trust bundle.
Use isolated test configuration to exercise a trusted test signer.
