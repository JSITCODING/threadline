# ADR 0001: Local, review-gated core

## Status

Accepted, 2026-09-19.

## Decision

Threadline keeps imports, normalized conversations, proposals, snapshots, and audit state in private local application storage. The public repository contains only code, documentation, and synthetic fixtures.

Conversation ingestion, proposal generation, approval, and apply are separate operations. Apply requires an approved proposal, an unchanged target hash, vault containment, a private snapshot, and an audit event.

Version 0.1 modifies existing Markdown files only. It cannot delete, rename, or create vault notes.

## Consequences

- A model cannot silently convert a conversation into durable memory.
- A stale proposal cannot overwrite newer manual work.
- Rollback refuses to overwrite edits made after apply.
- Provider integrations remain optional and explicitly invoked.
- The first user experience is a CLI; a UI comes after these rules are stable.
