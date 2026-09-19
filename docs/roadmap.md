# Roadmap

## v0.1 - Import and normalize

- ChatGPT `conversations.json` parser.
- Active-branch normalization.
- Local SQLite persistence and idempotent import.
- CLI `init`, `doctor`, `import chatgpt`, and `conversation list`.

## v0.2 - Candidate extraction and routing

- Explicit provider interface.
- Reviewable candidate types: decision, principle, project update, next action, reference.
- Configurable LifeOS routes.
- Privacy rule enforcement beyond keyword classification.

## v0.3 - Proposal workflow

- Proposal inspection and editing.
- Approval and rejection.
- Conflict detection, snapshots, apply, audit, and rollback.

An early manual proposal workflow exists to validate the safety boundary; richer extraction and routing remain future work.

## v0.4 - Real-vault pilot

- Read-only audit against a private export.
- Small approved pilot on non-sensitive notes.
- Recovery rehearsal and privacy review.

## v0.5 - Local review interface

- React interface over the stable core.
- No browser-based vault write path until the CLI rules and tests remain authoritative.
