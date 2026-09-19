import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { threadlineConfigSchema, type ThreadlineConfig } from "@threadline/schema";

export interface RuntimePaths {
  root: string;
  config: string;
  database: string;
  snapshots: string;
}

export function runtimePaths(env: NodeJS.ProcessEnv = process.env): RuntimePaths {
  let root = env.THREADLINE_HOME;
  if (!root) {
    if (platform() === "darwin") root = join(homedir(), "Library", "Application Support", "Threadline");
    else if (platform() === "win32") root = join(env.APPDATA ?? homedir(), "Threadline");
    else root = join(env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "threadline");
  }

  return {
    root,
    config: join(root, "config.json"),
    database: join(root, "threadline.sqlite"),
    snapshots: join(root, "snapshots")
  };
}

export function initializeConfig(vaultPath: string, paths = runtimePaths()): ThreadlineConfig {
  const requested = resolve(vaultPath);
  if (!existsSync(requested) || !statSync(requested).isDirectory()) {
    throw new Error(`Vault must be an existing directory: ${requested}`);
  }

  const realVault = realpathSync(requested);
  const config: ThreadlineConfig = { version: 1, vaultPath: realVault, createdAt: new Date().toISOString() };
  mkdirSync(paths.root, { recursive: true, mode: 0o700 });
  mkdirSync(paths.snapshots, { recursive: true, mode: 0o700 });
  writeFileSync(paths.config, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  return config;
}

export function loadConfig(paths = runtimePaths()): ThreadlineConfig {
  if (!existsSync(paths.config)) throw new Error("Threadline is not initialized. Run `threadline init --vault PATH`.");
  return threadlineConfigSchema.parse(JSON.parse(readFileSync(paths.config, "utf8")));
}

export function assertSafeRelativeMarkdownPath(targetPath: string): string {
  if (isAbsolute(targetPath)) throw new Error("Target path must be relative to the configured vault.");
  const normalized = targetPath.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === ".." || part === ".")) {
    throw new Error("Target path contains unsafe traversal segments.");
  }
  if (!normalized.toLowerCase().endsWith(".md")) throw new Error("Target path must point to a Markdown file.");
  return parts.join("/");
}

export function resolveContainedExistingTarget(vaultPath: string, targetPath: string): string {
  const realVault = realpathSync(vaultPath);
  const safeRelative = assertSafeRelativeMarkdownPath(targetPath);
  const candidate = resolve(realVault, safeRelative);
  const relationship = relative(realVault, candidate);
  if (relationship.startsWith("..") || isAbsolute(relationship)) throw new Error("Target escapes the configured vault.");

  let cursor = realVault;
  for (const part of safeRelative.split("/")) {
    cursor = join(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw new Error("Symbolic links are not allowed in proposal targets.");
  }

  if (!existsSync(candidate) || !statSync(candidate).isFile()) {
    throw new Error("Version 0.1 only applies proposals to existing Markdown files.");
  }

  const realTarget = realpathSync(candidate);
  const realRelationship = relative(realVault, realTarget);
  if (realRelationship.startsWith("..") || isAbsolute(realRelationship)) throw new Error("Resolved target escapes the configured vault.");
  return realTarget;
}

export function ensurePrivateDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  const parent = dirname(path);
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true, mode: 0o700 });
}

export function isInside(root: string, child: string): boolean {
  const relation = relative(root, child);
  return relation === "" || (!relation.startsWith(`..${sep}`) && relation !== ".." && !isAbsolute(relation));
}
