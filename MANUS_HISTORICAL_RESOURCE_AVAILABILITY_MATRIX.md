# Manus Historical Resource Availability Matrix

**Purpose:** Document exactly which historical evidence sources were available to the read-only recovery search for the original 317-row Pressure Index generator.

> **Method note:** Parallel subtasks run in isolated sandboxes and could not access the project worktree. Their negative project-path findings are not treated as project-search evidence. Availability below reflects the primary forensic session’s directly verified access.

| Category | Availability | What was directly available | Forensic limitation |
|---|---|---|---|
| A. Prior task conversations | PARTIALLY AVAILABLE | Inherited current-task context and compacted history | No searchable full historical conversation archive. |
| B. Prior task execution logs | PARTIALLY AVAILABLE | Local terminal output files and current-session logs | No platform-wide execution-log archive. |
| C. Previous checkpoints | PARTIALLY AVAILABLE | Checkpoint metadata, reachable Git commits, and current project checkpoint references | No browsable prior checkpoint filesystem/snapshot service. |
| D. Workspace snapshots | NOT AVAILABLE | None beyond current workspace and reachable Git objects | No direct historical workspace snapshot interface. |
| E. Generated files from old tasks | PARTIALLY AVAILABLE | Files retained in repository, local project documents, and local terminal artifacts | Deleted/non-materialized task files unavailable. |
| F. Temporary/sandbox artifacts | AVAILABLE | Accessible local `/home/ubuntu` terminal outputs, uploads, and temporary artifacts | No guarantee earlier sandbox data survived lifecycle changes. |
| G. Code patches from prior tasks | PARTIALLY AVAILABLE | Reachable Git diffs, commit trees, and current source history | Non-committed, expired, or platform-only patches unavailable. |
| H. Deleted/replaced files | PARTIALLY AVAILABLE | Reachable Git history, reflogs, and unreachable-object scan | Files never committed or no longer retained cannot be recovered. |
| I. Task plans / TODO histories | PARTIALLY AVAILABLE | Current `todo.md` and preserved task-history clues | No complete, searchable historical plan archive. |
| J. Build logs | PARTIALLY AVAILABLE | Current/local development logs | No prior cloud-build log archive exposed. |
| K. Agent execution transcripts | NOT AVAILABLE | Only compacted inherited context for this task | No historical agent-transcript storage exposed. |
| L. Previous project exports | NOT AVAILABLE | No local export archive recovered | Platform/project export history not exposed. |
| M. Archived workspace states | NOT AVAILABLE | None | No accessible archived-workspace API or files. |
| N. Git commits created by Manus | AVAILABLE | Reachable commits, branches, tags, commit messages, trees | Searched directly. |
| O. Git reflogs / unreachable objects | AVAILABLE | Local reflogs and `git fsck --unreachable` output | Searched directly; no generator recovered. |
| P. Internal task artifact references | NOT AVAILABLE | None | Platform-internal artifact index not exposed. |
| Q. Attachments from prior tasks | PARTIALLY AVAILABLE | Attachments present in current workspace/context | No global historical attachment repository exposed. |

## Consequence

The recovery search can make confirmed claims about the repository, reachable Git history, current workspace, retained terminal artifacts, and local database evidence. It cannot claim to have searched Manus platform-internal conversations, deleted cloud workspace snapshots, non-materialized task artifacts, or unavailable project exports.

No original historical Pressure Index backfill generator was recovered from the accessible evidence set.
