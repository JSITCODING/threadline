import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const extensions = new Set([".ts", ".mts", ".js", ".mjs", ".json", ".md", ".yml", ".yaml"]);
const ignored = new Set(["node_modules", "dist", "coverage", ".git", ".threadline"]);
const failures = [];

function visit(directory) {
  for (const name of readdirSync(directory)) {
    if (ignored.has(name)) continue;
    const path = join(directory, name);
    const metadata = statSync(path);
    if (metadata.isDirectory()) visit(path);
    else if (extensions.has(extname(name))) inspect(path);
  }
}

function inspect(path) {
  const display = relative(root, path);
  const lines = readFileSync(path, "utf8").split("\n");
  lines.forEach((line, index) => {
    if (/\s+$/.test(line)) failures.push(`${display}:${index + 1} trailing whitespace`);
    if (path.endsWith(".ts") && line.includes("\t")) failures.push(`${display}:${index + 1} tab character`);
    if (path.endsWith(".ts") && /:\s*any\b|<any>/.test(line)) failures.push(`${display}:${index + 1} explicit any`);
    if (path.endsWith(".ts") && line.includes("@ts-ignore")) failures.push(`${display}:${index + 1} @ts-ignore`);
  });
}

visit(root);
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Source hygiene checks passed.");
}
