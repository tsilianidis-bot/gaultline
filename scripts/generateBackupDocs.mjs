/**
 * FAULTLINE disaster-recovery utility.
 *
 * Generates source-backed documentation only. It reads the committed Drizzle
 * schema and project file tree; it never reads, emits, or copies secret values.
 * Run with: node scripts/generateBackupDocs.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = path.join(root, "drizzle", "schema.ts");
const schemaText = fs.readFileSync(schemaPath, "utf8");
const lines = schemaText.split(/\r?\n/);

function getTableBlocks() {
  const tables = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^export const\s+(\w+)\s*=\s*mysqlTable\("([^"]+)",\s*\{/);
    if (!match) continue;

    const [, variable, tableName] = match;
    let end = index;
    while (end < lines.length && !/^\}\);?\s*$/.test(lines[end].trim()) && !/^\}\)\);?\s*$/.test(lines[end].trim())) {
      end += 1;
    }
    const block = lines.slice(index, Math.min(end + 1, lines.length));
    tables.push({ variable, tableName, start: index + 1, end: end + 1, block });
  }
  return tables;
}

function parseColumns(table) {
  const columns = [];
  for (const rawLine of table.block) {
    const line = rawLine.trim();
    if (line.startsWith("//") || line.startsWith("/**") || line.startsWith("*") || line.startsWith("export")) continue;
    const match = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.+),\s*(?:\/\/.*)?$/);
    if (!match) continue;
    const [, column, expression] = match;
    if (["on", "with", "columns"].includes(column)) continue;
    if (!expression.includes("(")) continue;
    const sourceName = expression.match(/^[^(]+\("([^"]+)"/)?.[1] ?? column;
    const refVariable = expression.match(/references\(\(\)\s*=>\s*(\w+)\.(\w+)/);
    columns.push({
      column,
      sourceName,
      expression,
      notNull: expression.includes(".notNull()"),
      primaryKey: expression.includes(".primaryKey()"),
      unique: expression.includes(".unique()"),
      references: refVariable ? `${refVariable[1]}.${refVariable[2]}` : null,
    });
  }
  return columns;
}

function parseIndexes(table) {
  const indexes = [];
  for (const rawLine of table.block) {
    const line = rawLine.trim();
    const match = line.match(/^(\w+)\s*:\s*(index|uniqueIndex)\("([^"]+)"\)\.on\((.+)\),?$/);
    if (!match) continue;
    const [, key, kind, name, columns] = match;
    indexes.push({ key, kind, name, columns: columns.replaceAll("t.", "") });
  }
  return indexes;
}

function schemaMarkdown(tables) {
  const date = new Date().toISOString().slice(0, 10);
  const rows = tables.map(table => ({ ...table, columns: parseColumns(table), indexes: parseIndexes(table) }));
  const relationships = [];
  for (const table of rows) {
    for (const column of table.columns) {
      if (column.references) relationships.push({ from: `${table.tableName}.${column.sourceName}`, to: column.references });
    }
  }

  const out = [];
  out.push("# FAULTLINE Database Schema Backup", "", `> **Generated from:** \`drizzle/schema.ts\` on ${date}. This document contains structure only; it contains **no credentials, record exports, or production data**.`, "");
  out.push("## Restore Authority", "", "The TypeScript schema and all SQL migrations in `drizzle/` are the executable authorities. This Markdown document is a readable recovery map. Use `drizzle/schema.ts` and apply the ordered migration SQL files after a fresh database is provisioned.", "");
  out.push("## Inventory", "", "| Table | Source declaration | Columns | Index definitions |", "|---|---:|---:|---:|");
  for (const table of rows) out.push(`| \`${table.tableName}\` | \`${table.variable}\` | ${table.columns.length} | ${table.indexes.length} |`);
  out.push("", "## Relationships", "");
  if (relationships.length === 0) out.push("No `.references()` relationships were parsed from the source schema.");
  else {
    out.push("| Child field | References |", "|---|---|");
    for (const rel of relationships) out.push(`| \`${rel.from}\` | \`${rel.to}\` |`);
  }

  for (const table of rows) {
    out.push("", `## \`${table.tableName}\``, "", `**Source:** \`drizzle/schema.ts:${table.start}\` — variable \`${table.variable}\`.`, "");
    out.push("| Field (source) | Column expression | Required | PK | Unique | Foreign key |", "|---|---|---:|---:|---:|---|");
    for (const column of table.columns) {
      const expression = column.expression.replaceAll("|", "\\|").replaceAll("`", "\\`");
      out.push(`| \`${column.column}\` → \`${column.sourceName}\` | \`${expression}\` | ${column.notNull ? "Yes" : "No"} | ${column.primaryKey ? "Yes" : "No"} | ${column.unique ? "Yes" : "No"} | ${column.references ? `\`${column.references}\`` : "—"} |`);
    }
    out.push("", "**Indexes / constraints declared in the table callback**", "");
    if (table.indexes.length === 0) out.push("- None declared beyond per-column primary-key or unique constraints.");
    else {
      out.push("| Key | Type | Database name | Fields |", "|---|---|---|---|");
      for (const index of table.indexes) out.push(`| \`${index.key}\` | \`${index.kind}\` | \`${index.name}\` | \`${index.columns}\` |`);
    }
  }
  out.push("", "## Migration Chain", "", "The archive includes the migration chain under `drizzle/`. Apply migrations in ascending numeric filename order. Verify the database migration ledger after application. Do not assume this document substitutes for the migration SQL.", "");
  return `${out.join("\n")}\n`;
}

const excludedDirectoryNames = new Set(["node_modules", ".git", ".manus", ".manus-logs", "dist", "coverage", ".cache"]);
const excludedNamePatterns = [
  /^\.env(?:\.|$)/i,
  /^\.project-config\.json$/i,
  /^todo(?:-[^/]+)?\.md$/i,
  /\.log$/i,
  /\.zip$/i,
  /\.DS_Store$/,
];

function redactSensitiveText(text) {
  return text
    .replace(/sk_(?:live|test)_[A-Za-z0-9_]+/g, "[REDACTED_STRIPE_KEY]")
    .replace(/whsec_[A-Za-z0-9_]+/g, "[REDACTED_STRIPE_WEBHOOK_SECRET]")
    .replace(/SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_SENDGRID_KEY]")
    .replace(/AKIA[0-9A-Z]{16}/g, "[REDACTED_AWS_ACCESS_KEY]")
    .replace(/([A-Z0-9_]*(?:SECRET|KEY|TOKEN|PASSWORD)\s*(?::|=)\s*)([^\s`]+)/g, "$1[REDACTED]");
}

function safeTodoExport() {
  const todoFiles = fs.readdirSync(root)
    .filter(name => /^todo(?:-[^/]+)?\.md$/i.test(name))
    .sort();
  const body = todoFiles.map(name => {
    const content = redactSensitiveText(fs.readFileSync(path.join(root, name), "utf8"));
    return `\n--- SOURCE: ${name} (sensitive values redacted) ---\n\n${content.trim()}\n`;
  }).join("\n");
  return `# FAULTLINE Safe TODO Export\n\n> Generated from root \`todo*.md\` files for disaster recovery. Secret-like values were automatically redacted. The unredacted originals are intentionally excluded from the safe archive.\n${body}`;
}

function walk(relative = "") {
  const absolute = path.join(root, relative);
  const entries = fs.readdirSync(absolute, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectoryNames.has(entry.name)) continue;
    if (excludedNamePatterns.some(pattern => pattern.test(entry.name))) continue;
    const rel = path.join(relative, entry.name);
    if (entry.isDirectory()) found.push(...walk(rel));
    else if (entry.isFile()) found.push(rel.replaceAll(path.sep, "/"));
  }
  return found;
}

function classify(file) {
  if (file === "package.json" || file.endsWith("lock.yaml") || file === "vite.config.ts" || file.startsWith("tsconfig") || file === "drizzle.config.ts") return ["Build configuration", "Critical", "Yes"];
  if (file.startsWith("server/")) return [file.includes(".test.") ? "Backend tests" : "Backend / intelligence", file.includes("_core/") || file.includes("routers") || file.includes("pressure/") ? "Critical" : "Important", "Yes"];
  if (file.startsWith("client/")) return [file.includes("/pages/") || file.includes("/components/") ? "Frontend / UX" : "Frontend configuration", "Critical", "Yes"];
  if (file.startsWith("shared/")) return ["Shared contract / domain model", "Critical", "Yes"];
  if (file.startsWith("drizzle/")) return ["Database schema / migration", "Critical", "Yes"];
  if (file.startsWith("scripts/")) return ["Operational tooling", "Important", "Yes"];
  if (file.startsWith("references/")) return ["Product reference / asset", "Important", "Review"];
  if (file.endsWith(".md")) return ["Documentation", "Important", "Yes"];
  return ["Project support", "Supporting", "Review"];
}

function csv(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function manifestCsv() {
  const files = walk().sort();
  const out = ["File Path,Category,Purpose,Criticality,Required for Restore,Verified,Notes"];
  for (const file of files) {
    const [category, criticality, required] = classify(file);
    const purpose = file.endsWith(".test.ts") ? "Automated regression coverage" : `Included project artifact: ${file}`;
    out.push([file, category, purpose, criticality, required, "Source tree present", "Included by safe-archive rules unless excluded as a secret, dependency, cache, log, or archive"].map(csv).join(","));
  }
  return `${out.join("\n")}\n`;
}

const tables = getTableBlocks();
fs.writeFileSync(path.join(root, "FAULTLINE_DATABASE_SCHEMA.md"), schemaMarkdown(tables));
fs.writeFileSync(path.join(root, "FAULTLINE_TODO_SAFE.md"), safeTodoExport());
fs.writeFileSync(path.join(root, "FAULTLINE_BACKUP_MANIFEST.csv"), manifestCsv());
console.log(JSON.stringify({ tables: tables.length, manifestFiles: walk().length }, null, 2));
