import { z } from "zod";

export const messageRoleSchema = z.enum(["user", "assistant", "system", "tool", "unknown"]);
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const attachmentReferenceSchema = z.object({
  name: z.string().optional(),
  assetPointer: z.string().optional(),
  mimeType: z.string().optional()
});
export type AttachmentReference = z.infer<typeof attachmentReferenceSchema>;

export const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: messageRoleSchema,
  content: z.string(),
  createdAt: z.string().nullable(),
  order: z.number().int().nonnegative(),
  attachments: z.array(attachmentReferenceSchema)
});
export type Message = z.infer<typeof messageSchema>;

export const conversationSchema = z.object({
  id: z.string(),
  source: z.literal("chatgpt"),
  sourceId: z.string(),
  title: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  sensitive: z.boolean(),
  contentHash: z.string(),
  messages: z.array(messageSchema)
});
export type Conversation = z.infer<typeof conversationSchema>;

export const memoryCandidateSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  kind: z.enum(["decision", "principle", "project-update", "next-action", "reference"]),
  summary: z.string(),
  principlesOnly: z.boolean()
});
export type MemoryCandidate = z.infer<typeof memoryCandidateSchema>;

export const routeDecisionSchema = z.object({
  targetPath: z.string(),
  reason: z.string(),
  confidence: z.number().min(0).max(1)
});
export type RouteDecision = z.infer<typeof routeDecisionSchema>;

export const proposalStatusSchema = z.enum(["draft", "approved", "rejected", "applied", "rolled-back"]);
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;

export const proposalSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  provider: z.enum(["manual", "openai"]),
  targetPath: z.string(),
  content: z.string(),
  baseHash: z.string(),
  principlesOnly: z.boolean(),
  status: proposalStatusSchema,
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
  appliedAt: z.string().nullable(),
  appliedHash: z.string().nullable()
});
export type Proposal = z.infer<typeof proposalSchema>;

export const targetNoteSchema = z.object({
  relativePath: z.string(),
  absolutePath: z.string(),
  exists: z.boolean(),
  contentHash: z.string()
});
export type TargetNote = z.infer<typeof targetNoteSchema>;

export const snapshotSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  targetPath: z.string(),
  snapshotPath: z.string(),
  existed: z.boolean(),
  createdAt: z.string()
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export const auditEventSchema = z.object({
  id: z.string(),
  action: z.string(),
  subjectId: z.string(),
  details: z.record(z.string(), z.unknown()),
  createdAt: z.string()
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const threadlineConfigSchema = z.object({
  version: z.literal(1),
  vaultPath: z.string(),
  createdAt: z.string()
});
export type ThreadlineConfig = z.infer<typeof threadlineConfigSchema>;
