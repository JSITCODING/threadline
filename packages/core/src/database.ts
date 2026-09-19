import { DatabaseSync } from "node:sqlite";

import { conversationSchema, proposalSchema, type Conversation, type Proposal, type ProposalStatus, type Snapshot } from "@threadline/schema";

export interface ImportResult {
  duplicate: boolean;
  imported: number;
  inserted: number;
  updated: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
  sensitive: boolean;
  messageCount: number;
}

interface ConversationRow {
  id: string;
  source: string;
  source_id: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
  sensitive: number;
  content_hash: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string | null;
  sort_order: number;
  attachments_json: string;
}

interface ProposalRow {
  id: string;
  conversation_id: string;
  provider: string;
  target_path: string;
  content: string;
  base_hash: string;
  principles_only: number;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  applied_at: string | null;
  applied_hash: string | null;
}

export class ThreadlineDatabase {
  readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS imports (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_name TEXT NOT NULL,
        file_hash TEXT NOT NULL UNIQUE,
        imported_at TEXT NOT NULL,
        conversation_count INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT,
        sensitive INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        imported_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT,
        sort_order INTEGER NOT NULL,
        attachments_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id),
        provider TEXT NOT NULL,
        target_path TEXT NOT NULL,
        content TEXT NOT NULL,
        base_hash TEXT NOT NULL,
        principles_only INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        reviewed_at TEXT,
        applied_at TEXT,
        applied_hash TEXT
      );
      CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL REFERENCES proposals(id),
        target_path TEXT NOT NULL,
        snapshot_path TEXT NOT NULL,
        existed INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        details_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  importConversations(sourceName: string, fileHash: string, conversations: Conversation[]): ImportResult {
    const duplicate = this.db.prepare("SELECT 1 FROM imports WHERE file_hash = ?").get(fileHash);
    if (duplicate) return { duplicate: true, imported: 0, inserted: 0, updated: 0 };

    let inserted = 0;
    let updated = 0;
    const now = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const conversation of conversations) {
        const existing = this.db.prepare("SELECT content_hash FROM conversations WHERE id = ?").get(conversation.id) as { content_hash: string } | undefined;
        if (!existing) inserted += 1;
        else if (existing.content_hash !== conversation.contentHash) updated += 1;

        this.db.prepare(`
          INSERT INTO conversations (id, source, source_id, title, created_at, updated_at, sensitive, content_hash, imported_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            sensitive = excluded.sensitive,
            content_hash = excluded.content_hash,
            imported_at = excluded.imported_at
        `).run(
          conversation.id,
          conversation.source,
          conversation.sourceId,
          conversation.title,
          conversation.createdAt,
          conversation.updatedAt,
          conversation.sensitive ? 1 : 0,
          conversation.contentHash,
          now
        );

        this.db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(conversation.id);
        const insertMessage = this.db.prepare(`
          INSERT INTO messages (id, conversation_id, role, content, created_at, sort_order, attachments_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const message of conversation.messages) {
          insertMessage.run(
            message.id,
            message.conversationId,
            message.role,
            message.content,
            message.createdAt,
            message.order,
            JSON.stringify(message.attachments)
          );
        }
      }

      this.db.prepare(`
        INSERT INTO imports (id, source, source_name, file_hash, imported_at, conversation_count)
        VALUES (?, 'chatgpt', ?, ?, ?, ?)
      `).run(`import:${fileHash}`, sourceName, fileHash, now, conversations.length);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return { duplicate: false, imported: conversations.length, inserted, updated };
  }

  listConversations(): ConversationSummary[] {
    const rows = this.db.prepare(`
      SELECT c.id, c.title, c.created_at, c.updated_at, c.sensitive, COUNT(m.id) AS message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id
      ORDER BY COALESCE(c.updated_at, c.created_at, '') DESC, c.title
    `).all() as unknown as Array<{
      id: string; title: string; created_at: string | null; updated_at: string | null; sensitive: number; message_count: number;
    }>;
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sensitive: row.sensitive === 1,
      messageCount: Number(row.message_count)
    }));
  }

  getConversation(id: string): Conversation | null {
    const row = this.db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as ConversationRow | undefined;
    if (!row) return null;
    const messageRows = this.db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY sort_order").all(id) as unknown as MessageRow[];
    return conversationSchema.parse({
      id: row.id,
      source: row.source,
      sourceId: row.source_id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sensitive: row.sensitive === 1,
      contentHash: row.content_hash,
      messages: messageRows.map((message) => ({
        id: message.id,
        conversationId: message.conversation_id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
        order: message.sort_order,
        attachments: JSON.parse(message.attachments_json) as unknown
      }))
    });
  }

  insertProposal(proposal: Proposal): void {
    this.db.prepare(`
      INSERT INTO proposals (
        id, conversation_id, provider, target_path, content, base_hash, principles_only,
        status, created_at, reviewed_at, applied_at, applied_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      proposal.id,
      proposal.conversationId,
      proposal.provider,
      proposal.targetPath,
      proposal.content,
      proposal.baseHash,
      proposal.principlesOnly ? 1 : 0,
      proposal.status,
      proposal.createdAt,
      proposal.reviewedAt,
      proposal.appliedAt,
      proposal.appliedHash
    );
  }

  listProposals(): Proposal[] {
    return (this.db.prepare("SELECT * FROM proposals ORDER BY created_at DESC").all() as unknown as ProposalRow[]).map(mapProposal);
  }

  getProposal(id: string): Proposal | null {
    const row = this.db.prepare("SELECT * FROM proposals WHERE id = ?").get(id) as ProposalRow | undefined;
    return row ? mapProposal(row) : null;
  }

  updateProposalStatus(id: string, status: ProposalStatus, values: { reviewedAt?: string; appliedAt?: string; appliedHash?: string | null } = {}): Proposal {
    const current = this.getProposal(id);
    if (!current) throw new Error(`Proposal not found: ${id}`);
    this.db.prepare(`
      UPDATE proposals SET status = ?, reviewed_at = ?, applied_at = ?, applied_hash = ? WHERE id = ?
    `).run(
      status,
      values.reviewedAt ?? current.reviewedAt,
      values.appliedAt ?? current.appliedAt,
      values.appliedHash === undefined ? current.appliedHash : values.appliedHash,
      id
    );
    const updated = this.getProposal(id);
    if (!updated) throw new Error(`Proposal disappeared after update: ${id}`);
    return updated;
  }

  insertSnapshot(snapshot: Snapshot): void {
    this.db.prepare(`
      INSERT INTO snapshots (id, proposal_id, target_path, snapshot_path, existed, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(snapshot.id, snapshot.proposalId, snapshot.targetPath, snapshot.snapshotPath, snapshot.existed ? 1 : 0, snapshot.createdAt);
  }

  getSnapshotForProposal(proposalId: string): Snapshot | null {
    const row = this.db.prepare("SELECT * FROM snapshots WHERE proposal_id = ? ORDER BY created_at DESC LIMIT 1").get(proposalId) as {
      id: string; proposal_id: string; target_path: string; snapshot_path: string; existed: number; created_at: string;
    } | undefined;
    return row ? {
      id: row.id,
      proposalId: row.proposal_id,
      targetPath: row.target_path,
      snapshotPath: row.snapshot_path,
      existed: row.existed === 1,
      createdAt: row.created_at
    } : null;
  }

  audit(action: string, subjectId: string, details: Record<string, unknown>): void {
    const createdAt = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO audit_events (id, action, subject_id, details_json, created_at) VALUES (?, ?, ?, ?, ?)
    `).run(`audit:${crypto.randomUUID()}`, action, subjectId, JSON.stringify(details), createdAt);
  }

  countAuditEvents(action?: string): number {
    const row = action
      ? this.db.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action = ?").get(action)
      : this.db.prepare("SELECT COUNT(*) AS count FROM audit_events").get();
    return Number((row as { count: number }).count);
  }
}

function mapProposal(row: ProposalRow): Proposal {
  return proposalSchema.parse({
    id: row.id,
    conversationId: row.conversation_id,
    provider: row.provider,
    targetPath: row.target_path,
    content: row.content,
    baseHash: row.base_hash,
    principlesOnly: row.principles_only === 1,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    appliedAt: row.applied_at,
    appliedHash: row.applied_hash
  });
}
