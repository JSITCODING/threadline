# Contributing

Use a focused branch and pull request for each behavior change. A contribution must include tests, a concise explanation of the behavior, and no personal data.

Before opening a pull request:

```bash
pnpm check
git diff --check
```

Fixtures must be synthetic. Never commit real exports, vault notes, credentials, personal paths, generated databases, proposals, snapshots, or audit logs.

Record meaningful learning in `docs/learning/learning-log.md` using `Used / Learning / Learned`.
