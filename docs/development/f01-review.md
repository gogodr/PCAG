# F01 review: foundation decisions

Date: 2026-10-22. Status: In progress. User acceptance: pending.

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

Research and decision notes are being prepared. This document will record the final review route and verification results.
