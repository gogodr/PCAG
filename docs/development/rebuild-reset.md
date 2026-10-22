# Rebuild reset

Date: 2026-10-22.

The first build grew too quickly to validate each backlog step. The user requested a cleanup and rebuild, explicitly retaining the full backlog.

## Cleanup

- Preserved the complete first build in `archive/first-build-2026-10-22/`, including original documentation, source, tests, examples, manifests, installed dependencies, generated outputs, caches, and CI configuration.
- Removed the old implementation from the active workspace by moving it into that archive. Historical creator instructions, decisions, setup documentation, and milestone evidence remain in the archive; their copied files were hash-checked before removing the active copies.
- Retained research, planning, confirmed gameplay/UI requirements, and development skill guidance in the active workspace.
- Reset milestone completion claims and all 24 backlog statuses. The backlog rows, dependencies, acceptance criteria, and release scope are unchanged.
- Replaced the batch implementation handoff with F01 only, and added a per-item validation log.

## Rebuild contract

Implement one backlog item, run appropriate checks, provide a reviewable result and validation steps, then wait for explicit user acceptance before beginning the next item. Passing automated checks does not substitute for that acceptance. Record requested revisions and repeat the relevant checks before presenting the item again.

No application code or replacement toolchain was created during cleanup. F01 remains Not started. F02 will establish setup and tooling after F01 is accepted. Historical architecture decisions are inputs to re-evaluate, not accepted constraints for the new implementation.

## Recovery and verification

See the [archive guide](../../archive/README.md) for recovery. There was no Git repository available to provide rollback.

Cleanup verification checks that the 24 backlog rows match the original snapshot exactly, every row has a Not started validation entry, active Markdown links resolve, and old implementation paths are absent from the workspace root. Application tests are not applicable to this documentation-only baseline; archived tests are not claimed as rebuild evidence.
