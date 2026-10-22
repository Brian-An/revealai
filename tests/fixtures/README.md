# C2PA reader fixtures

Retrieved October 22, 2026 from [contentauth/c2pa-rs test fixtures](https://github.com/contentauth/c2pa-rs/tree/main/sdk/tests/fixtures).
The upstream project is dual licensed under Apache-2.0 and MIT.
These images exercise real binary parsing and signature validation, not a detector accuracy benchmark.

| Local name | Upstream name | SHA-256 |
| --- | --- | --- |
| `signed-test.jpg` | `C.jpg` | `a2d14755db55de67a47c04090340d8266e892367be4104a45626d7a6fa6e9ffd` |
| `history-test.jpg` | `CA.jpg` | `e71bff58fc57640803e6e65f7534e2fb0c2f99018c85276cc14b30f04427cc76` |
| `signed-test.webp` | `sample1.webp` | `006ee0871284b06a311286b9b72b3d083951ea6e9c78aa14d7894742daebfad3` |

The test suite derives tampered assets from fixtures and checks the actual reader result.

`ai-declared.png` is a generated 80px PNG signed with the upstream public Ed25519 test certificate using the official c2patool v0.28.2 binary.
Its active `c2pa.actions.v2` assertion declares `c2pa.created` with IPTC `trainedAlgorithmicMedia`.
`test-only-signing-chain.pem` comes from the upstream `certs/ed25519.pub` fixture.
The test signer expires August 26, 2030.
The certificate chain is trusted only in the isolated reader test; it is absent from the extension's production roots.
The public test signing private key is not retained in this repository.

`ai-edited.png` is an 80px PNG signed using the official c2patool v0.28.2 sample PS256 certificate.
It declares camera capture followed by an AI editing action and includes a 606-character source name for layout verification.
`test-only-edit-chain.pem` comes from that release's `sample/ps256.pub`.
The test build substitutes these test roots only in its isolated output under `test-results`; production files and `dist` are unchanged.

| Generated fixture | SHA-256 |
| --- | --- |
| `ai-declared.png` | `b74d98d9db3faafea9e1ed856802dd19e0267c30a2c3c3dd58585434354bfdd5` |
| `ai-edited.png` | `06c6062b765c8c798f3b1aca72428376312c339174ce994128351a9f4b87475e` |
