#!/usr/bin/env node
import { readFileSync } from "node:fs";

import {
  applyProposal,
  approveProposal,
  createProposal,
  doctor,
  importChatGptFile,
  initializeConfig,
  openDatabase,
  rejectProposal,
  rollbackProposal,
  runtimePaths
} from "@threadline/core";
import { Command } from "commander";

const program = new Command();
program.name("threadline").description("Review-gated bridge from AI conversations to Markdown knowledge").version("0.1.0");

program.command("init")
  .requiredOption("--vault <path>", "existing Markdown vault directory")
  .description("Initialize private local Threadline state")
  .action((options: { vault: string }) => {
    const paths = runtimePaths();
    const config = initializeConfig(options.vault, paths);
    const db = openDatabase(paths);
    db.close();
    console.log(`Initialized Threadline for ${config.vaultPath}`);
    console.log(`Private runtime: ${paths.root}`);
  });

program.command("doctor")
  .description("Check configuration, vault, runtime, and database")
  .action(() => {
    const checks = doctor();
    for (const check of checks) console.log(`${check.ok ? "OK" : "FAIL"} ${check.name}: ${check.detail}`);
    if (checks.some((check) => !check.ok)) process.exitCode = 1;
  });

const importCommand = program.command("import").description("Import a conversation export");
importCommand.command("chatgpt")
  .argument("<path>", "path to conversations.json")
  .action((path: string) => withDatabase((db) => {
    const result = importChatGptFile(db, path);
    if (result.duplicate) console.log("This exact export was already imported; no duplicate memory was created.");
    else console.log(`Imported ${result.imported} conversations (${result.inserted} new, ${result.updated} updated).`);
  }));

const conversation = program.command("conversation").description("Inspect normalized conversations");
conversation.command("list").action(() => withDatabase((db) => {
  const rows = db.listConversations();
  if (rows.length === 0) return console.log("No conversations imported.");
  console.table(rows.map((row) => ({
    id: row.id,
    title: row.title,
    messages: row.messageCount,
    privacy: row.sensitive ? "principles-only" : "standard",
    updated: row.updatedAt ?? row.createdAt ?? "unknown"
  })));
}));

program.command("propose")
  .argument("<conversation-id>")
  .requiredOption("--provider <provider>", "manual or openai")
  .requiredOption("--target <relative-path>", "existing Markdown path relative to the vault")
  .option("--content-file <path>", "reviewed Markdown content for the manual provider")
  .action((conversationId: string, options: { provider: string; target: string; contentFile?: string }) => withDatabase((db) => {
    if (options.provider !== "manual" && options.provider !== "openai") throw new Error("Provider must be manual or openai.");
    const content = options.contentFile ? readFileSync(options.contentFile, "utf8") : undefined;
    const proposal = createProposal(db, {
      conversationId,
      provider: options.provider,
      targetPath: options.target,
      ...(content !== undefined ? { content } : {})
    });
    console.log(`Created ${proposal.id}`);
    if (proposal.principlesOnly) console.log("Privacy: this conversation is restricted to principles-only durable memory.");
  }));

const proposal = program.command("proposal").description("Review and apply proposals");
proposal.command("list").action(() => withDatabase((db) => {
  const proposals = db.listProposals();
  if (proposals.length === 0) return console.log("No proposals.");
  console.table(proposals.map((item) => ({ id: item.id, status: item.status, target: item.targetPath, privacy: item.principlesOnly ? "principles-only" : "standard" })));
}));
proposal.command("show").argument("<id>").action((id: string) => withDatabase((db) => {
  const item = db.getProposal(id);
  if (!item) throw new Error(`Proposal not found: ${id}`);
  console.log(JSON.stringify(item, null, 2));
}));
proposal.command("approve").argument("<id>").action((id: string) => withDatabase((db) => console.log(`${approveProposal(db, id).id} approved.`)));
proposal.command("reject").argument("<id>").action((id: string) => withDatabase((db) => console.log(`${rejectProposal(db, id).id} rejected.`)));
proposal.command("apply").argument("<id>").action((id: string) => withDatabase((db) => console.log(`${applyProposal(db, id).id} applied with a private snapshot.`)));
proposal.command("rollback").argument("<id>").action((id: string) => withDatabase((db) => console.log(`${rollbackProposal(db, id).id} rolled back.`)));

function withDatabase(action: (db: ReturnType<typeof openDatabase>) => void): void {
  const db = openDatabase();
  try { action(db); } finally { db.close(); }
}

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
