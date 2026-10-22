# F01 review: foundation decisions

Date: 2026-10-22. Status: Awaiting user validation. User acceptance: pending.

## Scope and acceptance

Review Escoria documentation for room state, action execution, inventory, and UI separation. Record fresh PCAG project/runtime boundaries, preview lifecycle, persistence/export decisions, and working UX defaults. Historical decisions are inputs only. No application scaffold, dependency installation, or later backlog implementation belongs to F01.

Acceptance scenarios:

1. Each reference finding names its source and documentation version, separately from our design choices.
2. Each data category and package has a clear owner; preview and export share runtime behavior.
3. Working UX preserves the confirmed character, View, approach, explicit-verb, and cancellation requirements.
4. Decisions identify consequences, alternatives, outstanding experiments, and responsible backlog items.
5. The user can review the evidence before F02 starts; the other 23 items stay Not started.

Failure cases to check: treating archived tests as fresh evidence; implying Escoria guarantees cancellation or atomic effects; preview mutating authored content; storage failures replacing good data; export requiring a creator-side compiler; importing unsupported formats silently; introducing future features during F01.

## Review artifacts

1. Read the [Escoria feature notes](../research/04-escoria-f01-review.md): six sourced areas, documentation version, historical comparison, and explicit evidence limits.
2. Review the [foundation decision record](../decisions/0001-rebuild-foundation.md): data/package ownership, isolated preview, local persistence, prebuilt export, UX, alternatives, and outstanding experiments.
3. Confirm that View speaks without walking, physical actions wait for arrival, and canceled work cannot execute later. These are planned contracts, not a running demonstration.
4. Review the open-question table. Storage implementation, navigation, transactions, and save migration have named future validation steps.
5. Accept F01 or request revisions. F02 stays Not started until explicit acceptance is recorded in the [validation log](validation-log.md).

## Verification performed

- Opened the seven linked official Escoria documentation pages (home, concepts, architecture, inventory, setup, saves, ASHES) and compared findings against documents 05/07/08. Expected and observed: the reference supports the stated concepts, while PCAG-specific guarantees are identified as independent choices.
- Read the two historical decision records with `git show fdc0bda:archive/first-build-2026-10-22/docs/decisions/0001-foundation-architecture.md` and the corresponding `0002-escoria-reference-study.md`. Expected and observed: historical evidence is available in Git, but is not a fresh implementation pass.
- Ran a Python documentation check from the repository root: extracted local Markdown links in the three F01 artifacts and checked file existence; counted backlog/status rows; asserted exactly one Awaiting user validation row and 23 Not started rows; checked that all 24 backlog IDs remain in order and that no application/package manifest exists. Expected and observed: all checks passed. The two edited trackers' local links were also checked.
- Ran `git diff --check`: it flagged CRLF as trailing whitespace in modified files, including pre-existing reset edits. Normalized the five F01-touched documents to LF and ran `git diff --check -- docs/development/f01-review.md docs/development/validation-log.md docs/planning/06-development-plan.md`, followed by `git diff --cached --check` after staging the F01 artifacts. Observed: scoped and staged checks passed; unrelated reset files retain their existing whitespace warnings.
- Manually traced every F01 acceptance scenario and failure case above to the research/decision notes. Expected and observed: each is covered, with future runtime evidence explicitly deferred to its owning item.

No application, browser, or automated gameplay tests apply to this documentation-only item. No Escoria demo or source audit was performed. No dependency was installed and no F02 work was started. M0 remains incomplete.

## Git scope and existing workspace issues

The initial working tree already contained reset edits and tracked archive deletions. F01 commits contain only the three dedicated F01 artifacts; status updates to the already-modified plan and validation log remain in the working tree with those reset edits, to avoid committing unrelated work.

The root README/roadmap still contain reset-era wording, and existing links to `archive/README.md` do not resolve in this checkout. Those pre-existing inconsistencies are not F01 evidence. Historical review used Git objects instead; archive restoration/cleanup is outside this item. No deleted archive files were staged or restored.
