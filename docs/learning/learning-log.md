# Learning log

## 2026-09-19 - Safe vertical slice

### Used

- TypeScript project references and pnpm workspaces.
- Zod schemas for normalized data and persisted proposal state.
- Node's built-in SQLite API.
- Content hashes, real paths, atomic replacement, and private snapshots.
- Node's built-in test runner with synthetic ChatGPT-export fixtures.

### Learning

- How ChatGPT export mappings represent branches and `current_node`.
- How idempotent import differs from simply appending rows.
- Why proposal generation, approval, apply, and rollback need separate states.
- How realpath containment, traversal rejection, and symlink rejection work together.

### Learned

- Pending Jose's own explanation and independent modification. A feature running is not sufficient evidence.

### Next proof

- Explain the active-branch traversal and change one normalization rule without step-by-step assistance.
- Add a fixture for another observed export shape before importing real data.
