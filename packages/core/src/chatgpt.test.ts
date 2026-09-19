import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeChatGptExport } from "./chatgpt.js";

const fixture = join(process.cwd(), "examples", "fixtures", "conversations.json");

describe("ChatGPT normalization", () => {
  it("normalizes the active branch, Unicode, attachments, and privacy classification", () => {
    const conversations = normalizeChatGptExport(JSON.parse(readFileSync(fixture, "utf8")) as unknown);
    assert.equal(conversations.length, 3);
    assert.equal(conversations[0]?.messages.length, 2);
    assert.equal(conversations[0]?.messages.some((message) => message.content.includes("abandoned")), false);
    assert.match(conversations[0]?.messages[0]?.content ?? "", /conversas úteis/);
    assert.equal(conversations[1]?.sensitive, true);
    assert.equal(conversations[2]?.messages[0]?.attachments[0]?.name, "example.png");
  });

  it("rejects malformed exports", () => {
    assert.throws(() => normalizeChatGptExport({ conversations: [] }));
  });
});
