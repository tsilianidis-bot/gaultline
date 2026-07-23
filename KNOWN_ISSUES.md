# FAULTLINE Known External-Dependency Issues

| Dependency | Status | Automated-test treatment | Resolution owner |
|---|---|---|---|
| SendGrid transactional-email credential | The injected `SENDGRID_API_KEY` is present and correctly formatted, but SendGrid returns HTTP 401 from the read-only `/v3/user/account` validation endpoint. The user explicitly waived remediation on 2026-07-23. | The local presence-and-format assertion remains active. The live credential acceptance assertion is explicitly skipped because it depends on an external credential that cannot be corrected in source code. | Project owner / SendGrid account administrator |

This exception does not authorize masking application email errors. Runtime email delivery continues to return a controlled configuration error when SendGrid rejects the configured credential. Re-enable the live acceptance assertion in `server/sendgrid.key.test.ts` after a valid key is installed.
