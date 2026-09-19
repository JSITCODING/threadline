# Repository Guidelines

## Start Here

Read `README.md`, `docs/decisions/0001-local-review-gated-core.md`, `docs/security/security-model.md`, and `docs/handoffs/2026-09-19-publication.md` before changing behavior or publishing.

## Product Boundary

Threadline is a local-first, review-gated bridge from AI conversation exports to durable Markdown knowledge. It must never silently write to a real vault. Real exports, LifeOS content, credentials, personal paths, databases, proposals, snapshots, and audit state must never enter Git.

## Architecture

- `apps/cli`: command-line interface.
- `packages/schema`: shared Zod contracts.
- `packages/core`: import, database, containment, proposal, snapshot, audit, and rollback behavior.
- `examples`: synthetic data only.
- `docs`: decisions, security, roadmap, learning, and handoffs.

## Required Checks

Use pnpm 11 and Node 24 or newer.

```bash
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` must pass source hygiene, strict TypeScript, and all tests. Add focused tests for every write-path or privacy-boundary change.

## Change Rules

- Work on a feature branch and prefer small pull requests.
- No delete or rename operations in the v0.1 vault write path.
- Preserve explicit approval, content-hash conflict checks, containment, symlink rejection, snapshot, audit, and rollback.
- Do not add hidden network calls. Providers stay optional and explicitly configured.
- Do not begin the React interface before CLI safety behavior is stable.
- Update `docs/learning/learning-log.md` with `Used / Learning / Learned` for meaningful features.

## Verification Language

Separate locally verified behavior from remote CI, real-vault pilots, provider behavior, and future milestones. Never claim publication, CI, or release success without checking GitHub directly.
