import { readFileSync } from "node:fs";

import { conversationSchema, type AttachmentReference, type Conversation, type MessageRole } from "@threadline/schema";
import { z } from "zod";

import { sha256 } from "./hash.js";

const rawConversationSchema = z.object({
  id: z.string().optional(),
  conversation_id: z.string().optional(),
  title: z.string().nullable().optional(),
  create_time: z.number().nullable().optional(),
  update_time: z.number().nullable().optional(),
  current_node: z.string().nullable().optional(),
  mapping: z.record(z.string(), z.unknown())
}).passthrough();

const rawExportSchema = z.array(rawConversationSchema);

const rawNodeSchema = z.object({
  id: z.string().optional(),
  parent: z.string().nullable().optional(),
  message: z.unknown().nullable().optional()
}).passthrough();

const rawMessageSchema = z.object({
  id: z.string().optional(),
  author: z.object({ role: z.string().optional() }).passthrough().optional(),
  create_time: z.number().nullable().optional(),
  content: z.object({
    parts: z.array(z.unknown()).optional(),
    text: z.string().optional()
  }).passthrough().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
}).passthrough();

function isoFromUnix(value: number | null | undefined): string | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function normalizeRole(value: string | undefined): MessageRole {
  if (value === "user" || value === "assistant" || value === "system" || value === "tool") return value;
  return "unknown";
}

function stringifyPart(part: unknown): string {
  if (typeof part === "string") return part;
  if (part && typeof part === "object") {
    const record = part as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (typeof record.transcript === "string") return record.transcript;
  }
  return "";
}

function collectAttachments(value: unknown, output: AttachmentReference[] = []): AttachmentReference[] {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) collectAttachments(item, output);
    return output;
  }

  const record = value as Record<string, unknown>;
  const assetPointer = typeof record.asset_pointer === "string" ? record.asset_pointer : undefined;
  const name = typeof record.name === "string" ? record.name : undefined;
  const mimeType = typeof record.mime_type === "string" ? record.mime_type : undefined;
  if (assetPointer || name || mimeType) output.push({ ...(name ? { name } : {}), ...(assetPointer ? { assetPointer } : {}), ...(mimeType ? { mimeType } : {}) });
  for (const child of Object.values(record)) collectAttachments(child, output);
  return output;
}

function activeNodeIds(mapping: Record<string, unknown>, currentNode: string | null | undefined): string[] {
  if (!currentNode || !mapping[currentNode]) return Object.keys(mapping);
  const reversed: string[] = [];
  const seen = new Set<string>();
  let cursor: string | null = currentNode;

  while (cursor && mapping[cursor] && !seen.has(cursor)) {
    seen.add(cursor);
    reversed.push(cursor);
    const node = rawNodeSchema.safeParse(mapping[cursor]);
    cursor = node.success ? (node.data.parent ?? null) : null;
  }
  return reversed.reverse();
}

const sensitivePattern = /\b(relationship|breakup|grief|suicid|mental health|anxiety|therapy|romantic|namoro|relacao|relacionamento|luto|ansiedade|saude mental)\b/i;

export function normalizeChatGptExport(value: unknown): Conversation[] {
  const rawConversations = rawExportSchema.parse(value);

  return rawConversations.map((raw, conversationIndex) => {
    const sourceId = raw.id ?? raw.conversation_id ?? `conversation-${conversationIndex + 1}`;
    const id = `chatgpt:${sourceId}`;
    const title = raw.title?.trim() || "Untitled conversation";
    const nodeIds = activeNodeIds(raw.mapping, raw.current_node);
    const messages = nodeIds.flatMap((nodeId, order) => {
      const nodeResult = rawNodeSchema.safeParse(raw.mapping[nodeId]);
      if (!nodeResult.success || !nodeResult.data.message) return [];
      const messageResult = rawMessageSchema.safeParse(nodeResult.data.message);
      if (!messageResult.success) return [];
      const rawMessage = messageResult.data;
      const parts = rawMessage.content?.parts ?? [];
      const content = (rawMessage.content?.text ?? parts.map(stringifyPart).filter(Boolean).join("\n")).trim();
      if (!content && parts.length === 0) return [];
      return [{
        id: `chatgpt:${sourceId}:${rawMessage.id ?? nodeId}`,
        conversationId: id,
        role: normalizeRole(rawMessage.author?.role),
        content,
        createdAt: isoFromUnix(rawMessage.create_time),
        order,
        attachments: collectAttachments({ parts, metadata: rawMessage.metadata })
      }];
    });

    const hashInput = JSON.stringify({ sourceId, title, messages: messages.map(({ role, content, attachments }) => ({ role, content, attachments })) });
    const sensitiveText = `${title}\n${messages.map((message) => message.content).join("\n")}`;
    return conversationSchema.parse({
      id,
      source: "chatgpt",
      sourceId,
      title,
      createdAt: isoFromUnix(raw.create_time),
      updatedAt: isoFromUnix(raw.update_time),
      sensitive: sensitivePattern.test(sensitiveText),
      contentHash: sha256(hashInput),
      messages
    });
  });
}

export function readChatGptExport(path: string): { raw: Buffer; conversations: Conversation[] } {
  const raw = readFileSync(path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON export: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { raw, conversations: normalizeChatGptExport(parsed) };
}
