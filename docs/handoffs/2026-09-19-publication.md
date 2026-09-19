# Threadline Publication Handoff

Updated: 2026-09-19

## Objective

Publish the verified local Threadline repository to `git@github.com:JSITCODING/threadline.git`, configure the initial GitHub roadmap, and stop only after remote CI is checked.

## Open This Folder

Open Codex directly at:

```text
/Users/sousa/projects/threadline
```

Do not open the parent `/Users/sousa/projects` folder for this task. Threadline should be the repository root and command working directory.

## Verified Local State

- Branch: `main`
- Commits:
  - `0f713ed feat: establish review-gated Threadline CLI`
  - `382cef5 chore: ignore TypeScript build state`
- `pnpm check` passes.
- Six synthetic tests pass.
- Direct CLI smoke path passes: initialize, doctor, import, repeated import without duplicate memory, list, manual proposal, approve, apply, and snapshot.
- Real LifeOS contents and real ChatGPT exports were not used as fixtures.
- The repository currently has no verified remote push.

## Implemented Surface

- ChatGPT `conversations.json` normalization using the active conversation branch.
- Unicode and attachment references.
- Idempotent imports in local SQLite.
- Sensitive-conversation principles-only marker.
- Manual proposal creation, approval, rejection, apply, snapshot, audit, and rollback.
- Traversal, absolute-path, unsafe-symlink, stale-target, and unapproved-write rejection.
- Optional OpenAI provider interface fails closed and makes no hidden network call.
- CI definition for linting, type-checking, tests, and Gitleaks.

## Known Deviation

The original plan named Vitest. Installation repeatedly stalled while fetching `esbuild`, so the current suite uses Node's built-in test runner. Do not replace it merely for cosmetic plan compliance. If Vitest is restored, preserve all current cases and prove the dependency installation and CI path are reliable.

## Publication Steps

1. Inspect `git status --short`, `git log --oneline`, and `git remote -v`.
2. Confirm `origin` is exactly `git@github.com:JSITCODING/threadline.git`.
3. Run `pnpm install --frozen-lockfile` and `pnpm check`.
4. Review `git ls-files` and scan tracked content for credentials, real exports, LifeOS content, personal absolute paths, databases, and generated private state.
5. Push `main` and verify upstream tracking.
6. Verify GitHub repository visibility is `PUBLIC` and the default branch is `main`.
7. Create milestones:
   - `v0.1 — Import and normalize`
   - `v0.2 — Candidate extraction and routing`
   - `v0.3 — Proposal review, snapshot, and apply`
   - `v0.4 — Real LifeOS pilot`
   - `v0.5 — Local React review interface`
8. Create a small initial issue for each milestone with testable exit criteria.
9. Inspect GitHub Actions and Gitleaks results. Fix real failures on a feature branch.
10. Tag or release `v0.1.0` only after the remote CI result is green and the v0.1 exit criteria are actually met.

## v0.1 Exit Criteria

- Valid and malformed synthetic exports are covered.
- Portuguese and English Unicode are covered.
- Repeat import is idempotent.
- Missing or unsupported attachment references do not crash normalization.
- No tracked fixture contains personal data.
- Remote CI and secret scanning pass.
- The architecture and one import path can be explained without AI assistance.

## Stop Conditions

- Stop if the remote already contains unrelated history; fetch and inspect before reconciling. Never force-push.
- Stop if any tracked content resembles a real export, private vault content, credential, or personal runtime state.
- Stop if repository visibility is not public as requested.
- Stop before a release if remote CI is unavailable or failing.

## Next Product Step After Publication

Open the first v0.2 feature branch for durable-candidate extraction and manual route correction. Keep real LifeOS integration deferred until the containment, approval, conflict, snapshot, audit, and rollback model has survived the synthetic acceptance scenario and remote CI.
