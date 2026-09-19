import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ThreadlineDatabase } from "./database.js";
import { initializeConfig, runtimePaths } from "./paths.js";
import { applyProposal, approveProposal, createProposal, rollbackProposal } from "./proposals.js";
import { importChatGptFile } from "./service.js";

const fixture = join(process.cwd(), "examples", "fixtures", "conversations.json");
const syntheticVault = join(process.cwd(), "examples", "synthetic-vault");

function setup(): { root: string; vault: string; db: ThreadlineDatabase; paths: ReturnType<typeof runtimePaths> } {
  const root = mkdtempSync(join(tmpdir(), "threadline-test-"));
  const vault = join(root, "vault");
  mkdirSync(vault);
  cpSync(syntheticVault, vault, { recursive: true });
  const paths = runtimePaths({ THREADLINE_HOME: join(root, "state") });
  initializeConfig(vault, paths);
  return { root, vault, db: new ThreadlineDatabase(paths.database), paths };
}

describe("Threadline safety workflow", () => {
  it("imports idempotently and completes approve, apply, snapshot, audit, and rollback", () => {
    const { vault, db, paths } = setup();
    try {
      const first = importChatGptFile(db, fixture);
      const second = importChatGptFile(db, fixture);
      assert.deepEqual(first, { duplicate: false, imported: 3, inserted: 3, updated: 0 });
      assert.equal(second.duplicate, true);
      assert.equal(db.listConversations().length, 3);

      const targetPath = "20 Projects/Example Project.md";
      const target = join(vault, targetPath);
      const before = readFileSync(target, "utf8");
      const proposal = createProposal(db, {
        conversationId: "chatgpt:project-conversation",
        provider: "manual",
        targetPath,
        content: "## Decision\n\nShip the safe CLI core first."
      }, paths);
      assert.throws(() => applyProposal(db, proposal.id, paths), /approved/);
      approveProposal(db, proposal.id);
      const applied = applyProposal(db, proposal.id, paths);
      assert.equal(applied.status, "applied");
      assert.match(readFileSync(target, "utf8"), /Ship the safe CLI core first\./);
      assert.notEqual(db.getSnapshotForProposal(proposal.id), null);
      assert.equal(db.countAuditEvents("proposal.applied"), 1);

      const rolledBack = rollbackProposal(db, proposal.id, paths);
      assert.equal(rolledBack.status, "rolled-back");
      assert.equal(readFileSync(target, "utf8"), before);
    } finally {
      db.close();
    }
  });

  it("marks sensitive proposals principles-only and rejects traversal", () => {
    const { db, paths } = setup();
    try {
      importChatGptFile(db, fixture);
      const privateProposal = createProposal(db, {
        conversationId: "chatgpt:private-conversation",
        provider: "manual",
        targetPath: "30 Areas/Growth.md",
        content: "## Principle\n\nCommunicate honestly without trying to control the outcome."
      }, paths);
      assert.equal(privateProposal.principlesOnly, true);
      assert.throws(() => createProposal(db, {
        conversationId: "chatgpt:project-conversation",
        provider: "manual",
        targetPath: "../outside.md",
        content: "Unsafe"
      }, paths), /traversal/);
    } finally {
      db.close();
    }
  });

  it("refuses stale proposals and refuses rollback over newer work", () => {
    const { vault, db, paths } = setup();
    try {
      importChatGptFile(db, fixture);
      const targetPath = "40 Resources/Learning.md";
      const target = join(vault, targetPath);
      const stale = createProposal(db, {
        conversationId: "chatgpt:project-conversation",
        provider: "manual",
        targetPath,
        content: "## Learning\n\nA reviewed update."
      }, paths);
      approveProposal(db, stale.id);
      writeFileSync(target, `${readFileSync(target, "utf8")}\nNewer manual work.\n`);
      assert.throws(() => applyProposal(db, stale.id, paths), /Target changed/);

      const fresh = createProposal(db, {
        conversationId: "chatgpt:project-conversation",
        provider: "manual",
        targetPath,
        content: "## Learning\n\nA second reviewed update."
      }, paths);
      approveProposal(db, fresh.id);
      applyProposal(db, fresh.id, paths);
      writeFileSync(target, `${readFileSync(target, "utf8")}\nNewer work after apply.\n`);
      assert.throws(() => rollbackProposal(db, fresh.id, paths), /newer work/);
    } finally {
      db.close();
    }
  });

  it("fails closed when the optional OpenAI provider is selected", () => {
    const { db, paths } = setup();
    try {
      importChatGptFile(db, fixture);
      assert.throws(() => createProposal(db, {
        conversationId: "chatgpt:project-conversation",
        provider: "openai",
        targetPath: "20 Projects/Example Project.md"
      }, paths), /No network call/);
    } finally {
      db.close();
    }
  });
});
