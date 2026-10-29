# Existing candidate acceptance and recovery proposal

## Decision record

Use the existing isolated Railway candidate as the sole acceptance target. It is named `candidate-pr97-d5c20cc` in Railway project `3aa1a0a0-ec4e-4846-bff6-901f89c35d75`, environment `654ca664-1ac5-4918-9b99-823cbf8ca91d`, and has public origin `https://gaultline-candidate-pr97-d5c20cc.up.railway.app`.

The independently rechecked public `/api/health` and `/api/build-info` endpoints returned HTTP 200 and identify commit `f3906f5d227fb56f91050deca425b2a6aaa28778`, build time `2026-10-19T20:20:04Z`. This is online identity evidence only. It does not show provider readiness, a database schema, backups, migration privileges, schedule inventory, actual configuration, authenticated access, payment state, or acceptance. The current read-only engineering source base is `faa392288b9e05cbbf4e7e5c502d8b59067120aa`; it is not the deployed candidate. Production identity `f7756c7fad3cac0f96df45723ca5c4e2713146d0` is also separate.

No replacement credential, new staging environment, Railway change, deployment, migration, schedule operation, provider call, payment, or email is authorized by this proposal. Local missing keys are not evidence that the candidate lacks configuration.

## Minimum owner actions for the existing candidate

The designated existing-candidate owner must first confirm, in an owner-held record, the project and environment above, the application service identity, the public origin, and the current deployment record that backs `f3906f5…`. The record must say whether the owner can authorize candidate-only diagnostics and a later candidate-only reconciliation. It must not contain secret values, customer data, signed links, copied `.env` material, or a general Railway token.

The platform owner should provide a redacted, read-only diagnostic packet through the approved private owner channel. It must contain deployment ID/status/time, source revision, the service and MySQL resource identities, the Railway domain, and only **set/unset/reference-topology** facts for configuration. It must state whether Railway injects `RAILWAY_GIT_COMMIT_SHA`; whether `FAULTLINE_ENFORCE_DEPLOY_GUARD` and `FAULTLINE_APPROVED_SHA` are set; whether the app references the candidate MySQL service privately; the candidate schedule inventory; and backup/PITR availability, retention, and most-recent backup metadata. It must omit values, connection strings, provider credentials, OAuth information, webhook secrets, logs containing tokens, and database rows.

The application access owner must arrange existing authorized candidate access for two separate ordinary test principals and one owner/admin principal. Use the candidate's genuine OAuth/passkey/login process; do not share a browser session, create a bypass, use production callback state, mint a token, or treat a local credential-free preview as candidate proof. The access owner must identify a secure out-of-band process for the principals, not place credentials in this repository or handoff.

The existing OAuth-project owner must inspect the current redirect-domain/redirect-URI allowlist and authorize the existing candidate origin `https://gaultline-candidate-pr97-d5c20cc.up.railway.app` and its existing callback `https://gaultline-candidate-pr97-d5c20cc.up.railway.app/api/oauth/callback` in the format required by that project. A read-only attempt at `2026-10-29T10:30:52Z` reached the candidate-generated sign-in URL but was rejected before callback with `invalid redirect_uri`; this is a server-side allowed-origin configuration gate, not proof of a missing password, OAuth client, or provider key. Preserve every already-approved origin, do not rewrite the candidate callback to production, do not create a new OAuth application or project, and do not make the configuration change until the existing OAuth-project owner authorizes that exact scope. Afterward, rerun the existing genuine candidate login; success is still only an access prerequisite, not operational acceptance.

The provider and commercial owners must supply acceptance evidence through the application or their approved test mechanisms, never by exposing keys. Candidate-backed tests may use the named checks below only after explicit acceptance authorization. Checkout stays disabled. No payment, refund, dispute, email, public post, schedule firing, or provider test is part of this infrastructure proposal.

## Candidate-only source reconciliation boundary

No current corrective source is authorized for deployment. When a later integrated source is independently reviewed, the release owner must name one exact 40-character source SHA in a separate approval record. The owner must prove that the candidate-only release action cannot affect production project/environment resources, production data, production domain, checkout, registration, schedules, Track Record writes, or public evidence activation.

Before any such separately authorized candidate release, the owner must perform a status-only guard preflight: confirm Railway supplies `RAILWAY_GIT_COMMIT_SHA`, set `FAULTLINE_ENFORCE_DEPLOY_GUARD=1` only with the independently approved `FAULTLINE_APPROVED_SHA`, and verify the two identities match. `BUILD_COMMIT` is not a release authorization. The existing source guard fails closed on a missing or mismatched platform SHA; this proposal does not turn that guard on or change any variable.

After a future candidate-only release, acceptance starts by recording the new `/api/health` and `/api/build-info` identity, deployment record, and source-approval record together. A public 200 response is still only an identity check. It cannot promote operational status or substitute for authenticated, provider, database, backup, schedule, mail, billing, or visual acceptance.

## Named checks only; no values or invocation in this task

The owner packet and later authorized acceptance plan must use these named checks. They are configuration names and test labels, not values, commands, or permissions to run them.

- `identity_platform_sha`: `RAILWAY_GIT_COMMIT_SHA`, `FAULTLINE_ENFORCE_DEPLOY_GUARD`, and `FAULTLINE_APPROVED_SHA` are reported only as platform-injected/set/unset/matched status.
- `candidate_mysql_private_reference`: `DATABASE_URL` is reported only as a private candidate-MySQL reference; `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQL_URL`, and `MYSQL_PUBLIC_URL` are never disclosed. The database must remain private; no TCP proxy is required for acceptance.
- `provider_configuration_presence`: `FRED_API_KEY`, `POLYGON_API_KEY`, and `COINGECKO_API_KEY` are checked only through permitted source-backed behavior and redacted status. No value is extracted or replaced.
- `candidate_authentication`: `OAUTH_SERVER_URL`, `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, and `JWT_SECRET` are status-only configuration names. Genuine candidate principals establish access through the existing flow.
- `billing_closed`: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are never read. Checkout, registration activation, purchase, refund, dispute, and billing-portal actions remain excluded until a separate commercial acceptance authorization.
- `mail_nonsend`: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `DEFAULT_FROM_EMAIL`, `FOLLOWUP_EMAIL`, and `OUTREACH_EMAIL` are never disclosed. No mail is sent absent a separately approved test sender and recipient protocol.
- `schedule_nochange`: `CRON_SECRET`, `TRACK_RECORD_CRON_WRITES`, `FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED`, and `FAULTLINE_DEAD_MAN_ALERT_URL` are status-only names. Inspect schedule inventory only; do not edit, invoke, or enable schedules. Railway cron is UTC-based and not minute-precise, so a later scheduler acceptance must use the application admission and ordering evidence rather than a nominal cron expression alone.
- `backup_recovery_readiness`: collect backup/PITR status, retention window, and recovery-resource estimate without a restore. The existing read-only privilege/orphan query may run only on an owner-approved backup or recovery copy, never live production.

## Database migration and actual-backup recovery boundary

Boot migrations remain prohibited. The candidate source base cannot be treated as proof that its MySQL schema is ready. A later migration rehearsal requires an actual candidate backup or PITR recovery copy, a named recovery owner, a named migration operator, an independent reviewer, and an approval that specifically permits the restore resource and its expected cost.

A standard Railway volume restore stages a service change and requires review/deploy; it is therefore not a safe routine inspection step for the running candidate. If MySQL PITR is already enabled, Railway documents a different path: a restore creates a sibling MySQL service and leaves the source service untouched. That still creates a billable recovery resource and exposes archive recovery variables to the restored service, so it requires separate explicit approval, limited access, a destruction deadline, and a redacted completion record. If PITR is absent, do not enable it as part of acceptance without explicit owner approval, because enabling changes service configuration and redeploys MySQL.

Only on the approved restored copy may the migration operator check journal state, schema, triggers, foreign keys, and migration/application-role grants; rehearse the ordered journal; prove the application’s schema gate; and rehearse a rollback plan. The test must preserve original records and leave no claim that an actual backup drill occurred until its owner evidence is independently reviewed.

## Contingency only: clean replacement payload

A clean replacement is not currently authorized. Consider it only if the designated candidate owner explicitly records that the online existing candidate is absent or unusable for acceptance, states why the existing project/environment cannot be repaired safely, and receives founder approval for new spend. Do not infer absence from local missing keys or source/deployed mismatch.

If that decision is made, select a **new Railway project**, not a duplicate environment in the existing project. Railway environment changes are scoped, but duplicating an environment copies services, variables, and configuration; a distinct project avoids accidental reuse of candidate or production references and provides the stronger isolation required here. Create exactly two primary resources: one `faultline-acceptance-app` service and one private `faultline-acceptance-mysql` service. Do not add a public MySQL TCP proxy, worker, cron service, shared-variable import, production domain, production database link, or copied production secret/data.

The new app must reference only the new MySQL service privately. Create only test/preview provider, OAuth, Stripe, and mail configurations through their owners’ approved channels; the names in the preceding checklist are sufficient for the request. The deployment guard must be proven with an exact independently approved SHA and Railway-provided platform SHA before the app is allowed to listen. Keep checkout and registration disabled, leave all scheduler/Track Record/evidence flags off, do not send mail, and do not activate provider refreshes or public publishing. A future actual-backup restore still needs its own owner and cost approval.

## Cost and approval question

Primary reuse has no approved new infrastructure spend. Current plan tier, candidate app CPU/RAM, MySQL volume, backup increment, PITR archive/bucket usage, network egress, provider charges, and email charges are unknown to this task and must be confirmed by the existing owner without exposing values. Railway's currently published container-rate inputs are RAM at $10/GB-month, CPU at $20/vCPU-month, volume storage at $0.15/GB-month, and egress at $0.05/GB; backup data uses volume pricing, and PITR additionally consumes bucket storage and database-to-bucket egress. Builds are documented as free, but a restored MySQL sibling or clean replacement has runtime and storage costs. These rates are not a quote or authorization.

For the contingency, the owner must return an estimated monthly total calculated from the selected app and MySQL CPU/RAM allocations, persisted volume size, expected backup/PITR increment, expected egress, plan/included usage, and third-party provider/mail costs. The precise founder question is: **If and only if the existing candidate owner declares it unusable, do you authorize a separate Railway project with one app and one private MySQL service, isolated non-production configurations, and the stated monthly spend cap?** Until that answer exists, reuse the live candidate and do not provision.

## Visual and media boundary

This infrastructure proposal does not certify visual functionality. The mandatory cross-cutting visual inventory remains owned by the visual workstream. Existing lineage establishes only that the six-domain material must be data-backed and visibly unavailable when evidence is missing; a historical development-preview constellation or a draft cinematic package is not deployed interactive-product proof. The saved media history itself ends with `has_more: true` and a cursor, so any original specification beyond the retained result is UNKNOWN pending parent retrieval. Candidate visual acceptance needs the separate visual inventory, exact deployed SHA, genuine authorized user context where required, and independent desktop/mobile/reduced-motion/keyboard assessment.

## Sources consulted

- Railway environments: <https://docs.railway.com/environments>
- Railway variables: <https://docs.railway.com/variables>
- Railway MySQL: <https://docs.railway.com/databases/mysql>
- Railway deployment actions: <https://docs.railway.com/deployments/deployment-actions>
- Railway cron jobs: <https://docs.railway.com/cron-jobs>
- Railway backups: <https://docs.railway.com/volumes/backups>
- Railway point-in-time recovery: <https://docs.railway.com/volumes/point-in-time-recovery>
- Railway pricing: <https://docs.railway.com/pricing/plans>
