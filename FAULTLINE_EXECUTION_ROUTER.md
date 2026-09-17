# FAULTLINE Execution Router

## Purpose

Use the cheapest reliable execution lane for every FAULTLINE task. Chat is the command center. GitHub Actions handles repeatable verification. Grok/Codex handles repository changes. Work is reserved for computer/browser operations that cannot be proven efficiently in CI.

## Default routing

| Task | Default lane |
| --- | --- |
| Strategy, prioritization, diagnosis, copy, prompt writing, reviewing results | Chat |
| Typecheck, build, unit/integration tests, startup smoke, build identity, deterministic verification | GitHub Actions |
| Code edits, refactors, fixes, tests, commits, PR work | Grok/Codex |
| Authenticated browser QA, visual interaction, multi-app/desktop operation, end-to-end human-style navigation | Work |

## Work gate

A task may enter Work only when at least one of these is true:

1. It requires a logged-in graphical browser session that CI cannot reproduce safely.
2. It requires visual judgment or interaction across multiple routes/screens.
3. It requires operating multiple external apps/services as a person would.
4. It requires a substantial end-to-end computer workflow that cannot be reduced to CI or a repository change.

If none apply, do not use Work.

## Failure routing

- CI passes: return to Chat for interpretation or the next decision. Do not launch Work merely to repeat CI.
- CI fails because of source/test/build behavior: route to Grok/Codex. Do not launch Work as the first debugging step.
- CI passes but authenticated/visual proof is still required: add the task to `WORK_QUEUE.md` and batch it with related Work-only checks.

## Work batching rule

Do not open Work for one small check at a time. Batch related Work-only items into one bounded assignment with:

- exact commit/SHA or preview build
- routes and viewport matrix
- authentication state required
- interactions to perform
- evidence required (screenshots, console errors, PASS/FAIL)
- explicit prohibitions on source/production changes unless separately authorized

## Release flow

1. Chat defines the objective and acceptance criteria.
2. Grok/Codex makes repository changes when needed.
3. GitHub Actions verifies the change automatically.
4. Chat reviews the CI evidence and decides whether any Work-only proof remains.
5. Remaining Work-only checks are accumulated in `WORK_QUEUE.md`.
6. Work runs one bundled QA assignment against an exact build.
7. Chat reviews the Work result and chooses the next action.

## Cost-control principle

Never use Work to re-run evidence already produced deterministically by GitHub Actions. Never use Work as an iterative discussion surface when Chat can coordinate the task first.
