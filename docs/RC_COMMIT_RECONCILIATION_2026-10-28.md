# Commit reconciliation since production `1cb5dee`

Date: 2026-10-28. Production commit `1cb5dee13832c0556ec5a380ecc4ffb02513e875` (deployment `b19716b1`) is the merge-base of `release/verified-2026-10-22`. This file does not approve a deploy.

`git rev-list --count 1cb5dee..release/verified-2026-10-22` is 75. The 14 commits named for this review are the first 14 on `release/2026-10-05-ux-r3` after `1cb5dee`: the #97 chain `d119512..d49f4e3` (6) and the next 8, which include `2c8d798`.

Approval means a merged pull request whose own commit list contains the SHA, or a stable `git patch-id` match to a commit on a merged pull request. Draft and "do not merge" pull requests are not approval. No review body was recorded on #97; the merge itself is the only approval signal.

## The 14

| SHA | Subject | Source | Approval |
| --- | --- | --- | --- |
| `d119512` | restore session-aware market state freshness | PR **#97** commit | **Merged** 2026-10-17 into `release/2026-10-05-ux-r3`. No review recorded. |
| `51ed44b` | merge of #97 | PR **#97** merge commit | **Merged** with #97. |
| `d5c20cc` | Contain synthetic insider intelligence | Direct commit on `release/2026-10-05-ux-r3` after the #97 merge | **Not a merged PR.** #105 later carries a related insider patch and is still draft, titled do not integrate. |
| `ed95637` | checksum-safe fresh MySQL migration bootstrap | Direct commit on the release branch | **Not a merged PR.** |
| `3c7fdeb` | fresh MySQL index migration ordering | Direct commit on the release branch | **Not a merged PR.** |
| `d49f4e3` | de-duplicate fresh MySQL daily brief migration | Direct commit on the release branch. End of the named #97 chain. | **Not a merged PR.** |
| `3dd8ef9` | Type contained insider procedures | Patch-id match to `6c23851` on draft PR **#105** and `4bd95e4` on draft PR **#106** | **Not approved.** Both PRs are open drafts. |
| `df60fc9` | Stop false LIVE labels and claim each session once | Patch-id match to `e73f83c` on draft PR **#106** | **Not approved.** |
| `7bd2192` | verified intelligence evidence pipeline | Patch-id match to `c8d357c` on open PR **#98** | **Not approved.** #98 is open, not merged. |
| `d0ccd2a` | evidence readiness and Phase 2 plan | Patch-id match to `4e950d1` on open PR **#98** | **Not approved.** |
| `1e2a03f` | link clean evidence pull request | Patch-id match to `b05ee4c` on open PR **#98** | **Not approved.** |
| `db124cd` | harden intelligence evidence readiness | Patch-id match to `4191b44` on open PR **#98** | **Not approved.** |
| `2c8d798` | embed verified evidence Core in NOW | Adds `evidencePresentation.ts` and the Now.tsx wiring. No patch-id match on the searched PR branches. | **Not in any PR. Not approved.** |
| `21f5820` | default-off intelligence track record | No patch-id match to PR #91's commits (`950693b`, `9698146`, `06dc230`) or to `5b54c28`. Landed on the release branch. | **Not approved.** #91 remains an open draft. |

## Four later commits on the same release line

These sit on `release/2026-10-05-ux-r3` after the 14 and are inside the 75. None matched a merged PR by patch-id.

| SHA | Subject | Approval |
| --- | --- | --- |
| `743cd24` | Smart Discovery freshness and failed session leases | Not a merged PR |
| `49c090c` | fail closed signal evidence and daily story | Not a merged PR |
| `5dd60a4` | gate customer market labels on qualified state | Not a merged PR |
| `f908e04` | retain completed session date for closed symbols | Not a merged PR. Tip of `release/2026-10-05-ux-r3` at this review. |

## The rest of `release/verified-2026-10-22`

The other commits between `f908e04` and `592f933` (the branch tip this remediation starts from) include draft series that are not merged:

- PR **#106** (draft) session-guard and LIVE remediation SHAs such as `4bd95e4` were merged into `candidate/integrated-2026-10-19` by merge commits on that candidate, not by merging #106.
- PR **#113** (draft) withhold series: `deca8b4`, `98b0ef7`, `23e40a2`, `3caa282`, `23f7a9e`, `35c650e`, `3b43d60`, `f9a6702`.
- PR **#115** (draft) sub-score withhold series: `56974ab`, `5ef5630`, `d1a4e38`, `c234b08`, `481c850`.
- PR **#116** is an open draft from `release/verified-2026-10-22` into `main`. It is not approval to deploy.

PR **#117** and **#118** were not modified.

## Decision for James

Only `d119512` and its merge `51ed44b` are on a merged pull request. The other 12 of the 14, including `2c8d798`, are on the release candidate without a merged approval. Do not treat `release/verified-2026-10-22` as an approved production deploy.
