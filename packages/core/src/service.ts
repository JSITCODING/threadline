import { basename } from "node:path";
import { existsSync, realpathSync, statSync } from "node:fs";

import { readChatGptExport } from "./chatgpt.js";
import { ThreadlineDatabase, type ImportResult } from "./database.js";
import { sha256 } from "./hash.js";
import { loadConfig, runtimePaths, type RuntimePaths } from "./paths.js";

export function openDatabase(paths: RuntimePaths = runtimePaths()): ThreadlineDatabase {
  return new ThreadlineDatabase(paths.database);
}

export function importChatGptFile(db: ThreadlineDatabase, path: string): ImportResult {
  const { raw, conversations } = readChatGptExport(path);
  return db.importConversations(basename(path), sha256(raw), conversations);
}

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export function doctor(paths: RuntimePaths = runtimePaths()): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  try {
    const config = loadConfig(paths);
    checks.push({ name: "config", ok: true, detail: paths.config });
    const vaultExists = existsSync(config.vaultPath) && statSync(config.vaultPath).isDirectory();
    checks.push({ name: "vault", ok: vaultExists, detail: vaultExists ? realpathSync(config.vaultPath) : config.vaultPath });
  } catch (error) {
    checks.push({ name: "config", ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
  checks.push({ name: "runtime", ok: existsSync(paths.root), detail: paths.root });
  try {
    const db = openDatabase(paths);
    db.close();
    checks.push({ name: "database", ok: true, detail: paths.database });
  } catch (error) {
    checks.push({ name: "database", ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
  return checks;
}
