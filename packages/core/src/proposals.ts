import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import { proposalSchema, type Proposal } from "@threadline/schema";

import { ThreadlineDatabase } from "./database.js";
import { sha256 } from "./hash.js";
import { loadConfig, resolveContainedExistingTarget, runtimePaths, type RuntimePaths } from "./paths.js";

export interface CreateProposalInput {
  conversationId: string;
  provider: "manual" | "openai";
  targetPath: string;
  content?: string;
}

function atomicWrite(target: string, content: string): void {
  const temporary = join(dirname(target), `.threadline-${randomUUID()}.tmp`);
  writeFileSync(temporary, content, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, target);
}

export function createProposal(db: ThreadlineDatabase, input: CreateProposalInput, paths: RuntimePaths = runtimePaths()): Proposal {
  const conversation = db.getConversation(input.conversationId);
  if (!conversation) throw new Error(`Conversation not found: ${input.conversationId}`);
  if (input.provider === "openai") {
    throw new Error("The OpenAI provider is not implemented in v0.1. No network call was made. Use the manual provider.");
  }
  const content = input.content?.trim();
  if (!content) throw new Error("Manual proposals require non-empty reviewed Markdown content.");
  if (content.length > 50_000) throw new Error("Proposal content exceeds the 50,000-character v0.1 limit.");

  const config = loadConfig(paths);
  const target = resolveContainedExistingTarget(config.vaultPath, input.targetPath);
  const existing = readFileSync(target, "utf8");
  const now = new Date().toISOString();
  const proposal = proposalSchema.parse({
    id: `proposal:${randomUUID()}`,
    conversationId: conversation.id,
    provider: input.provider,
    targetPath: input.targetPath.replaceAll("\\", "/"),
    content,
    baseHash: sha256(existing),
    principlesOnly: conversation.sensitive,
    status: "draft",
    createdAt: now,
    reviewedAt: null,
    appliedAt: null,
    appliedHash: null
  });
  db.insertProposal(proposal);
  db.audit("proposal.created", proposal.id, { conversationId: conversation.id, targetPath: proposal.targetPath, principlesOnly: proposal.principlesOnly });
  return proposal;
}

export function approveProposal(db: ThreadlineDatabase, id: string): Proposal {
  const proposal = requireProposal(db, id);
  if (proposal.status !== "draft") throw new Error(`Only draft proposals can be approved; current status is ${proposal.status}.`);
  const updated = db.updateProposalStatus(id, "approved", { reviewedAt: new Date().toISOString() });
  db.audit("proposal.approved", id, { targetPath: proposal.targetPath });
  return updated;
}

export function rejectProposal(db: ThreadlineDatabase, id: string): Proposal {
  const proposal = requireProposal(db, id);
  if (proposal.status !== "draft" && proposal.status !== "approved") {
    throw new Error(`Only draft or approved proposals can be rejected; current status is ${proposal.status}.`);
  }
  const updated = db.updateProposalStatus(id, "rejected", { reviewedAt: new Date().toISOString() });
  db.audit("proposal.rejected", id, { targetPath: proposal.targetPath });
  return updated;
}

export function applyProposal(db: ThreadlineDatabase, id: string, paths: RuntimePaths = runtimePaths()): Proposal {
  const proposal = requireProposal(db, id);
  if (proposal.status !== "approved") throw new Error(`Proposal must be approved before apply; current status is ${proposal.status}.`);

  const config = loadConfig(paths);
  const target = resolveContainedExistingTarget(config.vaultPath, proposal.targetPath);
  const before = readFileSync(target, "utf8");
  const currentHash = sha256(before);
  if (currentHash !== proposal.baseHash) throw new Error("Target changed after proposal creation. Create a new proposal against the current note.");

  const snapshotId = `snapshot:${randomUUID()}`;
  const snapshotPath = join(paths.snapshots, `${snapshotId.replace(":", "-")}.md`);
  writeFileSync(snapshotPath, before, { encoding: "utf8", mode: 0o600 });
  db.insertSnapshot({
    id: snapshotId,
    proposalId: proposal.id,
    targetPath: proposal.targetPath,
    snapshotPath,
    existed: true,
    createdAt: new Date().toISOString()
  });

  const separator = before.endsWith("\n") ? "\n" : "\n\n";
  const after = `${before}${separator}${proposal.content.trim()}\n`;
  atomicWrite(target, after);
  const appliedHash = sha256(after);
  const updated = db.updateProposalStatus(id, "applied", { appliedAt: new Date().toISOString(), appliedHash });
  db.audit("proposal.applied", id, { targetPath: proposal.targetPath, snapshotId, appliedHash });
  return updated;
}

export function rollbackProposal(db: ThreadlineDatabase, id: string, paths: RuntimePaths = runtimePaths()): Proposal {
  const proposal = requireProposal(db, id);
  if (proposal.status !== "applied" || !proposal.appliedHash) throw new Error("Only an applied proposal can be rolled back.");
  const snapshot = db.getSnapshotForProposal(id);
  if (!snapshot || !existsSync(snapshot.snapshotPath)) throw new Error("Recovery snapshot is missing.");

  const config = loadConfig(paths);
  const target = resolveContainedExistingTarget(config.vaultPath, proposal.targetPath);
  const current = readFileSync(target, "utf8");
  if (sha256(current) !== proposal.appliedHash) throw new Error("Target changed after apply. Refusing to overwrite newer work during rollback.");
  atomicWrite(target, readFileSync(snapshot.snapshotPath, "utf8"));
  const updated = db.updateProposalStatus(id, "rolled-back");
  db.audit("proposal.rolled-back", id, { targetPath: proposal.targetPath, snapshotId: snapshot.id });
  return updated;
}

function requireProposal(db: ThreadlineDatabase, id: string): Proposal {
  const proposal = db.getProposal(id);
  if (!proposal) throw new Error(`Proposal not found: ${id}`);
  return proposal;
}

export function proposalDisplayName(proposal: Proposal): string {
  return `${basename(proposal.targetPath)} [${proposal.status}]`;
}
