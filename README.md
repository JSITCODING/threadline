# Threadline

Threadline is a local-first, review-gated bridge from AI conversations to durable Markdown knowledge.

It imports a ChatGPT data export, normalizes the active conversation branch, stores the result locally, and lets a human create, approve, apply, and roll back explicit Markdown proposals. It never silently writes to a vault.

## Why

Useful decisions and learning often become trapped in long conversations. Copying complete transcripts into a personal knowledge system creates noise and privacy risk. Threadline preserves the useful thread: a decision, principle, project update, or next action—with review before memory.

## Current capabilities

- Initialize a private local Threadline workspace for a Markdown vault.
- Import `conversations.json` from a ChatGPT export.
- Normalize the active branch and deduplicate repeat imports.
- Mark potentially sensitive conversations for principles-only handling.
- Create manual Markdown proposals without copying transcripts.
- Approve, reject, apply, snapshot, audit, and roll back proposals.
- Reject absolute paths, traversal, unsafe symlinks, stale target hashes, and unapproved writes.

## Quick start

```bash
pnpm install
pnpm check

pnpm threadline init --vault ./examples/synthetic-vault
pnpm threadline import chatgpt ./examples/fixtures/conversations.json
pnpm threadline conversation list

pnpm threadline propose CONVERSATION_ID \
  --provider manual \
  --target "20 Projects/Example Project.md" \
  --content-file ./examples/proposal.md

pnpm threadline proposal list
pnpm threadline proposal approve PROPOSAL_ID
pnpm threadline proposal apply PROPOSAL_ID
```

Threadline stores real imports, the SQLite database, proposals, snapshots, and audit state in the operating system's private application-data directory. Those files do not belong in this repository or the vault.

## Safety boundary

- No delete or rename operations.
- No write outside the configured real vault path.
- No apply without explicit approval.
- No apply when the target changed after proposal creation.
- A private recovery snapshot is created before every write.
- AI providers are optional; no provider is called implicitly.
- Repository examples are synthetic.

Read [Security](docs/security/security-model.md), [Architecture](docs/decisions/0001-local-review-gated-core.md), and the [Learning Log](docs/learning/learning-log.md) before extending the write path.

## Roadmap

1. `v0.1` - import and normalize
2. `v0.2` - candidate extraction and routing
3. `v0.3` - proposal review, snapshot, and apply
4. `v0.4` - real-vault pilot
5. `v0.5` - local React review interface

The repository currently includes an early vertical slice across milestones 1-3 so the safety model can be tested end to end. The CLI remains the product surface until that core is stable.
